// backend/models/gatePassModel.js
const mongoose = require("mongoose");

const GatePassSchema = new mongoose.Schema(
  {
    gatePassNo: { type: String, required: true, unique: true }, // GP-YYYYMMDD-HHMMSS
    type: { type: String, enum: ["IN", "OUT"], required: true },

    date: { type: Date, required: true },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    companyName: { type: String, required: true },

    productTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductType",
      required: true,
    },
    productTypeName: { type: String, required: true },

    numBags: { type: Number, required: true, min: 0 },
    bagWeightKg: { type: Number, required: true, min: 0 }, // gross weight per bag
    emptyBagWeightKg: { type: Number, required: true, min: 0 }, // empty bag weight per bag
    netWeightKg: { type: Number, required: true, min: 0 }, // computed: numBags * (bagWeightKg - emptyBagWeightKg)

    // OUT-only fields (nullable for IN)
    rate: { type: Number, default: 0, min: 0 },
    rateType: { type: String, enum: ["per_bag", "per_kg"], default: "per_bag" },
    totalAmount: { type: Number, default: 0, min: 0 }, // computed for OUT
    sendTo: { type: String, default: "" },

    remarks: { type: String, default: "" },
  },
  { timestamps: true }
);

// Ensure a simple index on date for stats queries
GatePassSchema.index({ date: 1 });

module.exports = mongoose.model("GatePass", GatePassSchema);
