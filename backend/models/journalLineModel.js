const mongoose = require("mongoose");

const journalLineSchema = new mongoose.Schema(
  {
    journalEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JournalEntry",
      required: true,
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    debit: { type: Number, default: 0, min: 0 },
    credit: { type: Number, default: 0, min: 0 },
    partyId: { type: String, default: "", trim: true },
    partyName: { type: String, default: "", trim: true },
    itemId: { type: String, default: "", trim: true },
    itemName: { type: String, default: "", trim: true },
    remarks: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

journalLineSchema.index({ journalEntryId: 1 });
journalLineSchema.index({ accountId: 1 });

module.exports = mongoose.model("JournalLine", journalLineSchema);

