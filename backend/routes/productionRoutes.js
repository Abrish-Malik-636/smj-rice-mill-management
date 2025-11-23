// backend/routes/productionRoutes.js
const express = require("express");
const router = express.Router();
const productionController = require("../controllers/productionController");

router.post("/batches", productionController.createBatch);
router.get("/batches", productionController.listBatches);
router.get("/batches/:id", productionController.getBatchById);
router.put("/batches/:id", productionController.updateBatch);
router.delete("/batches/:id", productionController.deleteBatch);

router.post("/batches/:id/outputs", productionController.addOutput);

router.post("/batches/:id/complete", productionController.completeBatch);

router.get("/summary/today", productionController.getTodaySummary);

module.exports = router;
