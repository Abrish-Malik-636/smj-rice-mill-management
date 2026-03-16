const mongoose = require("mongoose");

const hrPayrollSchema = new mongoose.Schema(
  {
    payrollId: { type: String, trim: true, unique: true, sparse: true },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HREmployee",
      required: true,
    },
    employeeCode: { type: String, trim: true, default: "" },
    employeeName: { type: String, trim: true, default: "" },
    department: { type: String, trim: true, default: "" },
    designation: { type: String, trim: true, default: "" },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true, min: 2000, max: 2100 },

    basicSalary: { type: Number, min: 0, default: 0 },
    overtime: { type: Number, min: 0, default: 0 },
    bonus: { type: Number, min: 0, default: 0 },
    allowances: { type: Number, min: 0, default: 0 },
    deductions: { type: Number, min: 0, default: 0 },
    advanceDeduction: { type: Number, min: 0, default: 0 },
    netSalary: { type: Number, min: 0, default: 0 },

    paymentDate: { type: Date, default: null },
    paymentMethod: { type: String, enum: ["CASH", "BANK"], default: "CASH" },
    status: { type: String, enum: ["DRAFT", "PAID"], default: "DRAFT" },

    // Link to advances that were reduced by this payroll (optional audit)
    advanceIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  },
  { timestamps: true }
);

hrPayrollSchema.index({ employeeId: 1, month: 1, year: 1 }, { unique: true });
hrPayrollSchema.index({ year: 1, month: 1 });

hrPayrollSchema.pre("save", async function (next) {
  if (!this.isNew || this.payrollId) return next();
  try {
    const year = new Date().getFullYear();
    const prefix = `PAY-${year}-`;
    const last = await this.constructor
      .find({ payrollId: new RegExp(`^${prefix}`) })
      .sort({ createdAt: -1 })
      .limit(1)
      .lean();
    let seq = 1;
    if (last[0]?.payrollId) {
      const parts = String(last[0].payrollId).split("-");
      const n = Number(parts[2]);
      if (!Number.isNaN(n)) seq = n + 1;
    }
    this.payrollId = `${prefix}${String(seq).padStart(5, "0")}`;
    next();
  } catch (e) {
    next(e);
  }
});

module.exports = mongoose.model("HRPayroll", hrPayrollSchema);
