const ManagerialStock = require("../models/managerialStockModel");
const ManagerialStockLedger = require("../models/managerialStockLedgerModel");

const normalizeText = (text) => {
  return text ? text.toLowerCase().trim().replace(/\s+/g, " ") : "";
};

const checkSimilar = async (name, excludeId = null) => {
  const normalized = normalizeText(name);
  const query = {
    $or: [
      { name: { $regex: new RegExp(`^${normalized}$`, "i") } },
      { name: { $regex: new RegExp(normalized, "i") } },
    ],
  };
  if (excludeId) query._id = { $ne: excludeId };
  return await ManagerialStock.findOne(query);
};

exports.getAll = async (req, res) => {
  try {
    const items = await ManagerialStock.find().sort({ name: 1 });
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const similar = await checkSimilar(req.body.name);
    if (similar) {
      return res.status(400).json({
        success: false,
        message: `Item with similar name already exists: "${similar.name}"`,
      });
    }
    const payload = {
      name: req.body.name?.trim(),
      category: req.body.category?.trim(),
      unit: req.body.unit?.trim() || "Nos",
      condition: req.body.condition?.trim() || "",
      description: req.body.description?.trim() || "",
    };
    const item = await ManagerialStock.create(payload);
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(", ") });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    if (req.body.name) {
      const similar = await checkSimilar(req.body.name, req.params.id);
      if (similar) {
        return res.status(400).json({
          success: false,
          message: `Item with similar name already exists: "${similar.name}"`,
        });
      }
    }
    const updateData = { ...req.body };
    delete updateData.quantity;
    delete updateData.location;
    const updated = await ManagerialStock.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ success: false, message: "Item not found" });
    res.json({ success: true, data: updated });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(", ") });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const deleted = await ManagerialStock.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: "Item not found" });
    res.json({ success: true, message: "Item deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOverview = async (req, res) => {
  try {
    const map = new Map();
    const rows = await ManagerialStockLedger.find().lean();
    rows.forEach((r) => {
      const key = r.itemName || "Unknown";
      const qty = Number(r.quantity || 0);
      if (!qty) return;
      const delta = r.type === "OUT" ? -qty : qty;
      const dateTime = r.updatedAt || r.createdAt;
      const existing = map.get(key) || {
        itemName: key,
        balanceQty: 0,
        lastUpdated: null,
        sources: [],
      };
      existing.balanceQty += delta;
      if (dateTime) {
        const d = new Date(dateTime);
        if (!existing.lastUpdated || d > existing.lastUpdated) {
          existing.lastUpdated = d;
        }
      }
      existing.sources.push({
        sourceType: r.sourceType || "Gate Pass",
        refNo: r.refNo || r.gatePassNo || "-",
        date: r.date,
        dateTime,
        qty: delta,
        direction: r.type,
      });
      map.set(key, existing);
    });

    const data = Array.from(map.values()).filter((r) => r.balanceQty > 0);
    const summary = {
      totalItems: data.length,
      totalQty: data.reduce((sum, r) => sum + r.balanceQty, 0),
    };
    res.json({ success: true, data, summary });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
