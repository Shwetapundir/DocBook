'use strict';

const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { authenticate } = require('../middleware/auth');
const {
  getOrCreateConversation,
  createNewConversation,
  getMessages,
  sendMessage,
} = require('../controllers/chatbotController');

// Stricter limiter on the AI message endpoint to prevent abuse / excessive API costs.
// 20 messages per minute per IP — generous enough for real users, blocks bots.
const msgLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many messages. Please wait a moment before sending again.' },
});

// All chatbot routes require a valid JWT
router.use(authenticate);

// POST /api/chatbot/conversations        → get or create active conversation
router.post('/conversations', getOrCreateConversation);

// POST /api/chatbot/conversations/new    → force-start a new conversation
router.post('/conversations/new', createNewConversation);

// GET  /api/chatbot/conversations/:id/messages → fetch message history
router.get('/conversations/:id/messages', getMessages);

// POST /api/chatbot/conversations/:id/messages → send message + get AI reply
router.post('/conversations/:id/messages', msgLimiter, sendMessage);

module.exports = router;
