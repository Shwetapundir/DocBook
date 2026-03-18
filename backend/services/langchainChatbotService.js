'use strict';

/**
 * langchainChatbotService.js
 *
 * Core AI service powered by LangChain + Llama 3 (via Groq).
 *
 * Two structured flows:
 *   RESCHEDULE  – multi-step conversation to change an existing appointment
 *   BOOK        – symptom-driven multi-step flow to book a new appointment
 *
 * Architecture:
 *   1. Fast keyword matching handles obvious inputs (no LLM cost)
 *   2. Groq / Llama 3 handles ambiguous NLU and general Q&A
 *   3. State machine (JSONB in DB) drives each flow deterministically
 *   4. All DB mutations require explicit user confirmation
 *
 * LLM provider priority:
 *   GROQ_API_KEY  → ChatGroq (llama-3.3-70b-versatile or env override)
 *   Ollama local  → ChatOllama (llama3.2 or env override)
 *   Neither       → rule-based fallback (no LLM for general Q&A)
 */

const { z } = require('zod');
const pool   = require('../config/db');
const { generateRuleBasedReply } = require('./chatbotService'); // fallback for general Q&A

// ─── LLM factory ──────────────────────────────────────────────────────────────
let _llm = null; // singleton per process

function getLLM() {
  if (_llm) return _llm;

  if (process.env.GROQ_API_KEY) {
    const { ChatGroq } = require('@langchain/groq');
    _llm = new ChatGroq({
      apiKey  : process.env.GROQ_API_KEY,
      model   : process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      temperature : 0.1,
      maxTokens   : 600,
    });
    console.log('[ChatbotService] Using Groq / Llama 3 →', process.env.GROQ_MODEL || 'llama-3.3-70b-versatile');
    return _llm;
  }

  try {
    const { ChatOllama } = require('@langchain/ollama');
    _llm = new ChatOllama({
      baseUrl    : process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      model      : process.env.OLLAMA_MODEL    || 'llama3.2',
      temperature: 0.1,
    });
    console.log('[ChatbotService] Using Ollama →', process.env.OLLAMA_MODEL || 'llama3.2');
    return _llm;
  } catch {
    console.warn('[ChatbotService] No LLM provider found — using rule-based fallback');
    return null;
  }
}

