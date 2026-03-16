const mongoose = require("mongoose");

const hrAdvanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HREmployee",
      required: true,
    },
    employeeCode: { type: String, trim: true, default: "" },
    employeeName: { type: String, trim: true, default: "" },
    date: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0 },
    remainingBalance: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["OPEN", "SETTLED"], default: "OPEN" },
    note: { type: String, trim: true, default: "" },
    paymentMethod: { type: String, enum: ["CASH", "BANK"], default: "CASH" },
  },
  { timestamps: true }
);

hrAdvanceSchema.index({ employeeId: 1, date: -1 });
hrAdvanceSchema.index({ status: 1 });

module.exports = mongoose.model("HRAdvance", hrAdvanceSchema);

