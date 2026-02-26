// backend/routes/chatRoutes.js
const express = require("express");
const router  = express.Router();
const {
  getOrCreateConversation,
  getMyConversations,
  getMessages,
  sendMessage
} = require("../controllers/chatController");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate);

router.get("/conversations",                              getMyConversations);
router.post("/conversations",       authorize("patient"), getOrCreateConversation);
router.get("/conversations/:conversationId/messages",    getMessages);
router.post("/conversations/:conversationId/messages",   sendMessage);

module.exports = router;
