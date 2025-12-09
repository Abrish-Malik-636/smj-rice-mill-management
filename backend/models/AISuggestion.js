const mongoose = require("mongoose");

const aiSuggestionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["gatepass", "inventory", "pricing", "customer", "general"],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: String,
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
    },
    userId: String,
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "applied"],
      default: "pending",
    },
    appliedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("AISuggestion", aiSuggestionSchema);
