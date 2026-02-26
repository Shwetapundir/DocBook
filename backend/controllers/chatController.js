// backend/controllers/chatController.js
const pool = require("../config/db");

// ── Get or create a conversation (patient only) ──────────────
// Security: only allowed if a real appointment exists
const getOrCreateConversation = async (req, res, next) => {
  try {
    const { doctor_id } = req.body;
    const patient_id    = req.user.id;

    if (!doctor_id) {
      return res.status(400).json({ success: false, message: "doctor_id is required" });
    }

    // Must have at least one non-cancelled appointment
    const apptCheck = await pool.query(
      `SELECT id FROM appointments
       WHERE patient_id = $1 AND doctor_id = $2
         AND status NOT IN ('cancelled')
       LIMIT 1`,
      [patient_id, doctor_id]
    );

    if (!apptCheck.rows.length) {
      return res.status(403).json({
        success: false,
        message: "You can only chat with doctors you have a confirmed appointment with."
      });
    }

    const appointment_id = apptCheck.rows[0].id;

    // Return existing conversation if found
    const existing = await pool.query(
      `SELECT c.*, u.full_name AS other_name, dp.specialization AS other_specialization
       FROM conversations c
       JOIN users u ON u.id = c.doctor_id
       LEFT JOIN doctor_profiles dp ON dp.user_id = c.doctor_id
       WHERE c.patient_id = $1 AND c.doctor_id = $2`,
      [patient_id, doctor_id]
    );

    if (existing.rows.length) {
      return res.json({ success: true, conversation: existing.rows[0] });
    }

    // Create new conversation
    const created = await pool.query(
      `INSERT INTO conversations (patient_id, doctor_id, appointment_id)
       VALUES ($1, $2, $3) RETURNING id`,
      [patient_id, doctor_id, appointment_id]
    );

    const conv = await pool.query(
      `SELECT c.*, u.full_name AS other_name, dp.specialization AS other_specialization
       FROM conversations c
       JOIN users u ON u.id = c.doctor_id
       LEFT JOIN doctor_profiles dp ON dp.user_id = c.doctor_id
       WHERE c.id = $1`,
      [created.rows[0].id]
    );

    res.status(201).json({ success: true, conversation: conv.rows[0] });
  } catch (err) { next(err); }
};

// ── Get all conversations for logged-in user ─────────────────
const getMyConversations = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const role   = req.user.role;
    let result;

    if (role === "patient") {
      result = await pool.query(
        `SELECT c.*,
           u.full_name AS other_name,
           dp.specialization AS other_specialization,
           (SELECT COUNT(*) FROM messages m
            WHERE m.conversation_id = c.id
              AND m.is_read = false
              AND m.sender_id != $1) AS unread_count
         FROM conversations c
         JOIN users u ON u.id = c.doctor_id
         LEFT JOIN doctor_profiles dp ON dp.user_id = c.doctor_id
         WHERE c.patient_id = $1
         ORDER BY c.last_message_at DESC NULLS LAST`,
        [userId]
      );
    } else {
      // doctor
      result = await pool.query(
        `SELECT c.*,
           u.full_name AS other_name,
           NULL AS other_specialization,
           (SELECT COUNT(*) FROM messages m
            WHERE m.conversation_id = c.id
              AND m.is_read = false
              AND m.sender_id != $1) AS unread_count
         FROM conversations c
         JOIN users u ON u.id = c.patient_id
         WHERE c.doctor_id = $1
         ORDER BY c.last_message_at DESC NULLS LAST`,
        [userId]
      );
    }

    res.json({ success: true, conversations: result.rows });
  } catch (err) { next(err); }
};

// ── Get messages for a conversation ──────────────────────────
const getMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Security check: user must belong to this conversation
    const access = await pool.query(
      `SELECT id FROM conversations
       WHERE id = $1 AND (patient_id = $2 OR doctor_id = $2)`,
      [conversationId, userId]
    );
    if (!access.rows.length) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const result = await pool.query(
      `SELECT m.*, u.full_name AS sender_name, u.role AS sender_role
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC`,
      [conversationId]
    );

    // Mark incoming messages as read
    await pool.query(
      `UPDATE messages SET is_read = true
       WHERE conversation_id = $1 AND sender_id != $2 AND is_read = false`,
      [conversationId, userId]
    );

    res.json({ success: true, messages: result.rows });
  } catch (err) { next(err); }
};

// ── Send a message ────────────────────────────────────────────
const sendMessage = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { message }        = req.body;
    const userId             = req.user.id;

    if (!message?.trim()) {
      return res.status(400).json({ success: false, message: "Message cannot be empty" });
    }

    // Security check
    const access = await pool.query(
      `SELECT id FROM conversations
       WHERE id = $1 AND (patient_id = $2 OR doctor_id = $2)`,
      [conversationId, userId]
    );
    if (!access.rows.length) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const text = message.trim();

    // Insert message
    const inserted = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, message)
       VALUES ($1, $2, $3) RETURNING id`,
      [conversationId, userId, text]
    );

    // Update conversation preview
    await pool.query(
      `UPDATE conversations
       SET last_message = $1, last_message_at = NOW()
       WHERE id = $2`,
      [text.slice(0, 100), conversationId]
    );

    // Return full message with sender info
    const msg = await pool.query(
      `SELECT m.*, u.full_name AS sender_name, u.role AS sender_role
       FROM messages m JOIN users u ON u.id = m.sender_id
       WHERE m.id = $1`,
      [inserted.rows[0].id]
    );

    res.status(201).json({ success: true, message: msg.rows[0] });
  } catch (err) { next(err); }
};

module.exports = {
  getOrCreateConversation,
  getMyConversations,
  getMessages,
  sendMessage
};
