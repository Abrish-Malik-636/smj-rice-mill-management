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

    // Operational
    defaultBagWeightKg: { type: Number, default: 65 },
    defaultMoisturePercent: { type: Number, default: 14 },
    gatepassAutoNumbering: { type: Boolean, default: true },
    gatepassPrefix: { type: String, default: "GP-" },
    gatepassStartFrom: { type: Number, default: 1 },
    productionBatchPrefix: { type: String, default: "PB-" },
    invoicePrefix: { type: String, default: "INV-" },
    invoiceStartFrom: { type: Number, default: 1 },
    autoSaveProductionWeights: { type: Boolean, default: true },

    // Printing & Document
    printHeader: { type: String, default: "" },
    printFooter: { type: String, default: "" },
    watermarkText: { type: String, default: "" },
    showLogoOnPrint: { type: Boolean, default: true },
    pageSize: { type: String, default: "A4" },
    marginTop: { type: Number, default: 20 },
    marginLeft: { type: Number, default: 15 },
    marginRight: { type: Number, default: 15 },
    marginBottom: { type: Number, default: 20 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SystemSettings", systemSettingsSchema);
