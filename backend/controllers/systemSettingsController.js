// backend/controllers/systemSettingsController.js
const path = require("path");
const fs = require("fs");
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
 */
exports.saveSettings = async (req, res) => {
  try {
    const payload = req.body || {};

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
