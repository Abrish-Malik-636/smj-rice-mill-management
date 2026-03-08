// backend/models/productionBatchModel.js
const mongoose = require("mongoose");

const ProductionOutputSchema = new mongoose.Schema(
  {
    productTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductType",
      required: true,
    },
    productTypeName: { type: String, required: true },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
    },
    companyName: { type: String, default: "" },

    numBags: { type: Number, required: true, min: 0 },

    // total net weight for this line = numBags * perBagWeightKg
    netWeightKg: { type: Number, required: true, min: 0 },

    shift: { type: String, enum: ["DAY", "NIGHT"], required: true },
    outputDate: { type: Date, default: Date.now },

    // Scheduling / completion
    status: {
      type: String,
      enum: ["IN_PROCESS", "COMPLETED"],
      default: "COMPLETED",
    },
    durationMinutes: { type: Number, default: 0, min: 0 },
    plannedCompleteAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { _id: true }
);

const ProductionBatchSchema = new mongoose.Schema(
  {
    batchNo: { type: String, required: true, unique: true }, // PB-YYYYMMDD-HHMMSS
    date: { type: Date, required: true },

    status: {
      type: String,
      enum: ["IN_PROCESS", "COMPLETED"],
      default: "IN_PROCESS",
    },

    // Raw paddy (kg) for this batch
    paddyWeightKg: { type: Number, required: true, min: 0 },
    sourceCompanyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
    },
    sourceCompanyName: { type: String, required: true, trim: true },

    // Aggregates for reporting
    totalRawWeightKg: { type: Number, default: 0 },
    totalOutputWeightKg: { type: Number, default: 0 },

    dayShiftOutputWeightKg: { type: Number, default: 0 },
    nightShiftOutputWeightKg: { type: Number, default: 0 },

    outputs: [ProductionOutputSchema],

    remarks: { type: String, default: "" },
  },
  { timestamps: true }
);

ProductionBatchSchema.index({ date: 1 });
ProductionBatchSchema.index({ status: 1 });

module.exports = mongoose.model("ProductionBatch", ProductionBatchSchema);
