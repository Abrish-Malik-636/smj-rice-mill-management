const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");

// ============ CHATBOT ROUTES ============
router.get("/config", aiController.getConfig);
router.post("/chat/message", aiController.sendMessage);
router.get("/chat/history/:sessionId", aiController.getChatHistory);
router.delete("/chat/clear/:sessionId", aiController.clearChat);

module.exports = router;
