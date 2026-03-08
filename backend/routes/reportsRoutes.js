const express = require("express");
const ctrl = require("../controllers/reportsController");

const router = express.Router();

router.get("/stock", ctrl.getStockReport);
router.get("/production", ctrl.getProductionReport);
router.get("/sales", ctrl.getSalesReport);
router.get("/purchases", ctrl.getPurchaseReport);

module.exports = router;

