'use strict';

// ─── Symptom → Specialisation map ─────────────────────────────────────────────
// Each entry: keywords (lowercase substrings to match) + suggested specialization.
const SYMPTOM_MAP = [
  {
    keywords: ['chest pain', 'heart pain', 'palpitation', 'irregular heartbeat',
               'heart flutter', 'angina', 'arrhythmia', 'heart racing'],
    spec: 'Cardiologist', desc: 'a heart specialist',
  },
  {
    keywords: ['skin rash', 'acne', 'eczema', 'psoriasis', 'dermatitis', 'hives',
               'itchy skin', 'skin problem', 'skin allergy', 'skin infection',
               'dark spots', 'pigmentation'],
    spec: 'Dermatologist', desc: 'a skin specialist',
  },
  {
    keywords: ['headache', 'migraine', 'seizure', 'epilepsy', 'memory loss',
               'stroke', 'nerve pain', 'tremor', 'numbness in hand', 'dizziness',
               'brain fog', 'confusion', 'paralysis', 'vertigo'],
    spec: 'Neurologist', desc: 'a brain & nerve specialist',
  },
  {
    keywords: ['broken bone', 'fracture', 'joint pain', 'knee pain', 'back pain',
               'spinal', 'arthritis', 'sports injury', 'bone pain', 'shoulder pain',
               'hip pain', 'neck pain', 'slip disc', 'sciatica'],
    spec: 'Orthopedist', desc: 'a bone & joint specialist',
  },
  {
    keywords: ['fever', 'cold', 'flu', 'cough', 'fatigue', 'weakness', 'body ache',
               'common cold', 'viral infection', 'general checkup', 'vaccination',
               'general weakness', 'malaise'],
    spec: 'General Physician', desc: 'a general physician',
  },
  {
    keywords: ['stomach pain', 'acidity', 'gas', 'bloating', 'diarrhea',
               'constipation', 'nausea', 'vomiting', 'gastritis', 'ulcer',
               'indigestion', 'ibs', 'liver', 'jaundice', 'acid reflux'],
    spec: 'Gastroenterologist', desc: 'a digestive system specialist',
  },
  {
    keywords: ['eye pain', 'blurred vision', 'eye infection', 'cataract',
               'vision problem', 'spectacle', 'eye strain', 'red eye',
               'glaucoma', 'dry eyes'],
    spec: 'Ophthalmologist', desc: 'an eye specialist',
  },
  {
    keywords: ['ear pain', 'hearing loss', 'ear infection', 'sore throat', 'tonsil',
               'nose bleed', 'sinusitis', 'ent', 'nasal', 'throat pain',
               'voice hoarse', 'runny nose', 'blocked nose', 'snoring'],
    spec: 'ENT Specialist', desc: 'an ear, nose & throat specialist',
  },
  {
    keywords: ['child', 'baby', 'pediatric', 'kid', 'infant', 'newborn',
               'childhood', 'toddler', 'my son', 'my daughter', 'my child'],
    spec: 'Pediatrician', desc: "a children's health specialist",
  },
  {
    keywords: ['pregnancy', 'gynecology', 'menstrual', 'period pain', 'fertility',
               'ovary', 'uterus', 'ovarian cyst', 'pcos', 'pcod', 'irregular period',
               'menopause', 'vaginal', 'breast lump', 'contraception'],
    spec: 'Gynecologist', desc: "a women's health specialist",
  },
  {
    keywords: ['depression', 'anxiety', 'stress', 'mental health', 'panic attack',
               'phobia', 'insomnia', 'bipolar', 'schizophrenia', 'ocd',
               'hallucination', 'suicidal', 'eating disorder', 'ptsd'],
    spec: 'Psychiatrist', desc: 'a mental health specialist',
  },
  {
    keywords: ['blood sugar', 'diabetes', 'thyroid', 'hormone imbalance', 'obesity',
               'weight gain', 'weight loss', 'endocrine', 'adrenal', 'growth'],
    spec: 'Endocrinologist', desc: 'a hormone specialist',
  },
  {
    keywords: ['kidney pain', 'kidney stone', 'urinary infection', 'frequent urination',
               'uti', 'renal', 'urine problem', 'prostate', 'bladder'],
    spec: 'Nephrologist / Urologist', desc: 'a kidney & urinary specialist',
  },
  {
    keywords: ['lung', 'asthma', 'breathe', 'breathing problem', 'copd',
               'tuberculosis', 'tb', 'pneumonia', 'chest tightness',
               'wheezing', 'bronchitis', 'oxygen'],
    spec: 'Pulmonologist', desc: 'a lung & breathing specialist',
  },
  {
    keywords: ['cancer', 'tumor', 'chemotherapy', 'oncology', 'lymphoma',
               'leukaemia', 'radiation', 'biopsy'],
    spec: 'Oncologist', desc: 'a cancer specialist',
  },
  {
    keywords: ['teeth', 'tooth', 'gum', 'cavity', 'dental', 'oral', 'toothache',
               'wisdom tooth', 'bleeding gum', 'tooth sensitivity'],
    spec: 'Dentist', desc: 'a dental specialist',
  },
  {
    keywords: ['blood pressure', 'hypertension', 'low blood pressure', 'high bp', 'low bp'],
    spec: 'Cardiologist / General Physician', desc: 'a heart or general physician',
  },
  {
    keywords: ['allergy', 'allergic', 'food allergy', 'dust allergy', 'sneezing', 'asthma attack'],
    spec: 'Allergist / Immunologist', desc: 'an allergy & immune system specialist',
  },
];

