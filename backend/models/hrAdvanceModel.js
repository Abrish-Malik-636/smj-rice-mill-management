const mongoose = require("mongoose");

const HRAdvanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HREmployee",
      required: true,
    },
    employeeName: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true },
    status: {
      type: String,
      enum: ["Pending", "Deducted"],
      default: "Pending",
    },
    payrollId: { type: mongoose.Schema.Types.ObjectId, ref: "HRPayroll", default: null },
    note: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

HRAdvanceSchema.index({ employeeId: 1 });
HRAdvanceSchema.index({ status: 1 });

module.exports = mongoose.model("HRAdvance", HRAdvanceSchema);
