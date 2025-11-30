// backend/controllers/productionController.js
const mongoose = require("mongoose");
const ProductionBatch = require("../models/productionBatchModel");
const StockLedger = require("../models/stockLedgerModel");

// PB-YYYYMMDD-HHMMSS
function generateBatchNo() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const YYYY = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const DD = pad(d.getDate());
  const HH = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `PB-${YYYY}${MM}${DD}-${HH}${mm}${ss}`;
}

function recomputeAggregates(batch) {
  const totalRaw = Number(batch.paddyWeightKg) || 0;

  const totalOutput = (batch.outputs || []).reduce(
    (sum, o) => sum + (Number(o.netWeightKg) || 0),
    0
  );
  const dayOut = (batch.outputs || [])
    .filter((o) => o.shift === "DAY")
    .reduce((sum, o) => sum + (Number(o.netWeightKg) || 0), 0);
  const nightOut = (batch.outputs || [])
    .filter((o) => o.shift === "NIGHT")
    .reduce((sum, o) => sum + (Number(o.netWeightKg) || 0), 0);

  batch.totalRawWeightKg = +totalRaw.toFixed(3);
  batch.totalOutputWeightKg = +totalOutput.toFixed(3);
  batch.dayShiftOutputWeightKg = +dayOut.toFixed(3);
  batch.nightShiftOutputWeightKg = +nightOut.toFixed(3);
}

/**
 * POST /api/production/batches
 * Body: { date, paddyWeightKg, remarks? }
 * Creates batch and reserves paddy (OUT).
 */
exports.createBatch = async (req, res) => {
  try {
    const { date, paddyWeightKg, remarks } = req.body;
    if (!date)
      return res
        .status(400)
        .json({ success: false, message: "Field 'date' is required" });

    if (paddyWeightKg == null || isNaN(Number(paddyWeightKg))) {
      return res
        .status(400)
        .json({ success: false, message: "Field 'paddyWeightKg' is required" });
    }

    let batchNo = generateBatchNo();
    let attempts = 0;
    while (attempts < 5) {
      const exists = await ProductionBatch.findOne({ batchNo });
      if (!exists) break;
      batchNo = generateBatchNo();
      attempts++;
    }

    const batch = new ProductionBatch({
      batchNo,
      date,
      status: "IN_PROCESS",
      paddyWeightKg: Number(paddyWeightKg),
      outputs: [],
      remarks: remarks || "",
    });

    recomputeAggregates(batch);
    const saved = await batch.save();

    // Reserve paddy as OUT from raw stock
    try {
      const ledger = new StockLedger({
        date: saved.date,
        type: "OUT",
        companyId: null,
        companyName: "",
        productTypeId: null,
        productTypeName: "Paddy",
        numBags: 0,
        netWeightKg: saved.paddyWeightKg,
        gatePassId: null,
        gatePassNo: "",
        remarks: `Paddy assigned to production batch ${saved.batchNo}`,
      });
      await ledger.save();
    } catch (e) {
      console.error("StockLedger (createBatch) error:", e);
    }

    return res.status(201).json({ success: true, data: saved });
  } catch (err) {
    console.error("createBatch error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Error creating batch." });
  }
};

/**
 * PUT /api/production/batches/:id
 * Body: { date?, paddyWeightKg?, remarks? }
 * Only when IN_PROCESS.
 * Adjusts paddy stock by delta.
 */
exports.updateBatch = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ success: false, message: "Invalid id" });

    const batch = await ProductionBatch.findById(id);
    if (!batch)
      return res
        .status(404)
        .json({ success: false, message: "Batch not found" });

    if (batch.status !== "IN_PROCESS") {
      return res.status(400).json({
        success: false,
        message: "Completed batch cannot be edited.",
      });
    }

    const { date, paddyWeightKg, remarks } = req.body;

    if (date) batch.date = date;

    let delta = 0;
    if (paddyWeightKg != null && !isNaN(Number(paddyWeightKg))) {
      const newWeight = Number(paddyWeightKg);
      delta = newWeight - batch.paddyWeightKg;
      batch.paddyWeightKg = newWeight;
    }

    if (remarks !== undefined) {
      batch.remarks = remarks || "";
    }

    recomputeAggregates(batch);
    const saved = await batch.save();

    // Adjust raw paddy stock for delta
    if (delta !== 0) {
      try {
        const isIncrease = delta > 0; // more paddy consumed
        const ledger = new StockLedger({
          date: saved.date,
          type: isIncrease ? "OUT" : "IN",
          companyId: null,
          companyName: "",
          productTypeId: null,
          productTypeName: "Paddy",
          numBags: 0,
          netWeightKg: Math.abs(delta),
          gatePassId: null,
          gatePassNo: "",
          remarks: isIncrease
            ? `Paddy adjustment (extra) - ${saved.batchNo}`
            : `Paddy adjustment (return) - ${saved.batchNo}`,
        });
        await ledger.save();
      } catch (e) {
        console.error("StockLedger (updateBatch) error:", e);
      }
    }

    return res.json({ success: true, data: saved });
  } catch (err) {
    console.error("updateBatch error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Error updating batch." });
  }
};

