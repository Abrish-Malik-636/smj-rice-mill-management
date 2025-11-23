// backend/controllers/transactionController.js
const mongoose = require("mongoose");
const Transaction = require("../models/transactionModel");
const Company = require("../models/companyModel");
const ProductType = require("../models/productTypeModel");
const SystemSettings = require("../models/systemSettingsModel");

/**
 * Generate invoice number using SystemSettings:
 * invoicePrefix + (invoiceStartFrom + currentCount), padded to 4 digits
 * Example: INV-0001, INV-0002, ...
 */
async function generateInvoiceNo(txnType) {
  // load settings (or defaults)
  let settings = await SystemSettings.findOne({});
  if (!settings) {
    settings = await SystemSettings.create({});
  }

  let prefix = settings.invoicePrefix || "INV-";
  // If later you want different prefix per type, you can extend:
  // if (txnType === "SALE") prefix = settings.saleInvoicePrefix || "SINV-";
  // if (txnType === "PURCHASE") prefix = settings.purchaseInvoicePrefix || "PINV-";

  const startFrom = settings.invoiceStartFrom || 1;

  // Count existing transactions (simple approach)
  const count = await Transaction.countDocuments({});
  const nextNumber = startFrom + count;
  const padded = String(nextNumber).padStart(4, "0");

  return `${prefix}${padded}`;
}

/**
 * Compute amounts for items.
 */
function computeItemAmounts(itemsRaw) {
  const items = [];
  let totalAmount = 0;

  for (const raw of itemsRaw) {
    const numBags = Number(raw.numBags) || 0;
    const perBagWeightKg = Number(raw.perBagWeightKg) || 0;

    const netWeightKgRaw =
      raw.netWeightKg !== undefined && raw.netWeightKg !== ""
        ? Number(raw.netWeightKg)
        : numBags * perBagWeightKg;

    const netWeightKg = +netWeightKgRaw.toFixed(3);

    const rate = Number(raw.rate) || 0;
    const rateType = raw.rateType === "per_bag" ? "per_bag" : "per_kg";

    let amount = 0;
    if (rateType === "per_bag") {
      amount = numBags * rate;
    } else {
      amount = netWeightKg * rate;
    }

    amount = +amount.toFixed(2);
    totalAmount += amount;

    items.push({
      productTypeId: raw.productTypeId,
      productTypeName: "", // filled after we resolve product names
      numBags,
      perBagWeightKg,
      netWeightKg,
      rate,
      rateType,
      amount,
    });
  }

  totalAmount = +totalAmount.toFixed(2);
  return { items, totalAmount };
}

/**
 * Basic validation for transaction payload.
 */
function validatePayload(body) {
  const requiredFields = ["type", "date", "companyId", "items"];
  for (const f of requiredFields) {
    if (!body[f]) return `Field "${f}" is required.`;
  }

  if (!["PURCHASE", "SALE"].includes(body.type)) {
    return `Field "type" must be "PURCHASE" or "SALE".`;
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return "At least one item is required.";
  }

  // Payment status
  const payStatus = body.paymentStatus || "PAID";
  if (!["PAID", "UNPAID", "PARTIAL"].includes(payStatus)) {
    return `Field "paymentStatus" must be "PAID", "UNPAID" or "PARTIAL".`;
  }

  if ((payStatus === "UNPAID" || payStatus === "PARTIAL") && !body.dueDate) {
    return "Due date is required for unpaid or partial payments.";
  }

  // Payment method
  const payMethod = body.paymentMethod || "CASH";
  if (!["CASH", "CARD", "BANK_TRANSFER", "CREDIT"].includes(payMethod)) {
    return `Field "paymentMethod" must be one of CASH, CARD, BANK_TRANSFER, CREDIT.`;
  }

  // Items-level checks
  for (let i = 0; i < body.items.length; i++) {
    const it = body.items[i];
    if (!it.productTypeId) {
      return `Item ${i + 1}: "productTypeId" is required.`;
    }
    if (it.rate === undefined || it.rate === null || it.rate === "") {
      return `Item ${i + 1}: "rate" is required.`;
    }
  }

  return null;
}

/**
 * CREATE transaction
 * POST /api/transactions
 */
exports.createTransaction = async (req, res) => {
  try {
    const payload = req.body || {};
    const validationMsg = validatePayload(payload);
    if (validationMsg) {
      return res.status(400).json({ success: false, message: validationMsg });
    }

    // Company check
    const company = await Company.findById(payload.companyId).lean();
    if (!company) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid companyId" });
    }

    // Compute item amounts
    const { items, totalAmount } = computeItemAmounts(payload.items);

    // Resolve product names
    const productIds = items.map((i) => i.productTypeId);
    const productDocs = await ProductType.find({
      _id: { $in: productIds },
    })
      .lean()
      .select("name");
    const productMap = {};
    for (const p of productDocs) {
      productMap[p._id.toString()] = p.name;
    }
    for (const item of items) {
      item.productTypeName =
        productMap[item.productTypeId.toString()] || "Unknown";
    }

    // Generate invoice number
    const invoiceNo = await generateInvoiceNo(payload.type);

    const doc = new Transaction({
      type: payload.type,
      invoiceNo,
      date: new Date(payload.date),
      companyId: payload.companyId,
      companyName: company.name,
      paymentStatus: payload.paymentStatus || "PAID",
      paymentMethod: payload.paymentMethod || "CASH",
      dueDate:
        payload.paymentStatus === "PAID" || !payload.dueDate
          ? null
          : new Date(payload.dueDate),
      remarks: payload.remarks || "",
      items,
      totalAmount,
    });

    const saved = await doc.save();
    return res.status(201).json({ success: true, data: saved });
  } catch (err) {
    console.error("createTransaction error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while creating transaction.",
    });
  }
};

