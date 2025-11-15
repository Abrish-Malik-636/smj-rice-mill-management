// backend/controllers/gatePassController.js
const GatePass = require("../models/gatePassModel");
const mongoose = require("mongoose");

/**
 * Generate GatePassNo: GP-YYYYMMDD-HHMMSS
 * Uses local server time.
 */
function generateGatePassNo() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const YYYY = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const DD = pad(d.getDate());
  const HH = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `GP-${YYYY}${MM}${DD}-${HH}${mm}${ss}`;
}

/**
 * Helper to compute netWeightKg and totalAmount (if OUT)
 */
function computeValues(data) {
  // Ensure numeric
  const numBags = Number(data.numBags) || 0;
  const bagWeightKg = Number(data.bagWeightKg) || 0;
  const emptyBagWeightKg = Number(data.emptyBagWeightKg) || 0;

  const perBagNet = Math.max(bagWeightKg - emptyBagWeightKg, 0);
  const netWeightKg = +(numBags * perBagNet).toFixed(3);

  let totalAmount = 0;
  if (data.type === "OUT") {
    const rate = Number(data.rate) || 0;
    if (data.rateType === "per_bag") {
      totalAmount = +(numBags * rate).toFixed(2);
    } else {
      totalAmount = +(netWeightKg * rate).toFixed(2);
    }
  }

  return { netWeightKg, totalAmount };
}

/**
 * Basic validation for IN/OUT types.
 * Returns null if ok, or an error message string.
 */
function validatePayload(body, isUpdate = false) {
  // required common fields
  const requiredCommon = [
    "type",
    "date",
    "companyId",
    "companyName",
    "productTypeId",
    "productTypeName",
    "numBags",
    "bagWeightKg",
    "emptyBagWeightKg",
  ];
  for (const fld of requiredCommon) {
    if (!body[fld] && body[fld] !== 0) return `Field "${fld}" is required.`;
  }

  if (body.type !== "IN" && body.type !== "OUT")
    return `Field "type" must be "IN" or "OUT".`;

  // For OUT, rate and rateType are required (rateType default will be 'per_bag' if missing)
  if (body.type === "OUT") {
    if (body.rate === undefined || body.rate === null)
      return `Field "rate" is required for OUT gate passes.`;
    if (!body.rateType)
      return `Field "rateType" is required for OUT gate passes.`;
    if (!["per_bag", "per_kg"].includes(body.rateType))
      return `Field "rateType" must be "per_bag" or "per_kg".`;
  }

  return null;
}

/** Create GatePass */
exports.createGatePass = async (req, res) => {
  try {
    const payload = req.body;

    // validate payload
    const vErr = validatePayload(payload);
    if (vErr) return res.status(400).json({ success: false, message: vErr });

    // compute net and total
    const { netWeightKg, totalAmount } = computeValues(payload);

    // generate unique GP no
    let gpNo = generateGatePassNo();

    // Ensure uniqueness - if collision (very unlikely), regenerate a few times
    let attempts = 0;
    while (attempts < 5) {
      const exists = await GatePass.findOne({ gatePassNo: gpNo });
      if (!exists) break;
      gpNo = generateGatePassNo();
      attempts++;
    }

    const doc = new GatePass({
      gatePassNo: gpNo,
      type: payload.type,
      date: payload.date,
      companyId: payload.companyId,
      companyName: payload.companyName,
      productTypeId: payload.productTypeId,
      productTypeName: payload.productTypeName,
      numBags: Number(payload.numBags),
      bagWeightKg: Number(payload.bagWeightKg),
      emptyBagWeightKg: Number(payload.emptyBagWeightKg),
      netWeightKg,
      rate: payload.type === "OUT" ? Number(payload.rate) : 0,
      rateType: payload.type === "OUT" ? payload.rateType : undefined,
      totalAmount: payload.type === "OUT" ? totalAmount : 0,
      sendTo: payload.type === "OUT" ? payload.sendTo || "" : "",
      remarks: payload.remarks || "",
    });

    const saved = await doc.save();
    return res.status(201).json({ success: true, data: saved });
  } catch (err) {
    console.error("createGatePass error:", err);
    return res
      .status(500)
      .json({
        success: false,
        message: "Server error while creating gate pass.",
      });
  }
};

