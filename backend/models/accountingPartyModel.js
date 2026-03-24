const mongoose = require("mongoose");

const accountingPartySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    partyType: {
      type: String,
      enum: ["CUSTOMER", "SUPPLIER", "BOTH", "OTHER"],
      default: "OTHER",
    },
    phone: { type: String, default: "", trim: true },
    address: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AccountingParty", accountingPartySchema);
