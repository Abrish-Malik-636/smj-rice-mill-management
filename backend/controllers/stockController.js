// backend/controllers/stockController.js
const ProductionBatch = require("../models/productionBatchModel");
const Transaction = require("../models/transactionModel");
const Company = require("../models/companyModel");

function makeKey(companyId, productTypeId) {
  return `${companyId || "NONE"}::${productTypeId}`;
}

exports.getCurrentStock = async (req, res) => {
  try {
    const map = new Map();
    const companyCache = new Map(); // companyId -> companyName

    const getCompanyName = async (companyId, fallbackName = "") => {
      if (!companyId) return fallbackName || "";
      const idStr = companyId.toString();
      if (companyCache.has(idStr)) return companyCache.get(idStr);

      const comp = await Company.findById(idStr).select("name").lean();
      const name = comp ? comp.name : fallbackName || "";
      companyCache.set(idStr, name);
      return name;
    };

    const addToMap = (
      companyId,
      companyName,
      productTypeId,
      productTypeName,
      deltaKg,
      updatedAt
    ) => {
      if (!productTypeId) return;
      const qty = Number(deltaKg || 0);
      if (!qty) return;

      const key = makeKey(companyId, productTypeId);
      const existing = map.get(key) || {
        companyId: companyId || null,
        companyName: companyName || "",
        productTypeId,
        productTypeName: productTypeName || "",
        balanceKg: 0,
        lastUpdated: null,
      };

      existing.balanceKg += qty;

      const newTime = updatedAt ? new Date(updatedAt) : null;
      if (newTime) {
        if (!existing.lastUpdated || newTime > existing.lastUpdated) {
          existing.lastUpdated = newTime;
        }
      }

      map.set(key, existing);
    };

    // 1️⃣ COMPLETED production batches → add outputs
    const batches = await ProductionBatch.find({
      status: "COMPLETED",
    }).lean();

    for (const b of batches) {
      const outputs = b.outputs || [];

      for (const o of outputs) {
        const companyId = o.companyId || null; // ✅ company per-output se
        const rawCompanyName = o.companyName || ""; // ✅ name per-output se
        const productTypeId = o.productTypeId?.toString();
        const productTypeName = o.productTypeName || "";
        const net = Number(o.netWeightKg || 0);

        if (net > 0) {
          addToMap(
            companyId,
            rawCompanyName,
            productTypeId,
            productTypeName,
            net,
            b.updatedAt || b.createdAt
          );
        }
      }
    }

    // 2️⃣ PURCHASE transactions → add items
    const purchases = await Transaction.find({ type: "PURCHASE" }).lean();
    for (const t of purchases) {
      const companyId = t.companyId || null;
      const companyName = t.companyName || "";
      const items = t.items || [];

      for (const it of items) {
        const productTypeId = it.productTypeId?.toString();
        const productTypeName = it.productTypeName || "";
        const net = Number(it.netWeightKg || 0);

        if (net > 0) {
          addToMap(
            companyId,
            companyName,
            productTypeId,
            productTypeName,
            net,
            t.updatedAt || t.createdAt
          );
        }
      }
    }

    // 3️⃣ SALE transactions → subtract items
    const sales = await Transaction.find({ type: "SALE" }).lean();
    for (const t of sales) {
      const companyId = t.companyId || null;
      const companyName = t.companyName || "";
      const items = t.items || [];

      for (const it of items) {
        const productTypeId = it.productTypeId?.toString();
        const productTypeName = it.productTypeName || "";
        const net = Number(it.netWeightKg || 0);

        if (net > 0) {
          addToMap(
            companyId,
            companyName,
            productTypeId,
            productTypeName,
            -net,
            t.updatedAt || t.createdAt
          );
        }
      }
    }

    // 4️⃣ Final rows: fix companyName & lastUpdated
    const rows = [];
    for (const val of map.values()) {
      if (val.balanceKg <= 0.0001) continue;

      val.balanceKg = +val.balanceKg.toFixed(3);

      if (val.lastUpdated) {
        val.lastUpdated = new Date(val.lastUpdated);
      }

      // 🔹 If companyName empty but we have companyId → lookup
      if (val.companyId && !val.companyName) {
        // eslint-disable-next-line no-await-in-loop
        val.companyName = await getCompanyName(val.companyId, "");
      }

      // 🔹 If still no company info → treat as Mill Own Stock
      if (!val.companyId && !val.companyName) {
        val.companyName = "Mill Own Stock";
      }

      rows.push(val);
    }

    const summary = {
      totalProducts: rows.length,
      totalKg: +rows.reduce((sum, r) => sum + r.balanceKg, 0).toFixed(3),
    };

    return res.json({ success: true, data: rows, summary });
  } catch (err) {
    console.error("getCurrentStock error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while computing current stock.",
    });
  }
};