/** Get all gatepasses (with optional type filter and basic query params) */
exports.getGatePasses = async (req, res) => {
  try {
    // query options: ?type=IN or OUT, ?limit=50, ?skip=0, ?sort=-date
    const { type, limit = 500, skip = 0, sort = "-date" } = req.query;
    const q = {};
    if (type === "IN" || type === "OUT") q.type = type;

    const total = await GatePass.countDocuments(q);
    const docs = await GatePass.find(q)
      .sort(sort)
      .skip(Number(skip))
      .limit(Number(limit))
      .lean();

    return res.json({ success: true, total, data: docs });
  } catch (err) {
    console.error("getGatePasses error:", err);
    return res
      .status(500)
      .json({
        success: false,
        message: "Server error while fetching gate passes.",
      });
  }
};

/** Get one by id */
exports.getGatePassById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ success: false, message: "Invalid id" });

    const doc = await GatePass.findById(id).lean();
    if (!doc)
      return res
        .status(404)
        .json({ success: false, message: "Gate pass not found" });

    return res.json({ success: true, data: doc });
  } catch (err) {
    console.error("getGatePassById error:", err);
    return res
      .status(500)
      .json({
        success: false,
        message: "Server error while fetching gate pass.",
      });
  }
};

/** Update gate pass (PUT) */
exports.updateGatePass = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ success: false, message: "Invalid id" });

    const existing = await GatePass.findById(id);
    if (!existing)
      return res
        .status(404)
        .json({ success: false, message: "Gate pass not found" });

    const payload = req.body;

    // do not allow editing gatePassNo
    if (payload.gatePassNo && payload.gatePassNo !== existing.gatePassNo) {
      return res
        .status(400)
        .json({ success: false, message: "GatePassNo cannot be changed." });
    }

    // Merge updates - but keep gatePassNo unchanged
    const allowUpdate = {
      type: payload.type || existing.type,
      date: payload.date || existing.date,
      companyId: payload.companyId || existing.companyId,
      companyName: payload.companyName || existing.companyName,
      productTypeId: payload.productTypeId || existing.productTypeId,
      productTypeName: payload.productTypeName || existing.productTypeName,
      numBags:
        payload.numBags !== undefined
          ? Number(payload.numBags)
          : existing.numBags,
      bagWeightKg:
        payload.bagWeightKg !== undefined
          ? Number(payload.bagWeightKg)
          : existing.bagWeightKg,
      emptyBagWeightKg:
        payload.emptyBagWeightKg !== undefined
          ? Number(payload.emptyBagWeightKg)
          : existing.emptyBagWeightKg,
      remarks:
        payload.remarks !== undefined ? payload.remarks : existing.remarks,
    };

    // If OUT fields present
    if (allowUpdate.type === "OUT") {
      allowUpdate.rate =
        payload.rate !== undefined ? Number(payload.rate) : existing.rate;
      allowUpdate.rateType =
        payload.rateType !== undefined ? payload.rateType : existing.rateType;
      allowUpdate.sendTo =
        payload.sendTo !== undefined ? payload.sendTo : existing.sendTo;
    } else {
      allowUpdate.rate = 0;
      allowUpdate.rateType = undefined;
      allowUpdate.sendTo = "";
    }

    // Validate
    const vErr = validatePayload(allowUpdate, true);
    if (vErr) return res.status(400).json({ success: false, message: vErr });

    // compute
    const { netWeightKg, totalAmount } = computeValues({
      ...allowUpdate,
      type: allowUpdate.type,
    });

    // apply
    existing.type = allowUpdate.type;
    existing.date = allowUpdate.date;
    existing.companyId = allowUpdate.companyId;
    existing.companyName = allowUpdate.companyName;
    existing.productTypeId = allowUpdate.productTypeId;
    existing.productTypeName = allowUpdate.productTypeName;
    existing.numBags = allowUpdate.numBags;
    existing.bagWeightKg = allowUpdate.bagWeightKg;
    existing.emptyBagWeightKg = allowUpdate.emptyBagWeightKg;
    existing.netWeightKg = netWeightKg;
    existing.rate = allowUpdate.rate || 0;
    existing.rateType = allowUpdate.rateType;
    existing.totalAmount = allowUpdate.type === "OUT" ? totalAmount : 0;
    existing.sendTo = allowUpdate.sendTo || "";
    existing.remarks = allowUpdate.remarks || "";

    const saved = await existing.save();
    return res.json({ success: true, data: saved });
  } catch (err) {
    console.error("updateGatePass error:", err);
    return res
      .status(500)
      .json({
        success: false,
        message: "Server error while updating gate pass.",
      });
  }
};