/**
 * DELETE /api/production/batches/:id
 * - If IN_PROCESS: delete + return paddy to stock (IN).
 * - If COMPLETED: delete + return paddy to stock (IN) + remove finished stock (OUT).
 */
exports.deleteBatch = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ success: false, message: "Invalid id" });

    const batch = await ProductionBatch.findById(id);
    if (!batch)
      return res
        .status(404)
        .json({ success: false, message: "Batch not found" });

    const wasCompleted = batch.status === "COMPLETED";

    // Keep data for stock reverse before deleting
    const paddyWeight = batch.paddyWeightKg || 0;
    const outputs = batch.outputs || [];

    await batch.deleteOne();

    // Reverse stock
    try {
      const ledgerOps = [];

      // 1) Return paddy to stock (IN)
      if (paddyWeight > 0) {
        ledgerOps.push({
          date: batch.date,
          type: "IN",
          companyId: null,
          companyName: "",
          productTypeId: null,
          productTypeName: "Paddy",
          numBags: 0,
          netWeightKg: paddyWeight,
          gatePassId: null,
          gatePassNo: "",
          remarks: `Batch deleted, paddy returned - ${batch.batchNo}`,
        });
      }

      // 2) If it was COMPLETED, also remove finished stock (OUT for each output)
      if (wasCompleted && outputs.length > 0) {
        outputs.forEach((o) => {
          if (!o.productTypeId || !o.netWeightKg) return;
          ledgerOps.push({
            date: batch.date,
            type: "OUT",
            companyId: o.companyId || null,
            companyName: o.companyName || "",
            productTypeId: o.productTypeId,
            productTypeName: o.productTypeName,
            numBags: o.numBags || 0,
            netWeightKg: o.netWeightKg || 0,
            gatePassId: null,
            gatePassNo: "",
            remarks: `Batch deleted, finished stock reversed - ${batch.batchNo}`,
          });
        });
      }

      if (ledgerOps.length > 0) {
        await StockLedger.insertMany(ledgerOps);
      }
    } catch (e) {
      console.error("StockLedger (deleteBatch) error:", e);
      // don’t crash if ledger fails; batch is already removed
    }

    return res.json({
      success: true,
      message: wasCompleted
        ? "Completed batch deleted and stock reversed."
        : "Batch deleted and paddy returned to stock.",
    });
  } catch (err) {
    console.error("deleteBatch error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Error deleting batch." });
  }
};

/**
 * GET /api/production/batches
 * Query: status?, page?, limit?
 */
exports.listBatches = async (req, res) => {
  try {
    let { status, page = 1, limit = 50 } = req.query;
    page = Number(page) || 1;
    limit = Number(limit) || 50;

    const q = {};
    if (status && ["IN_PROCESS", "COMPLETED"].includes(status))
      q.status = status;

    const total = await ProductionBatch.countDocuments(q);
    const data = await ProductionBatch.find(q)
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return res.json({ success: true, total, page, limit, data });
  } catch (err) {
    console.error("listBatches error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Error fetching batches." });
  }
};

/**
 * GET /api/production/batches/:id
 */
exports.getBatchById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ success: false, message: "Invalid id" });

    const batch = await ProductionBatch.findById(id).lean();
    if (!batch)
      return res
        .status(404)
        .json({ success: false, message: "Batch not found" });

    return res.json({ success: true, data: batch });
  } catch (err) {
    console.error("getBatchById error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Error fetching batch." });
  }
};

