const mongoose = require("mongoose");

const ExpenseEntrySchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "ExpenseCategory" },
    categoryName: { type: String, trim: true, required: true },
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: ["CASH", "BANK", "ONLINE"],
      default: "CASH",
    },
    remarks: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

ExpenseEntrySchema.index({ date: 1 });
ExpenseEntrySchema.index({ categoryName: 1 });

module.exports = mongoose.model("ExpenseEntry", ExpenseEntrySchema);