// ─── Utility / formatters ──────────────────────────────────────────────────────
function toYYYYMMDD(d) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatDate(dateStr) {
  // dateStr is "YYYY-MM-DD" — parse without UTC shift
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function formatTime12h(totalMinutes) {
  const h    = Math.floor(totalMinutes / 60);
  const m    = totalMinutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function parseTimeToMinutes(timeStr) {
  // "HH:MM" or "HH:MM:SS"
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function formatAppointmentsList(appointments) {
  return (
    `Here are your upcoming appointments:\n\n` +
    appointments.map((a, i) =>
      `**${i + 1}.** Dr. ${a.doctor_name} (${a.specialization})\n` +
      `   📅 ${formatDate(a.date)}  ⏰ ${formatTime12h(parseTimeToMinutes(a.start_time))}`
    ).join('\n\n')
  );
}

const ABORT_RE = /\b(cancel|stop|exit|abort|quit|start over|reset|restart|go back|nevermind|never mind|back|undo)\b/i;

const DISCLAIMER =
  '\n\n---\n⚕️ *Disclaimer: This is general guidance only. Always consult a qualified doctor for medical advice and diagnosis.*';

// ─── Database tool functions ───────────────────────────────────────────────────

async function getUpcomingAppointments(patientId) {
  const { rows } = await pool.query(
    `SELECT
       a.id,
       a.doctor_id,
       a.appointment_date::text   AS date,
       a.start_time::text         AS start_time,
       a.end_time::text           AS end_time,
       a.status,
       a.reason,
       u.full_name                AS doctor_name,
       dp.specialization
     FROM appointments a
     JOIN users u             ON u.id  = a.doctor_id
     JOIN doctor_profiles dp  ON dp.user_id = a.doctor_id
     WHERE a.patient_id = $1
       AND a.appointment_date >= CURRENT_DATE
       AND a.status IN ('pending', 'confirmed')
     ORDER BY a.appointment_date ASC, a.start_time ASC`,
    [patientId]
  );
  return rows;
}

async function getAvailableSlots(doctorId, dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dayOfWeek = new Date(y, m - 1, d).getDay(); // 0=Sun … 6=Sat

  const avail = await pool.query(
    `SELECT start_time::text, end_time::text
       FROM availability
      WHERE doctor_id = $1 AND day_of_week = $2 AND is_active = true`,
    [doctorId, dayOfWeek]
  );
  if (avail.rows.length === 0) return [];

  const booked = await pool.query(
    `SELECT start_time::text
       FROM appointments
      WHERE doctor_id = $1
        AND appointment_date = $2
        AND status NOT IN ('cancelled')`,
    [doctorId, dateStr]
  );
  const bookedSet = new Set(booked.rows.map((r) => r.start_time.slice(0, 5))); // "HH:MM"

  const slots = [];
  for (const window of avail.rows) {
    let cur = parseTimeToMinutes(window.start_time);
    const end = parseTimeToMinutes(window.end_time);
    while (cur + 30 <= end) {
      const sH = String(Math.floor(cur / 60)).padStart(2, '0');
      const sM = String(cur % 60).padStart(2, '0');
      const eH = String(Math.floor((cur + 30) / 60)).padStart(2, '0');
      const eM = String((cur + 30) % 60).padStart(2, '0');
      const key = `${sH}:${sM}`;
      if (!bookedSet.has(key)) {
        slots.push({
          start_time: key,
          end_time  : `${eH}:${eM}`,
          db_start  : `${key}:00`,      // for DB insert
          db_end    : `${eH}:${eM}:00`, // for DB insert
          display   : formatTime12h(cur),
        });
      }
      cur += 30;
    }
  }
  return slots;
}

async function getDoctorsBySpecialization(specialization) {
  const { rows } = await pool.query(
    `SELECT
       u.id,
       u.full_name        AS name,
       dp.specialization,
       dp.experience_years,
       dp.consultation_fee,
       dp.hospital_name,
       dp.qualification
     FROM users u
     JOIN doctor_profiles dp ON dp.user_id = u.id
     WHERE dp.is_approved = true
       AND u.is_active    = true
       AND LOWER(dp.specialization) LIKE LOWER($1)
     ORDER BY dp.experience_years DESC
     LIMIT 8`,
    [`%${specialization}%`]
  );
  return rows;
}

async function rescheduleAppointment(appointmentId, patientId, newDate, dbStart, dbEnd) {
  const { rows } = await pool.query(
    `UPDATE appointments
        SET appointment_date = $1,
            start_time       = $2,
            end_time         = $3,
            status           = 'pending',
            updated_at       = NOW()
      WHERE id = $4 AND patient_id = $5
      RETURNING id, appointment_date::text AS date, start_time::text, status`,
    [newDate, dbStart, dbEnd, appointmentId, patientId]
  );
  return rows[0] || null;
}

async function bookAppointment(patientId, doctorId, date, dbStart, dbEnd, reason) {
  const { rows } = await pool.query(
    `INSERT INTO appointments
       (patient_id, doctor_id, appointment_date, start_time, end_time, reason, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending')
     RETURNING id, appointment_date::text AS date, start_time::text, status`,
    [patientId, doctorId, date, dbStart, dbEnd, reason || 'Booked via DocBot AI']
  );
  return rows[0];
}

// ─── Fast NLU (no LLM cost) ────────────────────────────────────────────────────

function detectIntentFast(message) {
  const t = message.toLowerCase();
  if (/\b(reschedule|re-schedule|change.*appoint|move.*appoint|shift.*appoint|modify.*appoint|different.*date.*appoint|new.*time.*appoint)\b/.test(t))
    return 'RESCHEDULE';
  if (/\b(book\s*(new|an|a)?\s*(appointment|appt)|schedule.*doctor|new appointment|make appointment|i (have|am having|feel|got|am feeling|am suffering|suffer)|my.*symptoms|symptoms|tooth|fever|headache|pain|rash|cough|cold|flu|injury|infection|bleeding)\b/.test(t))
    return 'BOOK';
  if (/\b(cancel.*appoint|delete.*appoint)\b/.test(t))
    return 'CANCEL';
  return null;
}

function extractSelectionFast(message, count) {
  // Plain digit: "1", "2", " 3 "
  const m = message.trim().match(/^(\d+)$/);
  if (m) {
    const n = parseInt(m[1]);
    if (n >= 1 && n <= count) return n - 1;
  }
  // Digit inside sentence: "I want option 2" / "number 3"
  const m2 = message.match(/\b([1-9])\b/);
  if (m2) {
    const n = parseInt(m2[1]);
    if (n <= count) return n - 1;
  }
  // Ordinals
  const ordinals = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];
  const lower = message.toLowerCase();
  for (let i = 0; i < Math.min(ordinals.length, count); i++) {
    if (lower.includes(ordinals[i])) return i;
  }
  return null;
}

function extractConfirmationFast(message) {
  const t = message.toLowerCase().trim();
  if (/^(yes|confirm|ok|okay|sure|proceed|go ahead|yep|yeah|do it|book it|reschedule it|y|correct|confirmed|sounds good|perfect|great)$/.test(t)
      || t.startsWith('yes ') || t.startsWith('confirm ')) return true;
  if (/^(no|cancel|stop|abort|nope|n|don'?t|negative|go back|exit)$/.test(t)
      || t.startsWith('no ') || t.startsWith('cancel ')) return false;
  return null;
}

function extractDateFast(message) {
  const today = new Date();
  const t = message.toLowerCase();

  // ISO: 2026-03-15
  const iso = message.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[0];

  // DD/MM/YYYY
  const slash = message.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (slash) {
    const d = new Date(+slash[3], +slash[2] - 1, +slash[1]);
    if (!isNaN(d)) return toYYYYMMDD(d);
  }

  if (/\btoday\b/.test(t)) return toYYYYMMDD(today);

  if (/\btomorrow\b/.test(t)) {
    const d = new Date(today); d.setDate(d.getDate() + 1); return toYYYYMMDD(d);
  }

  if (/\bday after tomorrow\b/.test(t)) {
    const d = new Date(today); d.setDate(d.getDate() + 2); return toYYYYMMDD(d);
  }

  // "next Monday" / "this Friday"
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const dm = t.match(/\b(?:next|this)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (dm) {
    const target = days.indexOf(dm[1]);
    const d = new Date(today);
    let diff = (target - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return toYYYYMMDD(d);
  }

  // "March 15" / "15 March" / "15th March 2026"
  const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const mNames = months.join('|');
  const md1 = t.match(new RegExp(`\\b(${mNames})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`));
  const md2 = t.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${mNames})\\b`));
  let mon = null, day = null;
  if (md1) { mon = months.indexOf(md1[1]) + 1; day = +md1[2]; }
  else if (md2) { day = +md2[1]; mon = months.indexOf(md2[2]) + 1; }
  if (mon && day) {
    // Try to find year in the message
    const yearM = message.match(/\b(202[5-9]|203\d)\b/);
    let year = yearM ? +yearM[1] : today.getFullYear();
    let d = new Date(year, mon - 1, day);
    if (d < today && !yearM) d = new Date(year + 1, mon - 1, day);
    return toYYYYMMDD(d);
  }

  return null;
}

// ─── LLM-powered NLU ──────────────────────────────────────────────────────────

async function detectIntentLLM(llm, message) {
  try {
    const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
    const resp = await llm.withStructuredOutput(
      z.object({
        intent: z.enum(['RESCHEDULE', 'BOOK', 'CANCEL', 'GENERAL']),
      }),
      { name: 'classify_intent' }
    ).invoke([
      new SystemMessage(
        'Classify the user message intent for a medical appointment booking chatbot.\n' +
        '- RESCHEDULE: wants to change date/time of an existing appointment\n' +
        '- BOOK: wants a new appointment OR describes symptoms\n' +
        '- CANCEL: wants to cancel/delete an appointment\n' +
        '- GENERAL: anything else (health questions, how-to, greetings)'
      ),
      new HumanMessage(message),
    ]);
    return resp.intent;
  } catch {
    return 'GENERAL';
  }
}

async function detectIntent(llm, message) {
  const fast = detectIntentFast(message);
  if (fast) return fast;
  if (!llm) return 'GENERAL';
  return detectIntentLLM(llm, message);
}

async function extractSelectionLLM(llm, message, options) {
  try {
    const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
    const resp = await llm.withStructuredOutput(
      z.object({ index: z.number().int().min(1).max(options.length).nullable() }),
      { name: 'extract_selection' }
    ).invoke([
      new SystemMessage(
        `The user is choosing one item from this numbered list:\n` +
        options.map((o, i) => `${i + 1}. ${o}`).join('\n') +
        `\nReturn the 1-based number they chose, or null if unclear.`
      ),
      new HumanMessage(message),
    ]);
    return resp.index !== null ? resp.index - 1 : null;
  } catch {
    return null;
  }
}

async function extractSelection(llm, message, options) {
  const fast = extractSelectionFast(message, options.length);
  if (fast !== null) return fast;
  if (!llm) return null;
  return extractSelectionLLM(llm, message, options);
}

async function extractDateLLM(llm, message) {
  try {
    const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
    const today = toYYYYMMDD(new Date());
    const resp = await llm.withStructuredOutput(
      z.object({
        date: z.string().nullable().describe('YYYY-MM-DD or null if no valid future date found'),
      }),
      { name: 'extract_date' }
    ).invoke([
      new SystemMessage(`Today is ${today}. Extract the date from the user's message and return it in YYYY-MM-DD format. Return null if no valid date found.`),
      new HumanMessage(message),
    ]);
    return resp.date;
  } catch {
    return null;
  }
}

async function extractDate(llm, message) {
  const fast = extractDateFast(message);
  if (fast) return fast;
  if (!llm) return null;
  return extractDateLLM(llm, message);
}

async function extractConfirmation(llm, message) {
  const fast = extractConfirmationFast(message);
  if (fast !== null) return fast;
  if (!llm) return false;
  try {
    const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
    const resp = await llm.withStructuredOutput(
      z.object({ confirmed: z.boolean() }),
      { name: 'extract_confirmation' }
    ).invoke([
      new SystemMessage('Does the user confirm/agree to proceed with the action?'),
      new HumanMessage(message),
    ]);
    return resp.confirmed;
  } catch {
    return false;
  }
}

// Specialization map as fallback (mirrors chatbotService.js)
const SPEC_FALLBACK = [
  { kw: ['chest','heart','palpitation','cardiac'], spec: 'Cardiologist' },
  { kw: ['skin','rash','acne','eczema'], spec: 'Dermatologist' },
  { kw: ['headache','migraine','seizure','neuro','nerve','dizziness'], spec: 'Neurologist' },
  { kw: ['bone','fracture','joint','knee','back pain','spine','arthritis'], spec: 'Orthopedist' },
  { kw: ['stomach','gastric','diarrhea','constipation','acidity','liver'], spec: 'Gastroenterologist' },
  { kw: ['eye','vision','cataract','retina'], spec: 'Ophthalmologist' },
  { kw: ['ear','throat','nose','tonsil','sinusitis','ent'], spec: 'ENT Specialist' },
  { kw: ['child','baby','infant','pediatric','toddler'], spec: 'Pediatrician' },
  { kw: ['pregnancy','gynec','menstrual','period','pcos','ovary'], spec: 'Gynecologist' },
  { kw: ['depression','anxiety','mental','panic','insomnia','stress'], spec: 'Psychiatrist' },
  { kw: ['diabetes','thyroid','hormone','endocrine'], spec: 'Endocrinologist' },
  { kw: ['kidney','urinary','uti','renal','prostate'], spec: 'Urologist' },
  { kw: ['lung','asthma','breathing','copd','tuberculosis','tb'], spec: 'Pulmonologist' },
  { kw: ['tooth','teeth','dental','gum','cavity','oral'], spec: 'Dentist' },
  { kw: ['cancer','tumour','tumor','oncol'], spec: 'Oncologist' },
  { kw: ['allerg'], spec: 'Allergist' },
];

function detectSpecFallback(symptoms) {
  const t = symptoms.toLowerCase();
  for (const { kw, spec } of SPEC_FALLBACK) {
    if (kw.some((k) => t.includes(k))) return spec;
  }
  return 'General Physician';
}

async function detectSpecialization(llm, symptoms) {
  if (!llm) {
    return { specialization: detectSpecFallback(symptoms), reasoning: '' };
  }
  try {
    const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
    const resp = await llm.withStructuredOutput(
      z.object({
        specialization: z.string().describe('Single most appropriate doctor specialization'),
        reasoning     : z.string().describe('One sentence explanation for the patient'),
      }),
      { name: 'detect_specialization' }
    ).invoke([
      new SystemMessage(
        'You are a medical triage assistant. Suggest ONE doctor specialization based on symptoms.\n' +
        'Valid specializations: General Physician, Cardiologist, Dermatologist, Neurologist, ' +
        'Orthopedist, Gastroenterologist, Ophthalmologist, ENT Specialist, Pediatrician, ' +
        'Gynecologist, Psychiatrist, Endocrinologist, Urologist, Pulmonologist, Dentist, Oncologist, Allergist.\n' +
        'Use "General Physician" when unsure.\n' +
        'IMPORTANT: Never diagnose. Only suggest a specialist type.'
      ),
      new HumanMessage(`Patient symptoms: ${symptoms}`),
    ]);
    return { specialization: resp.specialization, reasoning: resp.reasoning };
  } catch {
    return { specialization: detectSpecFallback(symptoms), reasoning: '' };
  }
}

async function answerGeneralQuestion(llm, message, history) {
  if (!llm) return generateRuleBasedReply(message);
  try {
    const { HumanMessage, AIMessage, SystemMessage } = require('@langchain/core/messages');
    const msgs = [
      new SystemMessage(
        'You are DocBot, a friendly AI health assistant on DocBook, a doctor appointment platform.\n' +
        'Help with: general health questions, booking guidance, doctor specialization info.\n' +
        'Rules:\n' +
        '1. NEVER diagnose — always say "see a doctor for diagnosis"\n' +
        '2. Keep responses concise (under 180 words)\n' +
        '3. For emergencies: direct to call 112/108 immediately\n' +
        '4. Be warm and professional\n' +
        '5. For symptoms: suggest which type of doctor to see'
      ),
      ...(history || []).slice(-6).map((m) =>
        m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
      ),
      new HumanMessage(message),
    ];
    const resp = await llm.invoke(msgs);
    let text = resp.content;
    if (!text.includes('⚕️')) text += DISCLAIMER;
    return text;
  } catch (err) {
    console.error('[ChatbotService] LLM general Q&A error:', err.message);
    return generateRuleBasedReply(message);
  }
}

// ─── Reschedule flow ───────────────────────────────────────────────────────────

async function handleRescheduleStep(llm, patientId, message, step, data) {
  // Allow aborting at any step
  if (ABORT_RE.test(message)) {
    return {
      reply   : 'Reschedule cancelled. ✅\n\nWhat else can I help you with?\n\n📅 Type **reschedule** to change an appointment\n🩺 Type **book** to make a new appointment',
      newState: {},
    };
  }

  switch (step) {
    // ── Step 1: user picks which appointment ────────────────────────────────
    case 'SHOWING_APPOINTMENTS': {
      const options = data.appointments.map((a) => `Dr. ${a.doctor_name} on ${formatDate(a.date)}`);
      const idx     = await extractSelection(llm, message, options);

      if (idx === null) {
        return {
          reply   : `Please reply with the **number** (1–${data.appointments.length}) of the appointment you want to reschedule.`,
          newState: { flow: 'RESCHEDULE', step, data },
        };
      }

      const selected = data.appointments[idx];
      return {
        reply   : `You selected **Dr. ${selected.doctor_name}** (${selected.specialization})\n` +
                  `📅 Currently: ${formatDate(selected.date)} at ${formatTime12h(parseTimeToMinutes(selected.start_time))}\n\n` +
                  `What is your **preferred new date**? (e.g. "March 20" or "2026-03-20")`,
        newState: {
          flow: 'RESCHEDULE', step: 'AWAITING_DATE',
          data: { ...data, selectedAppointment: selected },
        },
      };
    }

    // ── Step 2: user gives a new date ────────────────────────────────────────
    case 'AWAITING_DATE': {
      const date = await extractDate(llm, message);
      if (!date) {
        return {
          reply   : "I couldn't recognise that date. Please provide a date like **March 20** or **2026-03-20**.",
          newState: { flow: 'RESCHEDULE', step, data },
        };
      }
      const [y, m, d] = date.split('-').map(Number);
      if (new Date(y, m - 1, d) < new Date(new Date().toDateString())) {
        return {
          reply   : 'Please choose a **future date** for rescheduling.',
          newState: { flow: 'RESCHEDULE', step, data },
        };
      }

      const slots = await getAvailableSlots(data.selectedAppointment.doctor_id, date);
      if (slots.length === 0) {
        return {
          reply   : `No available slots for **Dr. ${data.selectedAppointment.doctor_name}** on **${formatDate(date)}**.\n\nPlease try a different date.`,
          newState: { flow: 'RESCHEDULE', step, data },
        };
      }

      return {
        reply   : `Available slots with **Dr. ${data.selectedAppointment.doctor_name}** on **${formatDate(date)}**:\n\n` +
                  slots.map((s, i) => `${i + 1}. ${s.display}`).join('\n') +
                  '\n\nReply with the **slot number** you prefer.',
        newState: {
          flow: 'RESCHEDULE', step: 'SHOWING_SLOTS',
          data: { ...data, newDate: date, slots },
        },
      };
    }

    // ── Step 3: user picks a slot ────────────────────────────────────────────
    case 'SHOWING_SLOTS': {
      const idx = await extractSelection(llm, message, data.slots.map((s) => s.display));
      if (idx === null) {
        return {
          reply   : `Please reply with the **slot number** (1–${data.slots.length}).`,
          newState: { flow: 'RESCHEDULE', step, data },
        };
      }

      const slot  = data.slots[idx];
      const appt  = data.selectedAppointment;
      return {
        reply   : `Please confirm the reschedule:\n\n` +
                  `👨‍⚕️ **Doctor:** Dr. ${appt.doctor_name} (${appt.specialization})\n` +
                  `🔁 **From:** ${formatDate(appt.date)} at ${formatTime12h(parseTimeToMinutes(appt.start_time))}\n` +
                  `✅ **To:**   ${formatDate(data.newDate)} at ${slot.display}\n\n` +
                  `Type **confirm** to proceed or **cancel** to abort.`,
        newState: {
          flow: 'RESCHEDULE', step: 'AWAITING_CONFIRMATION',
          data: { ...data, selectedSlot: slot },
        },
      };
    }

    // ── Step 4: confirmation ─────────────────────────────────────────────────
    case 'AWAITING_CONFIRMATION': {
      const confirmed = await extractConfirmation(llm, message);
      if (!confirmed) {
        return {
          reply   : 'Reschedule cancelled. Is there anything else I can help you with?',
          newState: {},
        };
      }

      try {
        const appt = data.selectedAppointment;
        const slot = data.selectedSlot;
        const updated = await rescheduleAppointment(
          appt.id, patientId, data.newDate, slot.db_start, slot.db_end
        );
        if (!updated) throw new Error('Not updated');
        return {
          reply   : `✅ **Appointment rescheduled successfully!**\n\n` +
                    `👨‍⚕️ Dr. ${appt.doctor_name} (${appt.specialization})\n` +
                    `📅 **${formatDate(data.newDate)}** at **${slot.display}**\n\n` +
                    `You can view this in your **Patient Dashboard**. Is there anything else I can help you with?`,
          newState: {},
        };
      } catch (err) {
        console.error('[Chatbot] rescheduleAppointment error:', err.message);
        const errMsg = err.code === '23505'
          ? 'That slot was just booked by someone else. Please choose a different slot.'
          : 'Failed to reschedule. Please try again.';
        return {
          reply   : `❌ ${errMsg}`,
          newState: { flow: 'RESCHEDULE', step: 'SHOWING_SLOTS', data },
        };
      }
    }

    default:
      return { reply: 'Something went wrong. Please type **reschedule** to start over.', newState: {} };
  }
}

// ─── Book appointment flow ─────────────────────────────────────────────────────

async function handleBookStep(llm, patientId, message, step, data) {
  if (ABORT_RE.test(message)) {
    return {
      reply   : 'Booking cancelled. ✅\n\nWhat else can I help you with?\n\n📅 Type **reschedule** to change an appointment\n🩺 Type **book** to make a new appointment',
      newState: {},
    };
  }

  switch (step) {
    // ── Step 1: detect specialization from symptoms ──────────────────────────
    case 'AWAITING_SYMPTOMS': {
      const { specialization, reasoning } = await detectSpecialization(llm, message);
      const doctors = await getDoctorsBySpecialization(specialization);

      if (doctors.length === 0) {
        // Try General Physician as fallback
        const fallbackDocs = await getDoctorsBySpecialization('General Physician');
        if (fallbackDocs.length === 0) {
          return {
            reply   : `Based on your symptoms, you should see a **${specialization}**.\n\nUnfortunately no doctors of that type are currently available. Please visit the **Doctors** page to browse all available specialists.\n\n` +
                      `Would you like to try a different symptom description?`,
            newState: { flow: 'BOOK', step: 'AWAITING_SYMPTOMS', data: {} },
          };
        }
        return {
          reply   : `Based on your symptoms, you should see a **${specialization}**.\n\nNo ${specialization}s are available right now, but here are our **General Physicians** who can help initially:\n\n` +
                    fallbackDocs.map((d, i) =>
                      `${i + 1}. **Dr. ${d.name}**\n   ${d.specialization} • ${d.experience_years} yrs exp • Fee: ₹${d.consultation_fee}`
                    ).join('\n\n') +
                    '\n\nWhich doctor would you like to book? (Reply with the number)',
          newState: {
            flow: 'BOOK', step: 'SHOWING_DOCTORS',
            data: { symptoms: message, specialization, doctors: fallbackDocs },
          },
        };
      }

      return {
        reply   : `Based on your symptoms, I recommend consulting a **${specialization}**.\n` +
                  (reasoning ? `\n*${reasoning}*\n` : '') +
                  `\n**Available Doctors:**\n\n` +
                  doctors.map((d, i) =>
                    `${i + 1}. **Dr. ${d.name}**\n   ${d.specialization} • ${d.experience_years} yrs exp • Fee: ₹${d.consultation_fee}` +
                    (d.hospital_name ? `\n   🏥 ${d.hospital_name}` : '')
                  ).join('\n\n') +
                  '\n\nWhich doctor would you like to book? (Reply with the number)',
        newState: {
          flow: 'BOOK', step: 'SHOWING_DOCTORS',
          data: { symptoms: message, specialization, doctors },
        },
      };
    }

    // ── Step 2: user picks a doctor ──────────────────────────────────────────
    case 'SHOWING_DOCTORS': {
      const options = data.doctors.map((d) => `Dr. ${d.name} (${d.specialization})`);
      const idx     = await extractSelection(llm, message, options);

      if (idx === null) {
        return {
          reply   : `Please reply with the **number** (1–${data.doctors.length}) of the doctor you want.`,
          newState: { flow: 'BOOK', step, data },
        };
      }

      const doctor = data.doctors[idx];
      return {
        reply   : `You selected **Dr. ${doctor.name}** (${doctor.specialization}).\n\n` +
                  `What is your **preferred date** for the appointment? (e.g. "March 20" or "2026-03-20")`,
        newState: {
          flow: 'BOOK', step: 'AWAITING_DATE',
          data: { ...data, selectedDoctor: doctor },
        },
      };
    }

    // ── Step 3: user gives a date ────────────────────────────────────────────
    case 'AWAITING_DATE': {
      const date = await extractDate(llm, message);
      if (!date) {
        return {
          reply   : "I couldn't recognise that date. Please provide a date like **March 20** or **2026-03-20**.",
          newState: { flow: 'BOOK', step, data },
        };
      }
      const [y, m, d] = date.split('-').map(Number);
      if (new Date(y, m - 1, d) < new Date(new Date().toDateString())) {
        return {
          reply   : 'Please choose a **future date** for the appointment.',
          newState: { flow: 'BOOK', step, data },
        };
      }

      const slots = await getAvailableSlots(data.selectedDoctor.id, date);
      if (slots.length === 0) {
        return {
          reply   : `No available slots for **Dr. ${data.selectedDoctor.name}** on **${formatDate(date)}**.\n\nPlease try a different date.`,
          newState: { flow: 'BOOK', step, data },
        };
      }

      return {
        reply   : `Available slots with **Dr. ${data.selectedDoctor.name}** on **${formatDate(date)}**:\n\n` +
                  slots.map((s, i) => `${i + 1}. ${s.display}`).join('\n') +
                  '\n\nReply with the **slot number** you prefer.',
        newState: {
          flow: 'BOOK', step: 'SHOWING_SLOTS',
          data: { ...data, date, slots },
        },
      };
    }

    // ── Step 4: user picks a slot ────────────────────────────────────────────
    case 'SHOWING_SLOTS': {
      const idx = await extractSelection(llm, message, data.slots.map((s) => s.display));
      if (idx === null) {
        return {
          reply   : `Please reply with the **slot number** (1–${data.slots.length}).`,
          newState: { flow: 'BOOK', step, data },
        };
      }

      const slot   = data.slots[idx];
      const doctor = data.selectedDoctor;
      return {
        reply   : `Please confirm your booking:\n\n` +
                  `👨‍⚕️ **Doctor:** Dr. ${doctor.name} (${doctor.specialization})\n` +
                  `📅 **Date:** ${formatDate(data.date)}\n` +
                  `⏰ **Time:** ${slot.display}\n` +
                  `💳 **Fee:** ₹${doctor.consultation_fee}\n` +
                  (doctor.hospital_name ? `🏥 **Hospital:** ${doctor.hospital_name}\n` : '') +
                  `\nType **confirm** to book or **cancel** to abort.`,
        newState: {
          flow: 'BOOK', step: 'AWAITING_CONFIRMATION',
          data: { ...data, selectedSlot: slot },
        },
      };
    }

    // ── Step 5: confirmation ─────────────────────────────────────────────────
    case 'AWAITING_CONFIRMATION': {
      const confirmed = await extractConfirmation(llm, message);
      if (!confirmed) {
        return {
          reply   : 'Booking cancelled. Would you like to try again or do something else?',
          newState: {},
        };
      }

      try {
        const doctor = data.selectedDoctor;
        const slot   = data.selectedSlot;
        const appt   = await bookAppointment(
          patientId, doctor.id, data.date, slot.db_start, slot.db_end, data.symptoms
        );
        return {
          reply   : `✅ **Appointment booked successfully!**\n\n` +
                    `👨‍⚕️ Dr. ${doctor.name} (${doctor.specialization})\n` +
                    `📅 **${formatDate(data.date)}** at **${slot.display}**\n` +
                    `💳 Fee: ₹${doctor.consultation_fee}\n\n` +
                    `Your appointment is **pending confirmation** by the doctor.\n` +
                    `You can view and chat with your doctor from the **Patient Dashboard**.\n\n` +
                    `Is there anything else I can help you with?`,
          newState: {},
        };
      } catch (err) {
        console.error('[Chatbot] bookAppointment error:', err.message);
        const errMsg = err.code === '23505'
          ? 'That slot was just taken. Please choose a different slot.'
          : 'Failed to book the appointment. Please try again.';
        return {
          reply   : `❌ ${errMsg}`,
          newState: { flow: 'BOOK', step: 'SHOWING_SLOTS', data },
        };
      }
    }

    default:
      return { reply: 'Something went wrong. Please type **book** to start over.', newState: {} };
  }
}

// ─── Main entry point ──────────────────────────────────────────────────────────
/**
 * processMessage
 *
 * @param {string} conversationId  - UUID of the chatbot conversation
 * @param {string} patientId       - UUID of the logged-in patient
 * @param {string} userMessage     - The raw user message
 * @param {object} currentState    - JSONB state loaded from DB (may be {})
 * @param {Array}  history         - Array of {role, content} from DB
 * @returns {{ reply: string, newState: object }}
 */
async function processMessage(conversationId, patientId, userMessage, currentState, history) {
  const llm   = getLLM();
  const state = currentState || {};
  const { flow, step, data = {} } = state;

  // ── Active flow: route to the right handler ─────────────────────────────
  if (flow === 'RESCHEDULE') {
    return handleRescheduleStep(llm, patientId, userMessage, step, data);
  }
  if (flow === 'BOOK') {
    return handleBookStep(llm, patientId, userMessage, step, data);
  }

  // ── No active flow: detect intent ───────────────────────────────────────
  const intent = await detectIntent(llm, userMessage);

  if (intent === 'RESCHEDULE') {
    const appointments = await getUpcomingAppointments(patientId);
    if (appointments.length === 0) {
      return {
        reply   : `You don't have any upcoming appointments to reschedule.\n\nWould you like to **book a new appointment** instead? Just type **book** and describe your symptoms.`,
        newState: {},
      };
    }
    return {
      reply   : formatAppointmentsList(appointments) +
                '\n\nWhich appointment would you like to reschedule? Reply with the **number**.',
      newState: { flow: 'RESCHEDULE', step: 'SHOWING_APPOINTMENTS', data: { appointments } },
    };
  }

  if (intent === 'BOOK') {
    return {
      reply   : `I'll help you book an appointment! 🩺\n\nPlease **describe your symptoms** in detail and I'll suggest the right specialist for you.`,
      newState: { flow: 'BOOK', step: 'AWAITING_SYMPTOMS', data: {} },
    };
  }

  if (intent === 'CANCEL') {
    return {
      reply   : `To cancel an appointment:\n\n1. Go to your **Patient Dashboard**\n2. Find the appointment\n3. Click **Cancel** and provide a reason\n\nWould you like help with anything else?`,
      newState: {},
    };
  }

  // GENERAL — use LLM or rule-based
  const reply = await answerGeneralQuestion(llm, userMessage, history);
  return { reply, newState: {} };
}

module.exports = { processMessage };
