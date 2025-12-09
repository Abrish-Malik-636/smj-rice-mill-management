// backend/controllers/gatePassController.js
const GatePass = require("../models/gatePassModel");

// helper builds query
const buildSearchQuery = (search, type) => {
  const q = {};
  if (type) q.type = type;
  if (search) {
    q.$or = [
      { truckNo: { $regex: search, $options: "i" } },
      { supplier: { $regex: search, $options: "i" } },
      { customer: { $regex: search, $options: "i" } },
      { itemType: { $regex: search, $options: "i" } },
      { gatePassNo: { $regex: search, $options: "i" } },
    ];
  }
  return q;
};

exports.createGatePass = async (req, res) => {
  try {
    const body = req.body || {};

    // Per-type required checks:
    if (body.type === "IN") {
      if (!body.supplier || String(body.supplier).trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Supplier is required for IN gate pass.",
        });
      }
    }

    if (body.type === "OUT") {
      if (!body.customer || String(body.customer).trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Customer is required for OUT gate pass.",
        });
      }
      if (body.quantity == null || body.quantity === "") {
        return res.status(400).json({
          success: false,
          message: "Quantity is required for OUT gate pass.",
        });
      }
      if (isNaN(body.quantity) || Number(body.quantity) <= 0) {
        return res.status(400).json({
          success: false,
          message: "Quantity must be a number greater than 0.",
        });
      }
    }

    // Create (mongoose validators will run for formats)
    const gp = await GatePass.create(body);
    return res.status(201).json({ success: true, data: gp });
  } catch (err) {
    // friendly validation message extraction
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

    const query = buildSearchQuery(search, type || undefined);
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
    delete body.gatePassNo; // never change

    if (body.type === "OUT" && body.quantity != null) {
      if (isNaN(body.quantity) || Number(body.quantity) <= 0) {
        return res.status(400).json({
          success: false,
          message: "Quantity must be a number greater than 0.",
        });
      }
    }

    const gp = await GatePass.findByIdAndUpdate(req.params.id, body, {
      new: true,
      runValidators: true,
    });

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
    res.json({ success: true });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Unable to delete gate pass." });
  }
};
