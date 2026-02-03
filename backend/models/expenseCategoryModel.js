const mongoose = require("mongoose");

const expenseCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      minlength: [2, "Category name must be at least 2 characters"],
      maxlength: [50, "Category name must not exceed 50 characters"],
      set: function (value) {
        return value ? value.trim() : value;
      },
    },
    type: {
      type: String,
      required: [true, "Category type is required for financial reporting"],
      trim: true,
      enum: {
        values: ["Operational", "Administrative", "Capital", "Payroll", "Utilities", "Maintenance", "Other"],
        message: "Type must be one of: Operational, Administrative, Capital, Payroll, Utilities, Maintenance, Other",
      },
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: [200, "Description must not exceed 200 characters"],
    },
  },
  { timestamps: true }
);

expenseCategorySchema.index({ name: 1 });

expenseCategorySchema.pre("save", async function (next) {
  if (this.isModified("name")) {
    const normalizedName = this.name.toLowerCase().trim();
    const existing = await mongoose.model("ExpenseCategory").findOne({
      _id: { $ne: this._id },
      name: { $regex: new RegExp(`^${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    });
    if (existing) {
      const error = new Error(`Expense category with similar name already exists: "${existing.name}"`);
      error.name = "ValidationError";
      return next(error);
    }
  }
  next();
});

module.exports = mongoose.model("ExpenseCategory", expenseCategorySchema);
