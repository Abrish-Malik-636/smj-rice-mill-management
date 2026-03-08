const Transaction = require("../models/transactionModel");
const StockLedger = require("../models/stockLedgerModel");
const ManagerialStockLedger = require("../models/managerialStockLedgerModel");
const ProductionBatch = require("../models/productionBatchModel");
const { getDateRangeFromQuery } = require("../utils/dateRange");

const parseRange = (req) => getDateRangeFromQuery(req.query);

exports.getStockReport = async (_req, res) => {
  try {
    const [productionLedgers, managerialLedgers] = await Promise.all([
      StockLedger.find({}).lean(),
      ManagerialStockLedger.find({}).lean(),
    ]);
    const productionMap = new Map();
    productionLedgers.forEach((l) => {
      const key = `${l.companyName || ""}__${l.productTypeName || ""}`;
      const prev = productionMap.get(key) || {
        companyName: l.companyName || "-",
        productTypeName: l.productTypeName || "-",
        balanceKg: 0,
      };
      const qty = Number(l.netWeightKg || 0);
      prev.balanceKg += l.type === "OUT" ? -qty : qty;
      productionMap.set(key, prev);
    });
    const managerialMap = new Map();
    managerialLedgers.forEach((l) => {
      const key = `${l.itemName || ""}__${l.category || ""}`;
      const prev = managerialMap.get(key) || {
        itemName: l.itemName || "-",
        category: l.category || "-",
        balanceQty: 0,
        unit: l.unit || "Nos",
      };
      const qty = Number(l.quantity || 0);
      prev.balanceQty += l.type === "OUT" ? -qty : qty;
      managerialMap.set(key, prev);
    });

    res.json({
      success: true,
      data: {
        production: Array.from(productionMap.values()),
        managerial: Array.from(managerialMap.values()),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to load stock report." });
  }
};

exports.getProductionReport = async (req, res) => {
  try {
    const { start, end } = parseRange(req);
    const batches = await ProductionBatch.find({
      date: { $gte: start, $lte: end },
    })
      .sort({ date: -1 })
      .lean();
    res.json({ success: true, data: batches });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to load production report." });
  }
};

exports.getSalesReport = async (req, res) => {
  try {
    const { start, end } = parseRange(req);
    const rows = await Transaction.find({
      type: "SALE",
      date: { $gte: start, $lte: end },
    })
      .sort({ date: -1, createdAt: -1 })
      .lean();
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to load sales report." });
  }
};

exports.getPurchaseReport = async (req, res) => {
  try {
    const { start, end } = parseRange(req);
    const rows = await Transaction.find({
      type: "PURCHASE",
      date: { $gte: start, $lte: end },
    })
      .sort({ date: -1, createdAt: -1 })
      .lean();
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to load purchase report." });
  }
};