// ─── Booking FAQ map ───────────────────────────────────────────────────────────
const BOOKING_FAQS = [
  {
    keywords: ['how to book', 'how do i book', 'book appointment',
               'schedule appointment', 'make appointment', 'steps to book'],
    answer: `Here's how to book an appointment on DocBook:\n\n1. Go to the **Doctors** page\n2. Browse or search doctors by specialization\n3. Click on a doctor's profile\n4. Click **Book Appointment**\n5. Select your preferred date & time slot\n6. Confirm the booking\n\nYour appointment will appear in your **Patient Dashboard**. 📅`,
  },
  {
    keywords: ['cancel appointment', 'how to cancel', 'cancel booking', 'undo appointment'],
    answer: `To cancel an appointment:\n\n1. Open your **Patient Dashboard**\n2. Find the appointment\n3. Click the **Cancel** button\n4. Provide a cancellation reason\n\n⚠️ Please cancel well in advance as a courtesy to the doctor.`,
  },
  {
    keywords: ['reschedule', 'change appointment', 'change timing', 'change date', 'postpone'],
    answer: `To reschedule, currently you need to:\n\n1. **Cancel** the existing appointment from your dashboard\n2. **Book a new appointment** with your preferred date & time\n\nTip: Check available slots on the doctor's booking page first. 🗓️`,
  },
  {
    keywords: ['consultation fee', 'cost', 'price', 'how much', 'charges', 'fees', 'payment'],
    answer: `Each doctor sets their own **consultation fee**, which is displayed on their profile card before booking.\n\nYou can see the exact fee on the **Book Appointment** page before confirming. 💳`,
  },
  {
    keywords: ['chat with doctor', 'message doctor', 'talk to doctor', 'contact doctor', 'how to chat'],
    answer: `To chat with your doctor:\n\n1. Go to your **Patient Dashboard**\n2. Find your confirmed appointment\n3. Click the **Chat** button\n\n💬 Note: Chat is available only after you have a booked appointment with the doctor.`,
  },
  {
    keywords: ['timing', 'best time', 'when to book', 'morning slot', 'evening slot', 'time to visit'],
    answer: `Tips for choosing the right appointment time:\n\n⏰ **Morning (9am–12pm)**: Best for fasting tests or routine checkups\n🌤️ **Afternoon (12pm–4pm)**: Generally less crowded\n🌆 **Evening (4pm–7pm)**: Good if you have daytime commitments\n\nAlways check the doctor's actual available slots on their profile. Book early to secure your preferred slot!`,
  },
  {
    keywords: ['what to bring', 'what documents', 'medical records', 'reports', 'what to carry'],
    answer: `Before visiting a doctor, it helps to bring:\n\n📋 Previous medical reports or test results\n💊 List of current medications\n🆔 ID proof\n📝 Insurance card (if applicable)\n\nFor follow-up visits, always carry your previous prescription.`,
  },
  {
    keywords: ['find doctor', 'search doctor', 'which doctor', 'look for doctor'],
    answer: `To find the right doctor:\n\n1. Visit the **Doctors** page\n2. Use the **search bar** to search by name\n3. Use the **specialization filter** to narrow results\n4. Click on a doctor card to see their full profile, experience, and fees\n\nAll doctors on DocBook are verified and approved by our admin team. ✅`,
  },
  {
    keywords: ['register', 'sign up', 'create account', 'new account', 'join'],
    answer: `To create an account on DocBook:\n\n1. Click **Register** in the top menu\n2. Fill in your name, email, and password\n3. Select your role (**Patient** to book appointments)\n4. Submit the form — you're instantly logged in!\n\nPatients can immediately browse doctors and book appointments. 🎉`,
  },
];

