const Transaction = require("../models/transactionModel");
const GatePass = require("../models/gatePassModel");
const ProductionBatch = require("../models/productionBatchModel");
const StockLedger = require("../models/stockLedgerModel");
const NotificationReminder = require("../models/notificationReminderModel");
const SystemSettings = require("../models/systemSettingsModel");
const SystemAction = require("../models/systemActionModel");

const pendingAmount = (t) => {
  const total = Number(t.totalAmount || 0);
  if (t.paymentStatus === "UNPAID") return total;
  if (t.paymentStatus === "PARTIAL") {
    const paid = Number(t.partialPaid || 0);
    return Math.max(total - paid, 0);
  }
  return 0;
};

const parseHm = (value, fallbackMinutes) => {
  const s = String(value || "");
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return fallbackMinutes;
  const h = Math.max(0, Math.min(23, Number(m[1])));
  const min = Math.max(0, Math.min(59, Number(m[2])));
  return h * 60 + min;
};

exports.createReminder = async (req, res) => {
  try {
    const body = req.body || {};
    const transactionId = body.transactionId;
    if (!transactionId) {
      return res
        .status(400)
        .json({ success: false, message: "transactionId is required." });
    }
    const tx = await Transaction.findById(transactionId)
      .select("invoiceNo companyName paymentStatus totalAmount partialPaid")
      .lean();
    if (!tx) {
      return res
        .status(404)
        .json({ success: false, message: "Invoice/transaction not found." });
    }
    if (!(tx.paymentStatus === "UNPAID" || tx.paymentStatus === "PARTIAL")) {
      return res.status(400).json({
        success: false,
        message: "Reminder can only be created for unpaid or partial invoices.",
      });
    }

    const channels = body.channels || {};
    if (!channels.email && !channels.sms && !channels.whatsapp) {
      return res.status(400).json({
        success: false,
        message: "At least one channel is required.",
      });
    }

    const scheduleMode = body.scheduleMode === "later" ? "later" : "now";
    const scheduleAt =
      scheduleMode === "later" && body.scheduleAt
        ? new Date(body.scheduleAt)
        : null;
    if (scheduleMode === "later" && (!scheduleAt || Number.isNaN(scheduleAt.getTime()))) {
      return res
        .status(400)
        .json({ success: false, message: "Valid scheduleAt is required." });
    }

    const doc = await NotificationReminder.create({
      transactionId: tx._id,
      invoiceNo: tx.invoiceNo || "",
      companyName: tx.companyName || "",
      channels: {
        email: !!channels.email,
        sms: !!channels.sms,
        whatsapp: !!channels.whatsapp,
      },
      language: body.language === "ur" ? "ur" : "en",
      templateId: body.templateId === "strong" ? "strong" : "soft",
      scheduleMode,
      scheduleAt,
      status: scheduleMode === "later" ? "SCHEDULED" : "QUEUED",
    });

    return res.status(201).json({ success: true, data: doc });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err?.message || "Internal Server Error",
      stack: err?.stack || null,
    });
  }
};

