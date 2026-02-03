// backend/controllers/systemSettingsController.js
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const SystemSettings = require("../models/systemSettingsModel");
const Company = require("../models/companyModel");
const ProductType = require("../models/productTypeModel");
const ExpenseCategory = require("../models/expenseCategoryModel");
const ProductionBatch = require("../models/productionBatchModel");

/**
 * Get settings (single document). If none exists, return defaults via an upsert fallback.
 */
exports.getSettings = async (req, res) => {
  try {
    let settings = await SystemSettings.findOne({});
    if (!settings) {
      settings = await SystemSettings.create({});
    }
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Update or create the single settings document.
 * Changing additionalStockSettingsEnabled requires adminPin in body and valid PIN.
 */
exports.saveSettings = async (req, res) => {
  try {
    const payload = { ...req.body };
    const adminPin = payload.adminPin != null ? String(payload.adminPin).trim() : null;
    const newAdminPin =
      payload.newAdminPin != null ? String(payload.newAdminPin).trim() : null;
    delete payload.adminPin;
    delete payload.newAdminPin;

    const needsPin =
      payload.additionalStockSettingsEnabled !== undefined ||
      payload.stockStatusExtremeLowKg !== undefined ||
      payload.stockStatusLowKg !== undefined ||
      payload.managerialStockStatusExtremeLowQty !== undefined ||
      payload.managerialStockStatusLowQty !== undefined ||
      newAdminPin !== null;
    if (needsPin) {
      const settings = await SystemSettings.findOne({}).select("adminPin").lean();
      const expectedPin = (settings && settings.adminPin) || "0000";
      if (!adminPin || adminPin !== String(expectedPin).trim()) {
        return res.status(403).json({
          success: false,
          message: "Invalid or missing admin PIN. Required to change these settings.",
        });
      }
    }

    if (newAdminPin) {
      payload.adminPin = newAdminPin;
      payload.loginPassword = newAdminPin;
    } else if (payload.loginPassword && !payload.adminPin) {
      payload.adminPin = payload.loginPassword;
    }

    const updated = await SystemSettings.findOneAndUpdate(
      {},
      { $set: payload },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * Upload logo (multipart/form-data)
 */
exports.uploadLogo = async (req, res) => {
  try {
    if (!req.file)
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });

    const uploadsDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

    const savedPath = req.file.path;
    const host = req.get("host");
    const protocol = req.protocol;
    const publicUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

    const updated = await SystemSettings.findOneAndUpdate(
      {},
      { $set: { logoUrl: publicUrl } },
      { new: true, upsert: true }
    );

    res.json({ success: true, data: updated, logoUrl: publicUrl });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Export backup: core settings + master data + operational data
 */
exports.exportBackup = async (req, res) => {
  try {
    const settings = (await SystemSettings.findOne({})) || {};
    const companies = await Company.find({});
    const productTypes = await ProductType.find({});
    const expenseCategories = await ExpenseCategory.find({});

    let productionBatches = [];
    let gatePasses = [];
    let stockLedgers = [];

    try {
      productionBatches = await ProductionBatch.find({});
    } catch (_) {}

    try {
      gatePasses = await GatePass.find({});
    } catch (_) {}

    try {
      stockLedgers = await StockLedger.find({});
    } catch (_) {}

    const payload = {
      settings,
      companies,
      productTypes,
      expenseCategories,
      productionBatches,
      gatePasses,
      stockLedgers,
      exportedAt: new Date(),
    };

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=smj-backup.json"
    );
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Restore backup from JSON file
 */
exports.restoreBackup = async (req, res) => {
  try {
    if (!req.file)
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });

    const filePath = req.file.path;
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);

    // SETTINGS
    if (data.settings) {
      await SystemSettings.deleteMany({});
      await SystemSettings.create(data.settings);
    }

    // MASTER DATA
    if (Array.isArray(data.companies)) {
      await Company.deleteMany({});
      if (data.companies.length) await Company.insertMany(data.companies);
    }

    if (Array.isArray(data.productTypes)) {
      await ProductType.deleteMany({});
      if (data.productTypes.length)
        await ProductType.insertMany(data.productTypes);
    }

    if (Array.isArray(data.expenseCategories)) {
      await ExpenseCategory.deleteMany({});
      if (data.expenseCategories.length)
        await ExpenseCategory.insertMany(data.expenseCategories);
    }

    // OPERATIONAL DATA
    if (Array.isArray(data.productionBatches)) {
      try {
        await ProductionBatch.deleteMany({});
        if (data.productionBatches.length)
          await ProductionBatch.insertMany(data.productionBatches);
      } catch (e) {
        console.error("restore productionBatches error:", e);
      }
    }

    if (Array.isArray(data.gatePasses)) {
      try {
        await GatePass.deleteMany({});
        if (data.gatePasses.length) await GatePass.insertMany(data.gatePasses);
      } catch (e) {
        console.error("restore gatePasses error:", e);
      }
    }

    if (Array.isArray(data.stockLedgers)) {
      try {
        await StockLedger.deleteMany({});
        if (data.stockLedgers.length)
          await StockLedger.insertMany(data.stockLedgers);
      } catch (e) {
        console.error("restore stockLedgers error:", e);
      }
    }

    fs.unlinkSync(filePath);

    res.json({ success: true, message: "Backup restored successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getMailer = () => {
  const host = process.env.SMJ_SMTP_HOST;
  const port = Number(process.env.SMJ_SMTP_PORT || 587);
  const user = process.env.SMJ_SMTP_USER;
  const pass = process.env.SMJ_SMTP_PASS;
  const secure = String(process.env.SMJ_SMTP_SECURE || "false") === "true";
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
};

const hashOtp = (otp) =>
  crypto.createHash("sha256").update(String(otp)).digest("hex");

exports.sendEmailOtp = async (req, res) => {
  try {
    const settings = await SystemSettings.findOne({});
    if (!settings || !settings.email) {
      return res.status(400).json({ success: false, message: "Email not set in General Settings." });
    }
    const transport = getMailer();
    if (!transport) {
      return res.status(400).json({
        success: false,
        message: "Email provider not configured. Set SMTP env vars.",
      });
    }

    const otp = String(Math.floor(1000 + Math.random() * 9000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    settings.otpCodeHash = hashOtp(otp);
    settings.otpExpiresAt = expiresAt;
    await settings.save();

    const from = process.env.SMJ_MAIL_FROM || "no-reply@smj.local";
    await transport.sendMail({
      from,
      to: settings.email,
      subject: "SMJ OTP Verification",
      text: `Your OTP is ${otp}. It expires in 5 minutes.`,
    });

    res.json({ success: true, message: "OTP sent" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.verifyEmailOtp = async (req, res) => {
  try {
    const { otp } = req.body || {};
    if (!otp || String(otp).length !== 4) {
      return res.status(400).json({ success: false, message: "Invalid OTP." });
    }
    const settings = await SystemSettings.findOne({});
    if (!settings || !settings.otpCodeHash || !settings.otpExpiresAt) {
      return res.status(400).json({ success: false, message: "OTP not requested." });
    }
    if (new Date(settings.otpExpiresAt).getTime() < Date.now()) {
      return res.status(400).json({ success: false, message: "OTP expired." });
    }
    const isValid = hashOtp(otp) === settings.otpCodeHash;
    if (!isValid) {
      return res.status(400).json({ success: false, message: "OTP is incorrect." });
    }
    settings.otpCodeHash = "";
    settings.otpExpiresAt = null;
    await settings.save();
    res.json({ success: true, message: "OTP verified" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