/**
 * GET list
 * GET /api/transactions?type=SALE|PURCHASE&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&companyId=&limit=&skip=
 */
exports.getTransactions = async (req, res) => {
  try {
    const {
      type,
      startDate,
      endDate,
      companyId,
      limit = 50,
      skip = 0,
    } = req.query;

    const q = {};
    if (type === "SALE" || type === "PURCHASE") {
      q.type = type;
    }

    if (companyId && mongoose.isValidObjectId(companyId)) {
      q.companyId = companyId;
    }

    if (startDate || endDate) {
      q.date = {};
      if (startDate) {
        q.date.$gte = new Date(startDate);
      }
      if (endDate) {
        const d = new Date(endDate);
        d.setHours(23, 59, 59, 999);
        q.date.$lte = d;
      }
    }

    const total = await Transaction.countDocuments(q);
    const docs = await Transaction.find(q)
      .sort({ date: -1, createdAt: -1 })
      .skip(Number(skip))
      .limit(Number(limit))
      .lean();

    return res.json({ success: true, total, data: docs });
  } catch (err) {
    console.error("getTransactions error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching transactions.",
    });
  }
};

/**
 * GET single
 * GET /api/transactions/:id
 */
exports.getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }

    const doc = await Transaction.findById(id).lean();
    if (!doc) {
      return res
        .status(404)
        .json({ success: false, message: "Transaction not found" });
    }

    return res.json({ success: true, data: doc });
  } catch (err) {
    console.error("getTransactionById error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching transaction.",
    });
  }
};

/**
 * UPDATE
 * PUT /api/transactions/:id
 */
exports.updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }

    const existing = await Transaction.findById(id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Transaction not found" });
    }

    const payload = req.body || {};

    // Do not allow changing type or invoiceNo
    if (payload.type && payload.type !== existing.type) {
      return res.status(400).json({
        success: false,
        message: "Transaction type cannot be changed.",
      });
    }
    if (payload.invoiceNo && payload.invoiceNo !== existing.invoiceNo) {
      return res.status(400).json({
        success: false,
        message: "Invoice number cannot be changed.",
      });
    }

    // Validate using existing type
    const validationMsg = validatePayload({
      ...payload,
      type: existing.type,
    });
    if (validationMsg) {
      return res.status(400).json({ success: false, message: validationMsg });
    }

    // Company
    const companyId = payload.companyId || existing.companyId;
    const company = await Company.findById(companyId).lean();
    if (!company) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid companyId" });
    }

    // Items & totals
    const { items, totalAmount } = computeItemAmounts(payload.items);

    const productIds = items.map((i) => i.productTypeId);
    const productDocs = await ProductType.find({
      _id: { $in: productIds },
    })
      .lean()
      .select("name");
    const productMap = {};
    for (const p of productDocs) {
      productMap[p._id.toString()] = p.name;
    }
    for (const item of items) {
      item.productTypeName =
        productMap[item.productTypeId.toString()] || "Unknown";
    }

    existing.date = new Date(payload.date);
    existing.companyId = companyId;
    existing.companyName = company.name;
    existing.paymentStatus = payload.paymentStatus || "PAID";
    existing.paymentMethod =
      payload.paymentMethod || existing.paymentMethod || "CASH";
    existing.dueDate =
      existing.paymentStatus === "PAID" || !payload.dueDate
        ? null
        : new Date(payload.dueDate);
    existing.remarks = payload.remarks || "";
    existing.items = items;
    existing.totalAmount = totalAmount;

    const saved = await existing.save();
    return res.json({ success: true, data: saved });
  } catch (err) {
    console.error("updateTransaction error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while updating transaction.",
    });
  }
};

/**
 * DELETE
 * DELETE /api/transactions/:id
 */
exports.deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }

    const deleted = await Transaction.findByIdAndDelete(id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Transaction not found" });
    }

    return res.json({ success: true, message: "Transaction deleted." });
  } catch (err) {
    console.error("deleteTransaction error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while deleting transaction.",
    });
  }
};

/**
 * Simple TODAY summary (optional, used later by dashboard/reports)
 * GET /api/transactions/summary/today
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
          totalAmount: { $sum: "$totalAmount" },
        },
      },
    ];

    const agg = await Transaction.aggregate(pipeline);

    const summary = {
      SALE: { count: 0, totalAmount: 0 },
      PURCHASE: { count: 0, totalAmount: 0 },
    };

    for (const g of agg) {
      if (g._id === "SALE") {
        summary.SALE.count = g.count;
        summary.SALE.totalAmount = +(g.totalAmount || 0);
      } else if (g._id === "PURCHASE") {
        summary.PURCHASE.count = g.count;
        summary.PURCHASE.totalAmount = +(g.totalAmount || 0);
      }
    }

    return res.json({ success: true, data: summary });
  } catch (err) {
    console.error("getTodaySummary error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while computing summary.",
    });
  }
};