exports.getAlerts = async (_req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0
    );
    const todayEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999
    );
    const next3Days = new Date(todayEnd);
    next3Days.setDate(next3Days.getDate() + 3);

    const [settingsRaw, invoices, inProcessCount, remindersToday, recentGps, recentSales, recentBatches, recentProdOutputs, pendingActions, recentPaddyReturns] =
      await Promise.all([
        // Keep singleton behavior even if multiple settings docs exist.
        SystemSettings.find({})
          .sort({ createdAt: 1 })
          .limit(1)
          .lean()
          .then((rows) => rows[0] || null),
        Transaction.find({
          paymentStatus: { $in: ["UNPAID", "PARTIAL"] },
          dueDate: { $ne: null },
        })
          .select("invoiceNo companyName paymentStatus totalAmount partialPaid dueDate")
          .lean(),
        ProductionBatch.countDocuments({ status: "IN_PROCESS" }),
        NotificationReminder.countDocuments({
          createdAt: { $gte: todayStart, $lte: todayEnd },
        }),
        GatePass.find({})
          .sort({ createdAt: -1 })
          .limit(5)
          .select("type supplier customer gatePassNo createdAt")
          .lean(),
        Transaction.find({ type: "SALE" })
          .sort({ date: -1, createdAt: -1 })
          .limit(5)
          .select("invoiceNo companyName date totalAmount")
          .lean(),
        ProductionBatch.find({ status: "COMPLETED" })
          .sort({ updatedAt: -1 })
          .limit(5)
          .select("batchNo totalOutputWeightKg updatedAt")
          .lean(),
        StockLedger.find({
          type: "IN",
          remarks: { $regex: "^Production output \\(", $options: "i" },
        })
          .sort({ date: -1, createdAt: -1 })
          .limit(5)
          .select("companyName productTypeName netWeightKg remarks date createdAt")
          .lean(),
        SystemAction.find({ status: "PENDING" })
          .sort({ createdAt: -1 })
          .limit(5)
          .select("type batchId batchNo brandName remainingPaddyKg createdAt")
          .lean(),
        StockLedger.find({
          type: "IN",
          productTypeId: null,
          productTypeName: "Unprocessed Paddy",
          remarks: { $regex: "^Remaining paddy returned", $options: "i" },
        })
          .sort({ date: -1, createdAt: -1 })
          .limit(5)
          .select("companyName netWeightKg remarks date createdAt")
          .lean(),
      ]);

    const settings = settingsRaw || (await SystemSettings.create({})).toObject();

    let overdueCount = 0;
    let dueTodayCount = 0;
    let upcomingCount = 0;
    let overdueAmount = 0;
    let dueTodayAmount = 0;
    let upcomingAmount = 0;

    invoices.forEach((inv) => {
      const due = inv.dueDate ? new Date(inv.dueDate) : null;
      if (!due || Number.isNaN(due.getTime())) return;
      const amt = pendingAmount(inv);
      if (due < todayStart) {
        overdueCount += 1;
        overdueAmount += amt;
      } else if (due >= todayStart && due <= todayEnd) {
        dueTodayCount += 1;
        dueTodayAmount += amt;
      } else if (due > todayEnd && due <= next3Days) {
        upcomingCount += 1;
        upcomingAmount += amt;
      }
    });

    const activities = [];
    recentGps.forEach((gp) => {
      activities.push({
        type: "GATE_PASS",
        title: gp.type === "IN" ? "Inward gate pass" : "Outward gate pass",
        detail: gp.type === "IN" ? gp.supplier || "-" : gp.customer || "-",
        at: gp.createdAt,
      });
    });
    recentSales.forEach((s) => {
      activities.push({
        type: "SALE",
        title: `Sale invoice ${s.invoiceNo || "-"}`,
        detail: `${s.companyName || "-"} · Rs ${Number(s.totalAmount || 0).toFixed(0)}`,
        at: s.date || s.createdAt,
      });
    });
    recentBatches.forEach((b) => {
      activities.push({
        type: "PRODUCTION",
        title: `Batch ${b.batchNo || "-"}`,
        detail: `${Number(b.totalOutputWeightKg || 0).toFixed(0)} kg output`,
        at: b.updatedAt,
      });
    });
    (recentProdOutputs || []).forEach((l) => {
      activities.push({
        type: "PRODUCTION_OUTPUT",
        title: "Production output completed",
        detail: `${l.companyName || "-"} · ${l.productTypeName || "-"} · ${Number(l.netWeightKg || 0).toFixed(0)} kg`,
        at: l.date || l.createdAt,
      });
    });
    (recentPaddyReturns || []).forEach((l) => {
      activities.push({
        type: "PADDY_RETURN",
        title: "Remaining paddy returned to stock",
        detail: `${l.companyName || "-"} · ${Number(l.netWeightKg || 0).toFixed(0)} kg`,
        at: l.date || l.createdAt,
      });
    });
    activities.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    const startMinutes = parseHm(settings?.alertsWorkStart, 9 * 60);
    const endMinutes = parseHm(settings?.alertsWorkEnd, 18 * 60);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const inWorkingHours = nowMinutes >= startMinutes && nowMinutes <= endMinutes;

    return res.json({
      success: true,
      data: {
        alerts: [
          {
            id: "overdue",
            level: overdueCount > 0 ? "high" : "ok",
            title: "Overdue invoices",
            count: overdueCount,
            amount: Math.round(overdueAmount),
          },
          {
            id: "due_today",
            level: dueTodayCount > 0 ? "medium" : "ok",
            title: "Due today",
            count: dueTodayCount,
            amount: Math.round(dueTodayAmount),
          },
          {
            id: "upcoming_3d",
            level: upcomingCount > 0 ? "low" : "ok",
            title: "Due in next 3 days",
            count: upcomingCount,
            amount: Math.round(upcomingAmount),
          },
          {
            id: "in_process_batches",
            level: inProcessCount > 0 ? "medium" : "ok",
            title: "Production batches in process",
            count: inProcessCount,
            amount: 0,
          },
          {
            id: "reminders_today",
            level: remindersToday > 0 ? "low" : "ok",
            title: "Reminders created today",
            count: remindersToday,
            amount: 0,
          },
        ],
        recentActivities: activities.slice(0, 8),
        pendingActions: (pendingActions || []).map((a) => ({
          id: String(a._id),
          type: a.type,
          batchId: a.batchId,
          batchNo: a.batchNo || "",
          brandName: a.brandName || "",
          remainingPaddyKg: Number(a.remainingPaddyKg || 0),
          createdAt: a.createdAt,
        })),
        alertSchedule: {
          enabled: settings?.alertsEnabled !== false,
          workStart: settings?.alertsWorkStart || "09:00",
          workEnd: settings?.alertsWorkEnd || "18:00",
          intervalMinutes: Number(settings?.alertsIntervalMinutes || 1440),
          inWorkingHours,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
