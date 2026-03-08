const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const {
  getSettings,
  saveSettings,
  uploadLogo,
  exportBackup,
  restoreBackup,
  sendEmailOtp,
  verifyEmailOtp,
  renameBrandEverywhere,
} = require("../controllers/systemSettingsController");

// Multer storage config (store in backend/uploads)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `logo-${Date.now()}${ext}`;
    cb(null, name);
  },
});
const upload = multer({ storage });

// Routes
router.get("/", getSettings); // GET settings
router.put("/", saveSettings); // SAVE (upsert)
router.post("/logo", upload.single("logo"), uploadLogo); // upload logo
router.get("/backup", exportBackup); // download backup JSON
router.post("/restore", upload.single("backup"), restoreBackup); // restore from JSON file
router.post("/otp/send", sendEmailOtp);
router.post("/otp/verify", verifyEmailOtp);
router.post("/rename-brand", renameBrandEverywhere);

module.exports = router;
