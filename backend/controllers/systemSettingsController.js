const path = require("path");
const fs = require("fs");
const SystemSettings = require("../models/systemSettingsModel");
const Company = require("../models/companyModel");
const ProductType = require("../models/productTypeModel");
const ExpenseCategory = require("../models/expenseCategoryModel");

/**
 * Get settings (single document). If none exists, return defaults via an upsert fallback.
 */
exports.getSettings = async (req, res) => {
  try {
    let settings = await SystemSettings.findOne({});
    if (!settings) {
      // create default doc (so there is always one)
      settings = await SystemSettings.create({});
    }
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Update or create the single settings document.
 * Uses findOneAndUpdate with upsert: true
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
 * saves to backend/uploads/logo-<timestamp>.ext and returns public URL
 */
exports.uploadLogo = async (req, res) => {
  try {
    if (!req.file)
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });

    // ensure uploads folder exists
    const uploadsDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

    // file already stored by multer in a tmp location - we configured storage below in routes
    // req.file.path gives the saved file path
    const savedPath = req.file.path; // relative to project
    // build public URL assuming server serves /uploads
    const host = req.get("host");
    const protocol = req.protocol;
    const publicUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

    // update settings document with new logoUrl
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
 * Export backup (returns JSON containing core collections)
 */
exports.exportBackup = async (req, res) => {
  try {
    const settings = (await SystemSettings.findOne({})) || {};
    const companies = await Company.find({});
    const productTypes = await ProductType.find({});
    const expenseCategories = await ExpenseCategory.find({});

    const payload = {
      settings,
      companies,
      productTypes,
      expenseCategories,
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
 * Restore backup (multipart: JSON file)
 * This will replace collections with provided arrays — use carefully.
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

    // Replace/overwrite collections (basic approach)
    if (data.settings) {
      // overwrite the single settings doc
      await SystemSettings.deleteMany({});
      await SystemSettings.create(data.settings);
    }
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

    // remove uploaded restore file
    fs.unlinkSync(filePath);

    res.json({ success: true, message: "Backup restored successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
