// backend/routes/gatePassesRoutes.js
const express = require("express");
const router = express.Router();
const gatePassController = require("../controllers/gatePassController");

router.get("/test", (req, res) => {
  res.send("GatePass routes loaded");
});

/**
 * Routes:
 * GET    /api/gatepasses
 * GET    /api/gatepasses/:id
 * POST   /api/gatepasses
 * PUT    /api/gatepasses/:id
 * DELETE /api/gatepasses/:id
 * GET    /api/gatepasses/print/:id
 * GET    /api/gatepasses/stats/today
 */

// List (optionally ?type=IN or OUT)
router.get("/", gatePassController.getGatePasses);

// Today stats
router.get("/stats/today", gatePassController.getTodayStats);

// Print preview JSON
router.get("/print/:id", gatePassController.printGatePass);

// Get single
router.get("/:id", gatePassController.getGatePassById);

// Create
router.post("/", gatePassController.createGatePass);

// Update
router.put("/:id", gatePassController.updateGatePass);

// Delete
router.delete("/:id", gatePassController.deleteGatePass);

module.exports = router;
