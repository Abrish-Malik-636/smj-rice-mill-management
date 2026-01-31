const mongoose = require("mongoose");

const productTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      minlength: [2, "Product name must be at least 2 characters"],
      maxlength: [50, "Product name must not exceed 50 characters"],
      set: function (value) {
        return value ? value.trim() : value;
      },
    },
    productCategory: {
      type: String,
      required: [true, "Product category is required"],
      enum: {
        values: ["Finished", "By-Product", "Waste"],
        message: "Product category must be Finished, By-Product, or Waste",
      },
    },
    baseUnit: {
      type: String,
      default: "KG",
      trim: true,
    },
    allowableSaleUnits: {
      type: [String],
      default: ["KG"],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0 && v.every((u) => ["Bag", "Ton", "KG"].includes(u));
        },
        message: "Allowable sale units must be one or more of: Bag, Ton, KG",
      },
    },
    conversionFactors: {
      type: mongoose.Schema.Types.Mixed,
      default: { KG: 1, Bag: 65, Ton: 1000 },
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

productTypeSchema.index({ name: 1 });

productTypeSchema.pre("save", async function (next) {
  if (this.isModified("name")) {
    const normalizedName = this.name.toLowerCase().trim();
    const existing = await mongoose.model("ProductType").findOne({
      _id: { $ne: this._id },
      $or: [
        { name: { $regex: new RegExp(`^${normalizedName}$`, "i") } },
        { name: { $regex: new RegExp(normalizedName, "i") } },
      ],
    });
    if (existing) {
      const error = new Error(`Product type with similar name already exists: "${existing.name}"`);
      error.name = "ValidationError";
      return next(error);
    }
  }
  next();
});

module.exports = mongoose.model("ProductType", productTypeSchema);
