const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");

// ============ CHATBOT ROUTES ============
router.post("/chat/message", aiController.sendMessage);
router.get("/chat/history/:sessionId", aiController.getChatHistory);
router.delete("/chat/clear/:sessionId", aiController.clearChat);

// ============ SUGGESTIONS ROUTES ============
router.get("/suggestions", aiController.getSuggestions);
router.post("/suggestions", aiController.createSuggestion);
router.patch("/suggestions/:id/status", aiController.updateSuggestionStatus);
router.delete("/suggestions/:id", aiController.deleteSuggestion);

module.exports = router;