// ─── Disclaimer appended to every reply ───────────────────────────────────────
const DISCLAIMER =
  '\n\n---\n⚕️ *Disclaimer: This is general information only. Always consult a qualified doctor for medical advice and diagnosis.*';

// ─── Intent detection ──────────────────────────────────────────────────────────
function detectIntent(text) {
  const t = text.toLowerCase().trim();
  if (/^(hi|hello|hey|good morning|good evening|good afternoon|howdy|namaste|greetings)\b/.test(t))
    return 'greeting';
  if (/\b(thank|thanks|thank you|thnx|thx|appreciate)\b/.test(t))
    return 'thanks';
  if (/\b(bye|goodbye|see you|cya|take care|exit|close|quit|stop)\b/.test(t))
    return 'goodbye';
  if (/\b(help|what can you do|capabilities|features|menu|options|commands)\b/.test(t))
    return 'help';
  if (/\b(emergency|ambulance|urgent|critical|dying|collapsed|unconscious|not breathing|overdose)\b/.test(t))
    return 'emergency';
  if (/\b(diagnosis|diagnose|what disease|what illness|do i have|tell me my disease)\b/.test(t))
    return 'diagnosis_request';
  return null;
}

// ─── Rule-based reply generator ────────────────────────────────────────────────
function generateRuleBasedReply(userMessage) {
  const intent = detectIntent(userMessage);

  if (intent === 'greeting') {
    return (
      `Hello! 👋 I'm **DocBot**, your AI health assistant.\n\n` +
      `I can help you:\n` +
      `🩺 **Suggest a specialist** based on your symptoms\n` +
      `📅 **Guide you through booking** an appointment\n` +
      `💬 **Answer questions** about how DocBook works\n` +
      `⏰ **Advise on appointment timing**\n\n` +
      `Just describe your symptoms or ask me anything!` +
      DISCLAIMER
    );
  }

  if (intent === 'thanks') {
    return `You're welcome! 😊 Feel free to ask anytime.\n\nStay healthy! 💙` + DISCLAIMER;
  }

  if (intent === 'goodbye') {
    return (
      `Take care! 👋 Remember, your health is your greatest wealth.\n\n` +
      `I'm here whenever you need help again.` +
      DISCLAIMER
    );
  }

  if (intent === 'emergency') {
    return (
      `🚨 **MEDICAL EMERGENCY**\n\n` +
      `If this is life-threatening:\n\n` +
      `📞 **Call 112 (Emergency)** or **108 (Ambulance)** immediately\n` +
      `🏥 Go to the **nearest Emergency Room**\n\n` +
      `**Do NOT wait** for an online consultation in emergencies.` +
      DISCLAIMER
    );
  }

  if (intent === 'diagnosis_request') {
    return (
      `I'm not able to provide a medical diagnosis — only a qualified doctor can do that.\n\n` +
      `However, I can help you **find the right type of specialist** based on your symptoms.\n\n` +
      `Tell me what symptoms you're experiencing (e.g., *"I have chest pain and shortness of breath"*) and I'll suggest who to see.` +
      DISCLAIMER
    );
  }

  if (intent === 'help') {
    return (
      `Here's what I can help you with:\n\n` +
      `🩺 **Symptom Check** – Describe symptoms, I'll suggest a specialist\n` +
      `📅 **Booking Help** – How to book, cancel, or manage appointments\n` +
      `⏰ **Timing Advice** – Best time to visit a doctor\n` +
      `💬 **Chat Feature** – How to message your doctor\n` +
      `📋 **Visit Prep** – What to bring to your appointment\n\n` +
      `*Example:* "I have a headache and blurred vision" or "how do I cancel an appointment?"` +
      DISCLAIMER
    );
  }

  // Booking FAQ match
  const lower = userMessage.toLowerCase();
  for (const faq of BOOKING_FAQS) {
    if (faq.keywords.some((kw) => lower.includes(kw))) {
      return faq.answer + DISCLAIMER;
    }
  }

  // Symptom match
  for (const entry of SYMPTOM_MAP) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return (
        `Based on what you described, I'd recommend consulting a **${entry.spec}** (${entry.desc}).\n\n` +
        `📋 **Next steps:**\n` +
        `1. Go to the **Doctors** page\n` +
        `2. Filter or search for a **${entry.spec}**\n` +
        `3. View profiles and **Book an Appointment** at a convenient time\n\n` +
        `You can also chat with your doctor through DocBook after booking.` +
        DISCLAIMER
      );
    }
  }

  // Default fallback
  return (
    `I'm not sure I fully understood that. Here are some things you can ask me:\n\n` +
    `• *"I have a headache and dizziness"* → I'll suggest a specialist\n` +
    `• *"How do I book an appointment?"* → Step-by-step guide\n` +
    `• *"Best time to visit a doctor?"* → Timing tips\n` +
    `• *"What documents to bring?"* → Visit preparation\n\n` +
    `Type **help** to see all options.` +
    DISCLAIMER
  );
}

