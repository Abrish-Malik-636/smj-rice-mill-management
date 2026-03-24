const mongoose = require("mongoose");

const accountingProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    unit: { type: String, default: "", trim: true }, // e.g. kg, ton, pcs
    sku: { type: String, default: "", trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AccountingProduct", accountingProductSchema);
