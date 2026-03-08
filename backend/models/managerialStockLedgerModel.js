const mongoose = require("mongoose");

const ManagerialStockLedgerSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    // ORDER = purchased/ordered but not yet received (does not count in available stock)
    // IN/OUT = received stock movements (counts in available stock)
    type: { type: String, enum: ["ORDER", "IN", "OUT"], required: true },
    itemName: { type: String, required: true, trim: true },
    category: { type: String, default: "", trim: true },
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
