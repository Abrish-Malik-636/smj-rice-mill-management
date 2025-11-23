// backend/models/stockLedgerModel.js
const mongoose = require("mongoose");

const StockLedgerSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },

    // IN = stock increase, OUT = stock decrease, ADJUSTMENT = manual
    type: {
      type: String,
      enum: ["IN", "OUT", "ADJUSTMENT"],
      required: true,
    },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
    },
    companyName: { type: String, default: "" },

    productTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductType",
      default: null,
    },
    productTypeName: { type: String, default: "" },

    numBags: { type: Number, default: 0 },
    netWeightKg: { type: Number, required: true, min: 0 },

    gatePassId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    gatePassNo: { type: String, default: "" },

    remarks: { type: String, default: "" },
  },
  { timestamps: true }
);

StockLedgerSchema.index({ date: 1 });
StockLedgerSchema.index({ productTypeId: 1, companyId: 1 });

module.exports = mongoose.model("StockLedger", StockLedgerSchema);
