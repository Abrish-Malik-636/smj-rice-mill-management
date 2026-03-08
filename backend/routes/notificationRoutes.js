const express = require("express");
const notificationController = require("../controllers/notificationController");

const router = express.Router();

router.get("/alerts", notificationController.getAlerts);
router.post("/reminders", notificationController.createReminder);

module.exports = router;

