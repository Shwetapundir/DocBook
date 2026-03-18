'use strict';

const pool = require('../config/db');
const { processMessage } = require('../services/langchainChatbotService');

// ─── Helper: verify conversation belongs to user ───────────────────────────────
async function verifyOwnership(convId, userId, activeOnly = false) {
  const query = activeOnly
    ? 'SELECT id FROM chatbot_conversations WHERE id = $1 AND user_id = $2 AND is_active = true'
    : 'SELECT id FROM chatbot_conversations WHERE id = $1 AND user_id = $2';
  const { rows } = await pool.query(query, [convId, userId]);
  return rows.length > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chatbot/conversations
// Returns the active conversation for the user, or creates a new one.
// Output: { success, conversation: { id, title, created_at, updated_at } }
// ─────────────────────────────────────────────────────────────────────────────
const getOrCreateConversation = async (req, res) => {
  const userId = req.user.id;
  try {
    const existing = await pool.query(
      `SELECT id, title, created_at, updated_at
         FROM chatbot_conversations
        WHERE user_id = $1 AND is_active = true
        ORDER BY updated_at DESC
        LIMIT 1`,
      [userId]
    );

    if (existing.rows.length > 0) {
      return res.json({ success: true, conversation: existing.rows[0] });
    }

    const created = await pool.query(
      `INSERT INTO chatbot_conversations (user_id)
       VALUES ($1)
       RETURNING id, title, created_at, updated_at`,
      [userId]
    );
    res.status(201).json({ success: true, conversation: created.rows[0] });
  } catch (err) {
    console.error('[Chatbot] getOrCreateConversation:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chatbot/conversations/new
// Deactivates all previous conversations and starts a fresh one.
// Output: { success, conversation: { id, title, created_at, updated_at } }
// ─────────────────────────────────────────────────────────────────────────────
const createNewConversation = async (req, res) => {
  const userId = req.user.id;
  try {
    await pool.query(
      'UPDATE chatbot_conversations SET is_active = false WHERE user_id = $1',
      [userId]
    );
    const { rows } = await pool.query(
      `INSERT INTO chatbot_conversations (user_id)
       VALUES ($1)
       RETURNING id, title, created_at, updated_at`,
      [userId]
    );
    res.status(201).json({ success: true, conversation: rows[0] });
  } catch (err) {
    console.error('[Chatbot] createNewConversation:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chatbot/conversations/:id/messages
// Returns all messages in a conversation, oldest first.
// Output: { success, messages: [{ id, role, content, created_at }] }
// ─────────────────────────────────────────────────────────────────────────────
const getMessages = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  try {
    const owns = await verifyOwnership(id, userId);
    if (!owns) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { rows } = await pool.query(
      `SELECT id, role, content, created_at
         FROM chatbot_messages
        WHERE conversation_id = $1
        ORDER BY created_at ASC`,
      [id]
    );
    res.json({ success: true, messages: rows });
  } catch (err) {
    console.error('[Chatbot] getMessages:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chatbot/conversations/:id/messages
//
// Flow:
//   1. Validate input
//   2. Load current conversation state (JSONB) from DB
//   3. Save user message
//   4. Load message history for context
//   5. Call processMessage → { reply, newState }
//   6. Save AI reply
//   7. Persist updated state back to conversation
//
// Input:  :id (UUID), body: { message: string }
// Output: { success, message: { id, role, content, created_at } }
// ─────────────────────────────────────────────────────────────────────────────
const sendMessage = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { message } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ success: false, message: 'Message is required' });
  }
  if (message.length > 1000) {
    return res.status(400).json({ success: false, message: 'Message too long (max 1000 characters)' });
  }

  try {
    // 1. Load conversation + state (also verifies ownership)
    const convResult = await pool.query(
      `SELECT id, state
         FROM chatbot_conversations
        WHERE id = $1 AND user_id = $2 AND is_active = true`,
      [id, userId]
    );
    if (convResult.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const currentState = convResult.rows[0].state || {};
    const userText     = message.trim();

    // 2. Save user message
    await pool.query(
      'INSERT INTO chatbot_messages (conversation_id, role, content) VALUES ($1, $2, $3)',
      [id, 'user', userText]
    );

    // 3. Fetch conversation history for LLM context (last 20 messages, excluding the one just saved)
    const history = await pool.query(
      `SELECT role, content
         FROM chatbot_messages
        WHERE conversation_id = $1
        ORDER BY created_at ASC
        LIMIT 20`,
      [id]
    );

    // 4. Run AI / state machine
    const { reply: aiReply, newState } = await processMessage(
      id, userId, userText, currentState, history.rows
    );

    // 5. Save AI reply
    const saved = await pool.query(
      `INSERT INTO chatbot_messages (conversation_id, role, content)
       VALUES ($1, $2, $3)
       RETURNING id, role, content, created_at`,
      [id, 'assistant', aiReply]
    );

    // 6. Persist updated state + touch timestamp
    await pool.query(
      `UPDATE chatbot_conversations
          SET state = $1, updated_at = NOW()
        WHERE id = $2`,
      [JSON.stringify(newState), id]
    );

    res.json({ success: true, message: saved.rows[0] });
  } catch (err) {
    console.error('[Chatbot] sendMessage:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getOrCreateConversation, createNewConversation, getMessages, sendMessage };
