const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");

// Delete all documents from an allow-listed collection.
// Body: { adminPin: "0000", key: "transactions", filter?: { type?: "SALE"|"PURCHASE" } }
router.post("/purge", adminController.purge);

module.exports = router;

