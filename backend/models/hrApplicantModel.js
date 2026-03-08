const mongoose = require("mongoose");

const HRApplicantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "HRJob", default: null },
    jobTitle: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["Applied", "Interview", "Selected", "Rejected"],
      default: "Applied",
    },
    notes: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

HRApplicantSchema.index({ name: 1 });
HRApplicantSchema.index({ status: 1 });

module.exports = mongoose.model("HRApplicant", HRApplicantSchema);
