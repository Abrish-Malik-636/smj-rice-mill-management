const mongoose = require("mongoose");

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
      minlength: [2, "Company name must be at least 2 characters"],
      maxlength: [100, "Company name must not exceed 100 characters"],
      validate: {
        validator: function (v) {
          return !v || /^[a-zA-Z\s]+$/.test(v);
        },
        message: "Party name cannot contain numbers",
      },
      set: function (value) {
        return value ? value.trim() : value;
      },
    },
    type: {
      type: String,
      enum: {
        values: ["Supplier", "Customer", "Transporter", "Both"],
        message: "Type must be Supplier, Customer, Transporter, or Both",
      },
      required: [true, "Type is required"],
    },
    contactPerson: {
      type: String,
      required: [true, "Contact person is required"],
      trim: true,
      minlength: [2, "Contact person must be at least 2 characters"],
      maxlength: [50, "Contact person must not exceed 50 characters"],
      validate: {
        validator: function (v) {
          return !v || /^[a-zA-Z\s]+$/.test(v);
        },
        message: "Contact person can only contain letters and spaces",
      },
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      validate: {
        validator: function (v) {
          // Format: 03XX-XXXXXXX (11 digits total)
          const digits = v.replace(/\D/g, "");
          return digits.length === 11 && digits.startsWith("03");
        },
        message: "Phone number must be in format 03XX-XXXXXXX (11 digits starting with 03)",
      },
      set: function (v) {
        // Normalize phone format
        const digits = v.replace(/\D/g, "");
        if (digits.length === 11 && digits.startsWith("03")) {
          return `${digits.slice(0, 4)}-${digits.slice(4)}`;
        }
        return v;
      },
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      maxlength: [100, "Email must not exceed 100 characters"],
      validate: {
        validator: function (v) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: "Invalid email format",
      },
    },
    address: {
      type: String,
      required: [true, "Address is required"],
      trim: true,
      minlength: [5, "Address must be at least 5 characters"],
      maxlength: [200, "Address must not exceed 200 characters"],
    },
  },
  { timestamps: true }
);

// Index for duplicate checking (case-insensitive name search)
companySchema.index({ name: 1 });
companySchema.index({ email: 1 });

// Pre-save hook to normalize name for duplicate checking
companySchema.pre("save", async function (next) {
  if (this.isModified("name")) {
    // Check for duplicates (case-insensitive, trimmed)
    const normalizedName = this.name.toLowerCase().trim();
    const existing = await mongoose.model("Company").findOne({
      _id: { $ne: this._id },
      $or: [
        { name: { $regex: new RegExp(`^${normalizedName}$`, "i") } },
        { name: { $regex: new RegExp(normalizedName, "i") } },
      ],
    });

    if (existing) {
      const error = new Error(`Party with similar name already exists: "${existing.name}"`);
      error.name = "ValidationError";
      return next(error);
    }
  }
  next();
});

module.exports = mongoose.model("Company", companySchema);
