const mongoose = require("mongoose");

const NAME_REGEX = /^[A-Za-z\s.'-]+$/;
const CNIC_REGEX = /^\d{5}-\d{7}-\d{1}$/;
const PHONE_REGEX = /^03\d{2}-\d{7}$/;

const hrEmployeeSchema = new mongoose.Schema(
  {
    employeeId: { type: String, trim: true, unique: true, sparse: true },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
      validate: {
        validator: (v) => NAME_REGEX.test(String(v || "").trim()),
        message: "Employee name: letters and spaces only.",
      },
    },
    fatherName: {
      required: true,
      type: String,
      trim: true,
      maxlength: 100,
      validate: {
        validator: (v) => NAME_REGEX.test(String(v || "").trim()),
        message: "Father name: letters and spaces only.",
      },
    },
    cnic: {
      required: true,
      type: String,
      trim: true,
      validate: {
        validator: (v) => CNIC_REGEX.test(String(v || "").trim()),
        message: "CNIC format: 12345-1234567-1",
      },
    },
    phone: {
      required: true,
      type: String,
      trim: true,
      validate: {
        validator: (v) => PHONE_REGEX.test(String(v || "").trim()),
        message: "Phone format: 03XX-XXXXXXX",
      },
    },
    address: { type: String, required: true, trim: true, maxlength: 200 },
    department: { type: String, required: true, trim: true },
    designation: { type: String, trim: true, default: "" },
    joiningDate: { type: Date, required: true },
    salaryType: {
      type: String,
      enum: ["MONTHLY", "DAILY", "PER_BAG", "OTHER"],
      default: "MONTHLY",
    },
    basicSalary: { type: Number, min: 0, default: 0 },

    // Per-employee setting: if enabled, payroll UI auto-fills advance deduction each month
    // based on the configured percent, until remaining advance becomes zero.
    advanceDeductionEnabled: { type: Boolean, default: false },
    advanceDeductionPercent: { type: Number, min: 0, max: 100, default: 20 },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  { timestamps: true }
);

hrEmployeeSchema.index({ name: 1 });
hrEmployeeSchema.index({ department: 1 });
hrEmployeeSchema.index({ status: 1 });

hrEmployeeSchema.pre("save", async function (next) {
  if (!this.isNew || this.employeeId) return next();
  try {
    const year = new Date().getFullYear();
    const prefix = `EMP-${year}-`;
    const last = await this.constructor
      .find({ employeeId: new RegExp(`^${prefix}`) })
      .sort({ createdAt: -1 })
      .limit(1)
      .lean();
    let seq = 1;
    if (last[0]?.employeeId) {
      const parts = String(last[0].employeeId).split("-");
      const n = Number(parts[2]);
      if (!Number.isNaN(n)) seq = n + 1;
    }
    this.employeeId = `${prefix}${String(seq).padStart(5, "0")}`;
    next();
  } catch (e) {
    next(e);
  }
});

module.exports = mongoose.model("HREmployee", hrEmployeeSchema);
