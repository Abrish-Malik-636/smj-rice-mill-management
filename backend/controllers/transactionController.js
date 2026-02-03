// backend/controllers/transactionController.js
const mongoose = require("mongoose");
const Transaction = require("../models/transactionModel");
const Company = require("../models/companyModel");
const ProductType = require("../models/productTypeModel");
const SystemSettings = require("../models/systemSettingsModel");
const ManagerialStockLedger = require("../models/managerialStockLedgerModel");
const ManagerialStock = require("../models/managerialStockModel");

async function ensureManagerialItem(item) {
  const name = item.itemName ? String(item.itemName).trim() : "";
  if (!name) return null;
  const existing = await ManagerialStock.findOne({
    name: { $regex: new RegExp(`^${name}$`, "i") },
  });
  if (existing) return existing;
  return await ManagerialStock.create({
    name,
    category: item.category || "Other",
    unit: item.unit || "Nos",
    condition: item.condition || "Good",
    description: "",
  });
}

/**
 * Generate a UNIQUE invoice number.
 *
 * Uses SystemSettings invoicePrefix (default "INV-")
 * and type-specific postfix:
 *   - SALE:    INV-S-YYYYMMDD-HHMMSS-1234
 *   - PURCHASE:INV-P-YYYYMMDD-HHMMSS-5678
 *
 * We also check DB a few times to avoid collisions.
 */
function buildInvoiceString(prefix) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const YYYY = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const DD = pad(d.getDate());
  const HH = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  const rand = Math.floor(1000 + Math.random() * 9000); // 4-digit

  return `${prefix}${YYYY}${MM}${DD}-${HH}${mm}${ss}-${rand}`;
}

async function generateInvoiceNo(txnType) {
  // load settings (or defaults)
  let settings = await SystemSettings.findOne({});
  if (!settings) {
    settings = await SystemSettings.create({});
  }

  const basePrefix = settings.invoicePrefix || "INV-";

  // You can later extend with separate prefixes:
  // settings.saleInvoicePrefix, settings.purchaseInvoicePrefix, etc.
  let prefix = basePrefix;
  if (txnType === "SALE") {
    prefix = `${basePrefix}S-`;
  } else if (txnType === "PURCHASE") {
    prefix = `${basePrefix}P-`;
  } else {
    prefix = `${basePrefix}`;
  }

  // Try a few times to avoid duplicates
  let attempts = 0;
  while (attempts < 5) {
    const candidate = buildInvoiceString(prefix);
    // eslint-disable-next-line no-await-in-loop
    const exists = await Transaction.exists({ invoiceNo: candidate });
    if (!exists) return candidate;
    attempts++;
  }

  // If still colliding, throw error
  throw new Error(
    "Could not generate unique invoice number after several attempts."
  );
}

/**
 * Compute amounts for items.
 *  - If netWeightKg is provided, we use it;
 *  - otherwise netWeightKg = numBags * perBagWeightKg
 */
