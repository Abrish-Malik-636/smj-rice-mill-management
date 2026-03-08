const mongoose = require("mongoose");

const HRJobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    department: { type: String, default: "", trim: true },
    vacancies: { type: Number, default: 1, min: 1 },
    status: {
      type: String,
      enum: ["Open", "Closed"],
      default: "Open",
    },
    description: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

HRJobSchema.index({ title: 1 });
HRJobSchema.index({ status: 1 });

module.exports = mongoose.model("HRJob", HRJobSchema);
