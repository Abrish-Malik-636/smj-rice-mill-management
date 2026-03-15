const mongoose = require("mongoose");

const wholesellerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Wholeseller name is required"],
      trim: true,
      minlength: [2, "Wholeseller name must be at least 2 characters"],
      maxlength: [100, "Wholeseller name must not exceed 100 characters"],
    },
    phone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    address: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

wholesellerSchema.index({ name: 1 });
wholesellerSchema.index({ phone: 1 });

module.exports = mongoose.model("Wholeseller", wholesellerSchema);

