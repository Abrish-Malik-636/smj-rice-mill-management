// backend/models/gatePassModel.js
const mongoose = require("mongoose");

const GatePassSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["IN", "OUT"],
      required: [true, "Gate pass type is required."],
    },

    gatePassNo: {
      type: String,
      unique: true,
      sparse: true,
    },

    // Truck number: restrict format & length
    truckNo: {
      type: String,
      required: [true, "Truck number is required."],
      minlength: [6, "Truck number seems too short."],
      maxlength: [12, "Truck number seems too long."],
      match: [
        /^[A-Z]{2,4}-\d{3,4}$/,
        "Truck number format invalid. Expected format: ABC-123 or AB-1234 (only capital letters, a hyphen, digits).",
      ],
    },

    customer: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^[A-Za-z\s.'-]+$/.test(v);
        },
        message:
          "Customer name invalid. Use letters, spaces, apostrophe, dot or hyphen only.",
      },
    },

    supplier: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^[A-Za-z\s.'-]+$/.test(v);
        },
        message:
          "Supplier name invalid. Use letters, spaces, apostrophe, dot or hyphen only.",
      },
    },

    itemType: {
      type: String,
      required: [true, "Item type is required."],
      trim: true,
    },

    quantity: {
      type: Number,
      min: [0, "Quantity must be greater than 0."],
    },

    unit: {
      type: String,
      enum: ["kg", "ton", "bags", "pcs"],
      default: "kg",
    },

    transporter: {
      type: String,
      trim: true, // optional
    },

    driverName: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^[A-Za-z\s.'-]+$/.test(v);
        },
        message:
          "Driver name invalid. Use letters, spaces, apostrophe, dot or hyphen only.",
      },
    },

    remarks: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    createdBy: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Auto number
GatePassSchema.pre("save", async function (next) {
  if (!this.isNew || this.gatePassNo) return next();

  try {
    const year = new Date().getFullYear();
    const last = await this.constructor
      .find({ gatePassNo: new RegExp(`^GP-${year}-`) })
      .sort({ _id: -1 })
      .limit(1);

    let number = 1;
    if (last.length > 0) {
      const parts = last[0].gatePassNo.split("-");
      const lastNumber = parseInt(parts[2], 10);
      if (!Number.isNaN(lastNumber)) number = lastNumber + 1;
    }

    this.gatePassNo = `GP-${year}-${String(number).padStart(5, "0")}`;
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("GatePass", GatePassSchema);