function computeItemAmounts(itemsRaw) {
  const items = [];
  let totalAmount = 0;

  for (const raw of itemsRaw) {
    const isManagerial =
      raw.isManagerial === true || (!!raw.itemName && !raw.productTypeId);

    if (isManagerial) {
      const quantity = Number(raw.quantity || raw.numBags || 0);
      const rate = Number(raw.rate) || 0;
      let amount = quantity * rate;
      amount = +amount.toFixed(2);
      totalAmount += amount;

      items.push({
        managerialItemId: raw.managerialItemId || null,
        itemName: raw.itemName ? String(raw.itemName).trim() : "",
        category: raw.category ? String(raw.category).trim() : "",
        condition: raw.condition ? String(raw.condition).trim() : "",
        unit: raw.unit ? String(raw.unit).trim() : "Nos",
        quantity,
        isManagerial: true,
        rate,
        rateType: "per_unit",
        amount,
      });
      continue;
    }

    const numBags = Number(raw.numBags) || 0;
    const perBagWeightKg = Number(raw.perBagWeightKg) || 0;

    const netWeightKgRaw =
      raw.netWeightKg !== undefined && raw.netWeightKg !== ""
        ? Number(raw.netWeightKg)
        : numBags * perBagWeightKg;

    const netWeightKg = +netWeightKgRaw.toFixed(3);

    const rate = Number(raw.rate) || 0;
    const rateType =
      raw.rateType === "per_bag" || raw.rateType === "per_ton"
        ? raw.rateType
        : "per_kg";

    let amount = 0;
    if (rateType === "per_bag" || rateType === "per_ton") {
      amount = numBags * rate;
    } else {
      amount = netWeightKg * rate;
    }

    amount = +amount.toFixed(2);
    totalAmount += amount;

    items.push({
      productTypeId: raw.productTypeId,
      productTypeName: "", // filled after resolving product names
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
    return 'Field "type" must be "PURCHASE" or "SALE".';
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return "At least one item is required.";
  }

  // Payment status
  const payStatus = body.paymentStatus || "PAID";
  if (!["PAID", "UNPAID", "PARTIAL"].includes(payStatus)) {
    return 'Field "paymentStatus" must be "PAID", "UNPAID" or "PARTIAL".';
  }

  if ((payStatus === "UNPAID" || payStatus === "PARTIAL") && !body.dueDate) {
    return "Due date is required for unpaid or partial payments.";
  }

  // Payment method
  const payMethod = body.paymentMethod || "CASH";
  if (!["CASH", "CARD", "ONLINE_TRANSFER", "BANK_TRANSFER", "CREDIT"].includes(payMethod)) {
    return 'Field "paymentMethod" must be one of CASH, CARD, ONLINE_TRANSFER, BANK_TRANSFER, CREDIT.';
  }

  // Items-level checks
  for (let i = 0; i < body.items.length; i++) {
    const it = body.items[i];
    const isManagerial = it.isManagerial === true || (!!it.itemName && !it.productTypeId);
    if (isManagerial) {
      if (!it.itemName) return `Item ${i + 1}: "itemName" is required.`;
      if (!it.category) return `Item ${i + 1}: "category" is required.`;
      if (!it.condition) return `Item ${i + 1}: "condition" is required.`;
      if (it.quantity === undefined || it.quantity === null || it.quantity === "") {
        return `Item ${i + 1}: "quantity" is required.`;
      }
      if (it.rate === undefined || it.rate === null || it.rate === "") {
        return `Item ${i + 1}: "rate" is required.`;
      }
    } else {
      if (!it.productTypeId) {
        return `Item ${i + 1}: "productTypeId" is required.`;
      }
      if (it.rate === undefined || it.rate === null || it.rate === "") {
        return `Item ${i + 1}: "rate" is required.`;
      }
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

    // Resolve product names (production items only)
    const productIds = items
      .filter((i) => i.productTypeId)
      .map((i) => i.productTypeId);
    const productDocs = productIds.length
      ? await ProductType.find({ _id: { $in: productIds } })
          .lean()
          .select("name")
      : [];

    const productMap = {};
    for (const p of productDocs) {
      productMap[p._id.toString()] = p.name;
    }
    for (const item of items) {
      if (item.productTypeId) {
        item.productTypeName =
          productMap[item.productTypeId.toString()] || "Unknown";
      }
    }

    if (existing.type === "PURCHASE") {
      for (const item of items) {
        if (!item.isManagerial || item.managerialItemId) continue;
        // eslint-disable-next-line no-await-in-loop
        const created = await ensureManagerialItem(item);
        if (created) {
          item.managerialItemId = created._id;
          item.category = created.category;
          item.condition = created.condition;
          item.unit = created.unit;
        }
      }
    }

    // Ensure managerial master items exist for purchase entries
    if (payload.type === "PURCHASE") {
      for (const item of items) {
        if (!item.isManagerial || item.managerialItemId) continue;
        // eslint-disable-next-line no-await-in-loop
        const created = await ensureManagerialItem(item);
        if (created) {
          item.managerialItemId = created._id;
          item.category = created.category;
          item.condition = created.condition;
          item.unit = created.unit;
        }
      }
    }

    // Generate unique invoice number
    const invoiceNo = await generateInvoiceNo(payload.type);

    const payStatus = payload.paymentStatus || "PAID";
    const dueDate =
      payStatus === "PAID" || !payload.dueDate
        ? null
        : new Date(payload.dueDate);
    const partialPaid = Number(payload.partialPaid || 0);
    if (payStatus === "PARTIAL") {
      if (!partialPaid || partialPaid <= 0) {
        return res.status(400).json({
          success: false,
          message: "Partial payment requires a paid amount greater than 0.",
        });
      }
      if (partialPaid > totalAmount) {
        return res.status(400).json({
          success: false,
          message: "Amount paid cannot exceed total amount.",
        });
      }
    }

    const doc = new Transaction({
      type: payload.type, // PURCHASE or SALE
      invoiceNo,
      date: new Date(payload.date),
      companyId: payload.companyId,
      companyName: company.name,
      paymentStatus: payStatus,
      paymentMethod: payload.paymentMethod || "CASH",
      dueDate,
      remarks: payload.remarks || "",
      items,
      totalAmount,
      partialPaid: payStatus === "PARTIAL" ? partialPaid : 0,
    });

    const saved = await doc.save();

    if (payload.type === "PURCHASE") {
      const managerialOps = items
        .filter((i) => i.isManagerial && i.itemName)
        .map((i) => ({
          date: new Date(payload.date),
          type: "IN",
          itemName: i.itemName,
          quantity: Number(i.quantity || 0),
          unit: i.unit || "Nos",
          sourceType: "Purchase",
          refNo: saved.invoiceNo || "-",
          transactionId: saved._id,
          remarks: payload.remarks || "",
        }))
        .filter((i) => i.quantity > 0);
      if (managerialOps.length) {
        await ManagerialStockLedger.insertMany(managerialOps);
      }
    }

    return res.status(201).json({ success: true, data: saved });
  } catch (err) {
    console.error("createTransaction error:", err);

    // If we somehow hit a duplicate invoiceNo, return a friendly error
    if (err.code === 11000 && err.keyPattern && err.keyPattern.invoiceNo) {
      return res.status(409).json({
        success: false,
        message: "Invoice number already exists. Please try again.",
      });
    }

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

    const productIds = items
      .filter((i) => i.productTypeId)
      .map((i) => i.productTypeId);
    const productDocs = productIds.length
      ? await ProductType.find({ _id: { $in: productIds } })
          .lean()
          .select("name")
      : [];

    const productMap = {};
    for (const p of productDocs) {
      productMap[p._id.toString()] = p.name;
    }
    for (const item of items) {
      if (item.productTypeId) {
        item.productTypeName =
          productMap[item.productTypeId.toString()] || "Unknown";
      }
    }

    const payStatus = payload.paymentStatus || "PAID";
    const dueDate =
      payStatus === "PAID" || !payload.dueDate
        ? null
        : new Date(payload.dueDate);
    const partialPaid = Number(payload.partialPaid || 0);
    if (payStatus === "PARTIAL") {
      if (!partialPaid || partialPaid <= 0) {
        return res.status(400).json({
          success: false,
          message: "Partial payment requires a paid amount greater than 0.",
        });
      }
      if (partialPaid > totalAmount) {
        return res.status(400).json({
          success: false,
          message: "Amount paid cannot exceed total amount.",
        });
      }
    }

    existing.date = new Date(payload.date);
    existing.companyId = companyId;
    existing.companyName = company.name;
    existing.paymentStatus = payStatus;
    existing.paymentMethod =
      payload.paymentMethod || existing.paymentMethod || "CASH";
    existing.dueDate = dueDate;
    existing.remarks = payload.remarks || "";
    existing.items = items;
    existing.totalAmount = totalAmount;
    existing.partialPaid = payStatus === "PARTIAL" ? partialPaid : 0;

    const saved = await existing.save();

    if (existing.type === "PURCHASE") {
      await ManagerialStockLedger.deleteMany({ transactionId: existing._id });
      const managerialOps = items
        .filter((i) => i.isManagerial && i.itemName)
        .map((i) => ({
          date: new Date(payload.date),
          type: "IN",
          itemName: i.itemName,
          quantity: Number(i.quantity || 0),
          unit: i.unit || "Nos",
          sourceType: "Purchase",
          refNo: existing.invoiceNo || "-",
          transactionId: existing._id,
          remarks: payload.remarks || "",
        }))
        .filter((i) => i.quantity > 0);
      if (managerialOps.length) {
        await ManagerialStockLedger.insertMany(managerialOps);
      }
    }

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

    await ManagerialStockLedger.deleteMany({ transactionId: deleted._id });

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
