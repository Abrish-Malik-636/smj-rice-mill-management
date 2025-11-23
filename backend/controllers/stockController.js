// backend/controllers/stockController.js
const ProductionBatch = require("../models/productionBatchModel");

/**
 * GET /api/stock/current
 * Current finished stock, grouped by product + company,
 * derived ONLY from COMPLETED production batches.
 */
exports.getCurrentStock = async (req, res) => {
  try {
    const completedBatches = await ProductionBatch.find({
      status: "COMPLETED",
    }).lean();

    const map = new Map();

    completedBatches.forEach((batch) => {
      const batchUpdatedAt = batch.updatedAt || batch.date || new Date();

      (batch.outputs || []).forEach((o) => {
        if (!o.productTypeId || !o.netWeightKg) return;

        const key = `${o.productTypeId.toString()}__${
          o.companyId ? o.companyId.toString() : "null"
        }`;

        const existing = map.get(key) || {
          productTypeId: o.productTypeId,
          productTypeName: o.productTypeName || "",
          companyId: o.companyId || null,
          companyName: o.companyName || "",
          totalNetWeight: 0,
          lastUpdated: batchUpdatedAt,
        };

        existing.totalNetWeight += o.netWeightKg || 0;

        if (
          batchUpdatedAt &&
          new Date(batchUpdatedAt) > new Date(existing.lastUpdated)
        ) {
          existing.lastUpdated = batchUpdatedAt;
        }

        map.set(key, existing);
      });
    });

    const result = Array.from(map.values()).map((row) => ({
      ...row,
      totalNetWeight: Number(row.totalNetWeight.toFixed(3)),
    }));

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error("getCurrentStock error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Error computing current stock." });
  }
};
