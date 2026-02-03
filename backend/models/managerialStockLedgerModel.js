const mongoose = require("mongoose");

const ManagerialStockLedgerSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    type: { type: String, enum: ["IN", "OUT"], required: true },
    itemName: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, default: "pcs" },
    sourceType: { type: String, default: "Gate Pass" },
    refNo: { type: String, default: "" },
    gatePassId: { type: mongoose.Schema.Types.ObjectId, default: null },
    gatePassNo: { type: String, default: "" },
    transactionId: { type: mongoose.Schema.Types.ObjectId, default: null },
    remarks: { type: String, default: "" },
  },
  { timestamps: true }
);

ManagerialStockLedgerSchema.index({ date: 1 });
ManagerialStockLedgerSchema.index({ itemName: 1 });

module.exports = mongoose.model("ManagerialStockLedger", ManagerialStockLedgerSchema);
