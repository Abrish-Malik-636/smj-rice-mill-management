const mongoose = require("mongoose");

const HRPayrollSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HREmployee",
      required: true,
    },
    employeeName: { type: String, required: true, trim: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true, min: 2000 },
    daysWorked: { type: Number, required: true, min: 0 },
    monthlyWorkingDays: { type: Number, required: true, min: 1 },
    overtimeHours: { type: Number, default: 0, min: 0 },
    overtimeRate: { type: Number, default: 1.5, min: 1 },
    basicSalary: { type: Number, required: true, min: 0 },
    extraPay: { type: Number, default: 0, min: 0 },
    advanceDeducted: { type: Number, default: 0, min: 0 },
    otherDeductions: { type: Number, default: 0, min: 0 },
    grossPay: { type: Number, required: true, min: 0 },
    netPay: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["Unpaid", "Paid"], default: "Unpaid" },
    notes: { type: String, default: "", trim: true },
    advanceIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  },
  { timestamps: true }
);

HRPayrollSchema.index({ employeeId: 1, month: 1, year: 1 });
HRPayrollSchema.index({ status: 1 });

module.exports = mongoose.model("HRPayroll", HRPayrollSchema);
