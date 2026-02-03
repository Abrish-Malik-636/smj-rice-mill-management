// backend/controllers/gatePassController.js
const GatePass = require("../models/gatePassModel");
const StockLedger = require("../models/stockLedgerModel");
const ManagerialStockLedger = require("../models/managerialStockLedgerModel");
const SystemSettings = require("../models/systemSettingsModel");

const toKg = (quantity, unit, bagWeightKg = 65) => {
  const qty = Number(quantity || 0);
  const u = String(unit || "kg").toLowerCase();
  if (!qty) return 0;
  if (u === "kg") return Math.floor(qty);
  if (u === "ton") return Math.floor(qty * 1000);
  if (u === "mounds") return Math.floor(qty * 40);
  if (u === "bags") return Math.floor(qty * bagWeightKg);
  return Math.floor(qty);
};

const getItemName = (item) => {
  if (!item) return "";
  if (item.itemType === "Other" && item.customItemName) {
    return item.customItemName;
  }
  return item.itemType || "";
};

/** Build production ledger ops from items array (e.g. req.body.items or gp.items). Use gp for type, id, gatePassNo, createdAt. */
const buildProductionOpsFromItems = (items, gp, bagWeightKg = 65) => {
  const ops = [];
  if (!items || !Array.isArray(items) || gp.type !== "IN") return ops;
  const date = gp.createdAt || gp.date || new Date();
  const gatePassId = gp._id;
  const gatePassNo = gp.gatePassNo || "";

  items.forEach((item) => {
    const stockType = (item && item.stockType) || "Production";
    if (stockType !== "Production") return;
    const qty = Number(item && item.quantity);
    if (!qty || qty <= 0) return;
    const kg = toKg(qty, (item && item.unit) || "kg", bagWeightKg);
    if (!kg) return;
    const name = getItemName(item) || "Paddy";
    ops.push({
      date,
      type: "IN",
      companyId: null,
      companyName: "",
      productTypeId: null,
      productTypeName: name,
      numBags: 0,
      netWeightKg: kg,
      gatePassId,
      gatePassNo,
      remarks: "Gate pass IN (Production)",
    });
  });
  return ops;
};

const buildProductionOps = (gp, bagWeightKg = 65) => {
  return buildProductionOpsFromItems(gp.items || [], gp, bagWeightKg);
};

const buildManagerialOps = (gp) => {
  const ops = [];
  const items = gp.items || [];
  if (gp.type !== "IN") return ops;
  items.forEach((item) => {
    if (item.stockType !== "Managerial") return;
    const qty = Number(item.quantity || 0);
    if (!qty) return;
    ops.push({
      date: gp.createdAt || new Date(),
      type: "IN",
      itemName: getItemName(item) || "Managerial Item",
      quantity: qty,
      unit: item.unit || "pcs",
      gatePassId: gp._id,
      gatePassNo: gp.gatePassNo || "",
      remarks: "Gate pass IN (Managerial)",
    });
  });
  return ops;
};

const buildSearchQuery = (search, type) => {
  const q = {};
  if (type) q.type = type;
  if (search) {
    q.$or = [
      { truckNo: { $regex: search, $options: "i" } },
      { supplier: { $regex: search, $options: "i" } },
      { customer: { $regex: search, $options: "i" } },
      { gatePassNo: { $regex: search, $options: "i" } },
      { driverName: { $regex: search, $options: "i" } },
    ];
  }
  return q;
};

