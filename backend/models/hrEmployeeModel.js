const mongoose = require("mongoose");

const HREmployeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, default: "", trim: true },
    department: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true },
    address: { type: String, default: "", trim: true },
    joinDate: { type: Date, default: null },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    basicSalary: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

HREmployeeSchema.index({ name: 1 });
HREmployeeSchema.index({ department: 1 });
HREmployeeSchema.index({ status: 1 });

module.exports = mongoose.model("HREmployee", HREmployeeSchema);
