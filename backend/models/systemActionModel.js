const mongoose = require("mongoose");

// Generic "action required" record for cross-app banners/popups.
// Example: remaining paddy decision when a production batch completes.
const SystemActionSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, trim: true }, // e.g. "PADDY_REMAINING_DECISION"
    status: {
      type: String,
      enum: ["PENDING", "RESOLVED", "CANCELLED"],
      default: "PENDING",
    },

    // Batch linkage (optional)
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: "ProductionBatch", default: null },
    batchNo: { type: String, default: "" },

    // Main payload for paddy decision
    brandName: { type: String, default: "" }, // sourceCompanyName/brand
    remainingPaddyKg: { type: Number, default: 0, min: 0 },

    // Resolution
    decision: { type: String, default: "" }, // e.g. "RETURN_TO_STOCK" | "KEEP_IN_BATCH"
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

SystemActionSchema.index({ type: 1, status: 1, createdAt: -1 });
SystemActionSchema.index({ batchId: 1, type: 1, status: 1 });

module.exports = mongoose.model("SystemAction", SystemActionSchema);