exports.createGatePass = async (req, res) => {
  try {
    const body = req.body || {};

    if (body.type === "IN") {
      // Supplier/source is optional for IN gate pass
    }

    if (body.type === "OUT") {
      if (!body.customer || String(body.customer).trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Customer is required for OUT gate pass.",
        });
      }
      if (!body.invoiceId) {
        return res.status(400).json({
          success: false,
          message: "Invoice is required for OUT gate pass.",
        });
      }
    }

    // Validate items array
    if (!body.items || body.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one item is required.",
      });
    }

    const gp = await GatePass.create(body);
    try {
      const settings = await SystemSettings.findOne({}).select("defaultBagWeightKg").lean();
      const bagWeightKg = settings && settings.defaultBagWeightKg != null ? settings.defaultBagWeightKg : 65;
      // Use body.items (what was sent) so we don't rely on saved doc shape; gp provides _id, gatePassNo, createdAt
      const productionOps = buildProductionOpsFromItems(body.items || [], gp, bagWeightKg);
      if (productionOps.length > 0) {
        await StockLedger.insertMany(productionOps);
      }
      const managerialOps = buildManagerialOps(gp);
      if (managerialOps.length > 0) {
        await ManagerialStockLedger.insertMany(managerialOps);
      }
    } catch (e) {
      console.error("Gate pass stock update error:", e);
      // Still return 201; gate pass was created. Caller may retry or fix stock manually.
    }
    return res.status(201).json({ success: true, data: gp });
  } catch (err) {
    let message = err.message || "Failed to create gate pass.";
    if (err.name === "ValidationError") {
      const firstKey = Object.keys(err.errors)[0];
      message = err.errors[firstKey].message;
    }
    return res.status(400).json({ success: false, message });
  }
};

exports.getGatePasses = async (req, res) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "10", 10);
    const search = req.query.search || "";
    const type = req.query.type || "";
    const status = req.query.status || "";

    const query = buildSearchQuery(search, type || undefined);
    if (status) query.status = status;

    const total = await GatePass.countDocuments(query);
    const data = await GatePass.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ success: true, data, total });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch gate passes." });
  }
};

exports.getGatePass = async (req, res) => {
  try {
    const gp = await GatePass.findById(req.params.id);
    if (!gp)
      return res
        .status(404)
        .json({ success: false, message: "Gate pass not found." });
    res.json({ success: true, data: gp });
  } catch (err) {
    res
      .status(404)
      .json({ success: false, message: "Gate pass not found or invalid id." });
  }
};

exports.updateGatePass = async (req, res) => {
  try {
    const body = { ...req.body };
    delete body.gatePassNo;

    const gp = await GatePass.findByIdAndUpdate(req.params.id, body, {
      new: true,
      runValidators: true,
    });

    if (gp) {
      try {
        await StockLedger.deleteMany({ gatePassId: gp._id });
        await ManagerialStockLedger.deleteMany({ gatePassId: gp._id });
        const settings = await SystemSettings.findOne({}).select("defaultBagWeightKg").lean();
        const bagWeightKg = settings && settings.defaultBagWeightKg != null ? settings.defaultBagWeightKg : 65;
        const productionOps = buildProductionOpsFromItems(body.items || gp.items || [], gp, bagWeightKg);
        if (productionOps.length > 0) {
          await StockLedger.insertMany(productionOps);
        }
        const managerialOps = buildManagerialOps(gp);
        if (managerialOps.length > 0) {
          await ManagerialStockLedger.insertMany(managerialOps);
        }
      } catch (e) {
        console.error("Gate pass stock update error:", e);
      }
    }

    if (!gp)
      return res
        .status(404)
        .json({ success: false, message: "Gate pass not found." });
    res.json({ success: true, data: gp });
  } catch (err) {
    let message = err.message || "Failed to update.";
    if (err.name === "ValidationError") {
      const firstKey = Object.keys(err.errors)[0];
      message = err.errors[firstKey].message;
    }
    res.status(400).json({ success: false, message });
  }
};

exports.deleteGatePass = async (req, res) => {
  try {
    const gp = await GatePass.findByIdAndDelete(req.params.id);
    if (!gp)
      return res
        .status(404)
        .json({ success: false, message: "Gate pass not found." });
    try {
      await StockLedger.deleteMany({ gatePassId: gp._id });
      await ManagerialStockLedger.deleteMany({ gatePassId: gp._id });
    } catch (e) {
      console.error("Gate pass stock delete error:", e);
    }
    res.json({ success: true });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Unable to delete gate pass." });
  }
};

// Get unique custom item names for suggestions
exports.getCustomItems = async (req, res) => {
  try {
    const items = await GatePass.distinct("items.customItemName");
    const filtered = items.filter((item) => item && item.trim() !== "");
    res.json({ success: true, data: filtered });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch custom items." });
  }
};
