// backend/models/systemSettingsModel.js
const mongoose = require("mongoose");

const systemSettingsSchema = new mongoose.Schema(
  {
    // General
    companyName: { type: String, default: "" },
    shortName: { type: String, default: "" },
    address: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    ntn: { type: String, default: "" },
    strn: { type: String, default: "" },
    defaultCurrency: { type: String, default: "PKR" },
    fiscalYearStart: { type: Date, default: null },
    dateFormat: { type: String, default: "DD/MM/YYYY" },
    timezone: { type: String, default: "Asia/Karachi" },
    logoUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SystemSettings", systemSettingsSchema);