// ─── OpenAI-powered reply (used only when OPENAI_API_KEY is set) ───────────────
async function generateAIReply(messageHistory) {
  // messageHistory: Array of { role: 'user'|'assistant', content: string }
  const lastUserMsg = [...messageHistory].reverse().find((m) => m.role === 'user');

  if (!process.env.OPENAI_API_KEY) {
    // No API key → use rule-based
    return generateRuleBasedReply(lastUserMsg ? lastUserMsg.content : '');
  }

  try {
    // Dynamically import — only runs when the openai package is installed
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const systemPrompt = {
      role: 'system',
      content:
        `You are DocBot, a helpful AI health assistant on DocBook, a doctor appointment booking platform.\n\n` +
        `Your purpose:\n` +
        `- Help patients identify which doctor specialization to consult based on symptoms\n` +
        `- Guide users through appointment booking on DocBook\n` +
        `- Answer general health and wellness questions\n` +
        `- Suggest appropriate appointment timing\n\n` +
        `Rules you MUST follow:\n` +
        `1. NEVER provide a final medical diagnosis\n` +
        `2. ALWAYS end every response with: "⚕️ Disclaimer: Consult a qualified doctor for medical advice."\n` +
        `3. Keep responses under 200 words and well-structured\n` +
        `4. For emergencies, ALWAYS direct to call 112 / 108 FIRST\n` +
        `5. Never suggest specific drug names, dosages, or treatments\n` +
        `6. Be warm, empathetic, and professional`,
    };

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [systemPrompt, ...messageHistory.slice(-10)], // last 10 for context
      max_tokens: 350,
      temperature: 0.7,
    });

    return completion.choices[0].message.content;
  } catch (err) {
    console.error('[ChatbotService] OpenAI error, falling back to rule-based:', err.message);
    return generateRuleBasedReply(lastUserMsg ? lastUserMsg.content : '');
  }
}

module.exports = { generateAIReply };
