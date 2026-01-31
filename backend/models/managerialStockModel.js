const mongoose = require("mongoose");

const managerialStockSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Item name is required"],
      trim: true,
      minlength: [2, "Item name must be at least 2 characters"],
      maxlength: [80, "Item name must not exceed 80 characters"],
      set: function (value) {
        return value ? value.trim() : value;
      },
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      enum: {
        values: ["Machinery", "Equipment", "Vehicle", "Furniture", "IT & Electronics", "Other"],
        message: "Category must be one of: Machinery, Equipment, Vehicle, Furniture, IT & Electronics, Other",
      },
    },
    unit: {
      type: String,
      required: [true, "Unit is required"],
      trim: true,
      maxlength: [20, "Unit must not exceed 20 characters"],
      default: "Nos",
    },
    condition: {
      type: String,
      trim: true,
      enum: ["Good", "Fair", "Poor", "Under Maintenance", ""],
      default: "",
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, "Description must not exceed 200 characters"],
      default: "",
    },
  },
  { timestamps: true }
);

managerialStockSchema.index({ name: 1 });
managerialStockSchema.index({ category: 1 });

module.exports = mongoose.model("ManagerialStock", managerialStockSchema);