/**
 * POST /api/production/batches/:id/outputs
 * Body: { productTypeId, productTypeName, companyId?, companyName?, numBags, perBagWeightKg, shift }
 * netWeight = numBags * perBagWeightKg (computed here).
 */
exports.addOutput = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      productTypeId,
      productTypeName,
      companyId,
      companyName,
      numBags,
      perBagWeightKg,
      shift,
    } = req.body;

    if (
      !productTypeId ||
      !productTypeName ||
      !shift ||
      numBags == null ||
      perBagWeightKg == null
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Fields productTypeId, productTypeName, shift, numBags, perBagWeightKg are required.",
      });
    }

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company is required for each finished output.",
      });
    }

    if (!["DAY", "NIGHT"].includes(shift)) {
      return res
        .status(400)
        .json({ success: false, message: "shift must be DAY or NIGHT" });
    }

    const batch = await ProductionBatch.findById(id);
    if (!batch)
      return res
        .status(404)
        .json({ success: false, message: "Batch not found" });

    if (batch.status !== "IN_PROCESS") {
      return res.status(400).json({
        success: false,
        message: "Cannot add output to completed batch.",
      });
    }

    const bags = Number(numBags);
    const perBag = Number(perBagWeightKg);
    const netWeight = +(bags * perBag).toFixed(3);

    const output = {
      productTypeId,
      productTypeName,
      companyId: companyId || null,
      companyName: companyName || "",
      numBags: bags,
      netWeightKg: netWeight,
      shift,
    };

    batch.outputs.push(output);
    recomputeAggregates(batch);
    const saved = await batch.save();

    return res.json({ success: true, data: saved });
  } catch (err) {
    console.error("addOutput error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Error adding output." });
  }
};

/**
 * POST /api/production/batches/:id/complete
 * Marks batch COMPLETED and creates IN stock entries for outputs.
 */
exports.completeBatch = async (req, res) => {
  try {
    const { id } = req.params;

    const batch = await ProductionBatch.findById(id);
    if (!batch)
      return res
        .status(404)
        .json({ success: false, message: "Batch not found" });

    if (batch.status === "COMPLETED") {
      return res
        .status(400)
        .json({ success: false, message: "Batch already completed." });
    }

    if (!batch.outputs || batch.outputs.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Add at least one output before completing batch.",
      });
    }

    recomputeAggregates(batch);
    batch.status = "COMPLETED";
    const saved = await batch.save();

    // Finished stock IN
    try {
      const ops = (batch.outputs || []).map((o) => ({
        date: saved.date,
        type: "IN",
        companyId: o.companyId || null,
        companyName: o.companyName || "",
        productTypeId: o.productTypeId,
        productTypeName: o.productTypeName,
        numBags: o.numBags,
        netWeightKg: o.netWeightKg,
        gatePassId: null,
        gatePassNo: "",
        remarks: `Production output (${o.shift}) - ${saved.batchNo}`,
      }));

      if (ops.length > 0) {
        await StockLedger.insertMany(ops);
      }
    } catch (e) {
      console.error("StockLedger (completeBatch) error:", e);
    }

    return res.json({ success: true, data: saved });
  } catch (err) {
    console.error("completeBatch error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Error completing batch." });
  }
};

/**
 * GET /api/production/summary/today
 * For cards: day/night/total outputs, batch count.
 */
exports.getTodaySummary = async (req, res) => {
  try {
    const now = new Date();
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0
    );
    const end = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999
    );

    const batches = await ProductionBatch.find({
      date: { $gte: start, $lte: end },
    }).lean();

    let day = 0;
    let night = 0;
    let totalOutput = 0;

    batches.forEach((b) => {
      day += b.dayShiftOutputWeightKg || 0;
      night += b.nightShiftOutputWeightKg || 0;
      totalOutput += b.totalOutputWeightKg || 0;
    });

    return res.json({
      success: true,
      data: {
        dayShiftOutputWeightKg: +day.toFixed(3),
        nightShiftOutputWeightKg: +night.toFixed(3),
        totalOutputWeightKg: +totalOutput.toFixed(3),
        batchCount: batches.length,
      },
    });
  } catch (err) {
    console.error("getTodaySummary error:", err);
    return res.status(500).json({
      success: false,
      message: "Error fetching production summary.",
    });
  }
};