/** Delete gate pass */
exports.deleteGatePass = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ success: false, message: "Invalid id" });

    const deleted = await GatePass.findByIdAndDelete(id);
    if (!deleted)
      return res
        .status(404)
        .json({ success: false, message: "Gate pass not found" });

    return res.json({ success: true, message: "Gate pass deleted." });
  } catch (err) {
    console.error("deleteGatePass error:", err);
    return res
      .status(500)
      .json({
        success: false,
        message: "Server error while deleting gate pass.",
      });
  }
};

/**
 * Print endpoint: return structured data for frontend to render a print-card preview.
 * (Frontend will use this JSON to render the card preview; not a PDF.)
 */
exports.printGatePass = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ success: false, message: "Invalid id" });

    const doc = await GatePass.findById(id).lean();
    if (!doc)
      return res
        .status(404)
        .json({ success: false, message: "Gate pass not found" });

    // Format a friendly payload
    const payload = {
      gatePassNo: doc.gatePassNo,
      type: doc.type,
      date: doc.date,
      companyName: doc.companyName,
      productTypeName: doc.productTypeName,
      numBags: doc.numBags,
      bagWeightKg: doc.bagWeightKg,
      emptyBagWeightKg: doc.emptyBagWeightKg,
      netWeightKg: doc.netWeightKg,
      rate: doc.rate || 0,
      rateType: doc.rateType || null,
      totalAmount: doc.totalAmount || 0,
      sendTo: doc.sendTo || "",
      remarks: doc.remarks || "",
    };

    return res.json({ success: true, data: payload });
  } catch (err) {
    console.error("printGatePass error:", err);
    return res
      .status(500)
      .json({
        success: false,
        message: "Server error while preparing print preview.",
      });
  }
};

/**
 * Stats for today:
 * Returns aggregated counts and sums for today for IN and OUT.
 * Also returns nextGatePassNo (generated by server) and lastUpdatedTime.
 */
exports.getTodayStats = async (req, res) => {
  try {
    // compute today's date range (local server time)
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

    // Aggregate
    const pipeline = [
      {
        $match: {
          date: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          totalNetWeight: { $sum: "$netWeightKg" },
          totalAmount: { $sum: "$totalAmount" },
        },
      },
    ];

    const agg = await GatePass.aggregate(pipeline);

    const stats = {
      IN: { count: 0, totalNetWeight: 0, totalAmount: 0 },
      OUT: { count: 0, totalNetWeight: 0, totalAmount: 0 },
    };

    agg.forEach((g) => {
      if (g._id === "IN") {
        stats.IN.count = g.count;
        stats.IN.totalNetWeight = +(g.totalNetWeight || 0);
        stats.IN.totalAmount = +(g.totalAmount || 0);
      } else if (g._id === "OUT") {
        stats.OUT.count = g.count;
        stats.OUT.totalNetWeight = +(g.totalNetWeight || 0);
        stats.OUT.totalAmount = +(g.totalAmount || 0);
      }
    });

    // Last updated time (most recent updatedAt)
    const lastUpdatedDoc = await GatePass.findOne({
      date: { $gte: start, $lte: end },
    })
      .sort({ updatedAt: -1 })
      .select("updatedAt")
      .lean();

    const lastUpdatedTime = lastUpdatedDoc ? lastUpdatedDoc.updatedAt : null;

    // Next GP no (preview, not stored)
    const nextGatePassNo = generateGatePassNo();

    return res.json({
      success: true,
      data: {
        stats,
        nextGatePassNo,
        lastUpdatedTime,
      },
    });
  } catch (err) {
    console.error("getTodayStats error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error while computing stats." });
  }
};
