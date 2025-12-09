const AIChat = require("../models/AIChat");
const AISuggestion = require("../models/AISuggestion");

// ============ CHATBOT ENDPOINTS ============

// Send message to AI chatbot
exports.sendMessage = async (req, res) => {
  try {
    const { sessionId, message, context } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({
        success: false,
        message: "Session ID and message are required",
      });
    }

    // TODO: Integrate with AI service (OpenAI, Gemini, etc.)
    // For now, return placeholder response
    const aiResponse = {
      role: "assistant",
      content: "AI response placeholder - Integration pending",
      timestamp: new Date(),
    };

    // Find or create chat session
    let chat = await AIChat.findOne({ sessionId, active: true });

    if (!chat) {
      chat = new AIChat({
        userId: req.body.userId || "anonymous",
        sessionId,
        context: context || "general",
        messages: [],
      });
    }

    // Add user message
    chat.messages.push({
      role: "user",
      content: message,
      timestamp: new Date(),
    });

    // Add AI response
    chat.messages.push(aiResponse);

    await chat.save();

    res.json({
      success: true,
      data: {
        response: aiResponse.content,
        sessionId: chat.sessionId,
        messageCount: chat.messages.length,
      },
    });
  } catch (error) {
    console.error("AI chat error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to process message",
    });
  }
};

// Get chat history
exports.getChatHistory = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const chat = await AIChat.findOne({ sessionId, active: true });

    if (!chat) {
      return res.json({
        success: true,
        data: { messages: [] },
      });
    }

    res.json({
      success: true,
      data: {
        messages: chat.messages,
        context: chat.context,
        sessionId: chat.sessionId,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Clear chat history
exports.clearChat = async (req, res) => {
  try {
    const { sessionId } = req.params;

    await AIChat.findOneAndUpdate(
      { sessionId },
      { active: false },
      { new: true }
    );

    res.json({
      success: true,
      message: "Chat history cleared",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============ SUGGESTIONS ENDPOINTS ============

// Get AI suggestions
exports.getSuggestions = async (req, res) => {
  try {
    const { type, status } = req.query;

    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;

    // TODO: Generate AI suggestions based on data analysis
    // For now, return mock suggestions
    const suggestions = await AISuggestion.find(filter)
      .sort({ priority: -1, createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      data: suggestions,
      message: "AI suggestions placeholder - Integration pending",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Create suggestion
exports.createSuggestion = async (req, res) => {
  try {
    const suggestion = new AISuggestion(req.body);
    await suggestion.save();

    res.status(201).json({
      success: true,
      data: suggestion,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update suggestion status
exports.updateSuggestionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const suggestion = await AISuggestion.findByIdAndUpdate(
      id,
      {
        status,
        appliedAt: status === "applied" ? new Date() : undefined,
      },
      { new: true }
    );

    if (!suggestion) {
      return res.status(404).json({
        success: false,
        message: "Suggestion not found",
      });
    }

    res.json({
      success: true,
      data: suggestion,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete suggestion
exports.deleteSuggestion = async (req, res) => {
  try {
    const { id } = req.params;

    await AISuggestion.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Suggestion deleted",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
