const mongoose = require("mongoose");

const HRLeaveSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HREmployee",
      required: true,
    },
    employeeName: { type: String, required: true, trim: true },
    type: { type: String, enum: ["Paid", "Unpaid"], default: "Paid" },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    days: { type: Number, required: true, min: 1 },
    reason: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

HRLeaveSchema.index({ employeeId: 1 });
HRLeaveSchema.index({ status: 1 });

module.exports = mongoose.model("HRLeave", HRLeaveSchema);
