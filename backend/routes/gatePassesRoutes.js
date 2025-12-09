// backend/routes/gatePassesRoutes.js
const express = require("express");
const router = express.Router();
const controller = require("../controllers/gatePassController");

router.post("/", controller.createGatePass);
router.get("/", controller.getGatePasses);
router.get("/:id", controller.getGatePass);
router.put("/:id", controller.updateGatePass);
router.delete("/:id", controller.deleteGatePass);

module.exports = router;
