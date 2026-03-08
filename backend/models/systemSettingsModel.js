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
    // Stock management / saleable unit (e.g. bag weight in kg)
    defaultBagWeightKg: { type: Number, default: 65, min: 1 },
    // Admin PIN for special actions (e.g. edit completed batch). Default 0000
    adminPin: { type: String, default: "0000", trim: true },
    // When true, shows "Remove previous stock" and "Set paddy zero" options. Secured with admin PIN.
    additionalStockSettingsEnabled: { type: Boolean, default: false },
    // Email OTP for PIN reset
    otpCodeHash: { type: String, default: "" },
    otpExpiresAt: { type: Date, default: null },
    // Account login (basic)
    loginUsername: { type: String, default: "" },
    loginPassword: { type: String, default: "" },
    // Stock status thresholds (kg): 0 = out of stock; <= extremeLow = Extreme Low; <= low = Low; > low = Okay.
    stockStatusExtremeLowKg: { type: Number, default: 300, min: 0 },
    stockStatusLowKg: { type: Number, default: 500, min: 0 },
    // Managerial stock thresholds (qty): 0 = out of stock; <= extremeLow = Extreme Low; <= low = Low; > low = Okay.
    managerialStockStatusExtremeLowQty: { type: Number, default: 2, min: 0 },
    managerialStockStatusLowQty: { type: Number, default: 5, min: 0 },
    // Purchase dropdown options
    purchaseItemOptions: { type: [String], default: [] },
    purchaseCategoryOptions: { type: [String], default: [] },
    transporterOptions: { type: [String], default: [] },
    brandOptions: { type: [String], default: [] },
    // HR settings
    hrMonthlyWorkingDays: { type: Number, default: 30, min: 1 },
    hrWorkingHoursPerDay: { type: Number, default: 8, min: 1 },
    hrOvertimeRate: { type: Number, default: 1.5, min: 1 },
    hrAllowPaidLeave: { type: Boolean, default: true },
    hrAllowUnpaidLeave: { type: Boolean, default: true },
    hrAdvanceDeductionMode: { type: String, default: "FULL" },
    // Notifications / alerts schedule
    alertsEnabled: { type: Boolean, default: true },
    alertsWorkStart: { type: String, default: "09:00" },
    alertsWorkEnd: { type: String, default: "18:00" },
    // Allow up to 24 hours (1440 min). Default: 24 hours.
    alertsIntervalMinutes: { type: Number, default: 1440, min: 1, max: 1440 },
    // Accounting migration marker for idempotent historical journal rebuild
    accountingBackfillVersion: { type: Number, default: 0, min: 0 },
    accountingBackfillAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SystemSettings", systemSettingsSchema);
