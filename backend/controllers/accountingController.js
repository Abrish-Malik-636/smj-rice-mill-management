const Transaction = require("../models/transactionModel");
const ExpenseEntry = require("../models/expenseEntryModel");
const Account = require("../models/accountModel");
const JournalEntry = require("../models/journalEntryModel");
const JournalLine = require("../models/journalLineModel");
const ProductionBatch = require("../models/productionBatchModel");
const GatePass = require("../models/gatePassModel");
const SystemSettings = require("../models/systemSettingsModel");
const { getDateRangeFromQuery } = require("../utils/dateRange");
const {
  ensureDefaultAccounts,
  getAccountsMap,
  postJournalEntry,
  reverseBySource,
  postTransactionEntry,
  postExpenseEntry,
  postProductionOutputEntry,
} = require("../services/accountingJournalService");

const parseRange = (req) => getDateRangeFromQuery(req.query);

const paidAmount = (t) => {
  const total = Number(t.totalAmount || 0);
  if (t.paymentStatus === "PAID") return total;
  if (t.paymentStatus === "PARTIAL") return Number(t.partialPaid || 0);
  return 0;
};

const remainingAmount = (t) => {
  const total = Number(t.totalAmount || 0);
  if (t.paymentStatus === "UNPAID") return total;
  if (t.paymentStatus === "PARTIAL")
    return Math.max(total - Number(t.partialPaid || 0), 0);
  return 0;
};

const isBankMethod = (method) => {
  const m = String(method || "").toUpperCase();
  return m === "BANK" || m === "ONLINE" || m === "CARD" || m === "ONLINE_TRANSFER" || m === "BANK_TRANSFER";
};

exports.getDaybook = async (req, res) => {
  try {
    const { start, end } = parseRange(req);
    const [sales, purchases, expenses] = await Promise.all([
      Transaction.find({ type: "SALE", date: { $lte: end } }).lean(),
      Transaction.find({ type: "PURCHASE", date: { $lte: end } }).lean(),
      ExpenseEntry.find({ date: { $lte: end } }).lean(),
    ]);

    const allEntries = [];
    const toKey = (d) => {
      const dt = new Date(d);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, "0");
      const day = String(dt.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    sales.forEach((t) => {
      allEntries.push({
        date: t.date,
        type: "Sale",
        party: t.companyName || "Customer",
        description: t.invoiceNo,
        inflow: paidAmount(t),
        outflow: 0,
        paymentMethod: t.paymentMethod || "CASH",
      });
    });
    purchases.forEach((t) => {
      allEntries.push({
        date: t.date,
        type: "Purchase",
        party: t.companyName || "Supplier",
        description: t.invoiceNo,
        inflow: 0,
        outflow: paidAmount(t),
        paymentMethod: t.paymentMethod || "CASH",
      });
    });
    expenses.forEach((e) => {
      allEntries.push({
        date: e.date,
        type: "Expense",
        party: e.categoryName || "Expense",
        description: e.remarks || "-",
        inflow: 0,
        outflow: Number(e.amount || 0),
        paymentMethod: e.paymentMethod || "CASH",
      });
    });
    // HR & Payroll module removed; no payroll/advances in daybook anymore.

    allEntries.sort((a, b) => new Date(a.date) - new Date(b.date));

    let runningBalance = 0;
    let runningCash = 0;
    let runningBank = 0;
    const dailyMap = new Map();
    const rangeRows = [];

    allEntries.forEach((e) => {
      const entryDate = new Date(e.date);
      const key = toKey(entryDate);
      const inflow = Number(e.inflow || 0);
      const outflow = Number(e.outflow || 0);
      const withinRange = entryDate >= start && entryDate <= end;

      if (withinRange) {
        if (!dailyMap.has(key)) {
          dailyMap.set(key, {
            date: key,
            openingBalance: runningBalance,
            openingCash: runningCash,
            openingBank: runningBank,
            entries: [],
            incomeCash: 0,
            incomeBank: 0,
            expenseCash: 0,
            expenseBank: 0,
            cashDepositInBank: 0,
          });
        }
        dailyMap.get(key).entries.push({
          ...e,
          inflow,
          outflow,
        });
        rangeRows.push({ ...e, inflow, outflow });
      }

      const bankFlow = isBankMethod(e.paymentMethod);
      if (inflow > 0) {
        if (bankFlow) runningBank += inflow;
        else runningCash += inflow;
      }
      if (outflow > 0) {
        if (bankFlow) runningBank -= outflow;
        else runningCash -= outflow;
      }
      runningBalance += inflow - outflow;
      if (withinRange) {
        const day = dailyMap.get(key);
        if (inflow > 0) {
          if (bankFlow) day.incomeBank += inflow;
          else day.incomeCash += inflow;
        }
        if (outflow > 0) {
          if (bankFlow) day.expenseBank += outflow;
          else day.expenseCash += outflow;
        }
        day.closingBalance = runningBalance;
        day.closingCash = runningCash;
        day.closingBank = runningBank;
      }
    });

    const dailyBook = Array.from(dailyMap.values())
      .map((d) => {
        const incomes = [
          {
            particulars: "Opening Balance",
            amount: Number(d.openingBalance || 0),
            remark: "-",
          },
          ...d.entries
            .filter((e) => Number(e.inflow || 0) > 0)
            .map((e) => ({
              particulars: `${e.type} - ${e.party || ""}`.trim(),
              amount: Number(e.inflow || 0),
              remark: e.description || "-",
            })),
        ];
        const expensesList = d.entries
          .filter((e) => Number(e.outflow || 0) > 0)
          .map((e) => ({
            particulars: `${e.type} - ${e.party || ""}`.trim(),
            amount: Number(e.outflow || 0),
            remark: e.description || "-",
          }));
        const incomeTotal = incomes.reduce((sum, i) => sum + Number(i.amount || 0), 0);
        const expenseTotal = expensesList.reduce(
          (sum, i) => sum + Number(i.amount || 0),
          0
        );
        const grossOpeningBalance =
          Number(d.openingCash || 0) + Number(d.openingBank || 0);
        const grossIncome =
          Number(d.incomeCash || 0) + Number(d.incomeBank || 0);
        const grossExpense =
          Number(d.expenseCash || 0) + Number(d.expenseBank || 0);
        return {
          date: d.date,
          openingBalance: Number(d.openingBalance || 0),
          closingBalance: Number(d.closingBalance || 0),
          openingCash: Number(d.openingCash || 0),
          openingBank: Number(d.openingBank || 0),
          grossOpeningBalance,
          incomeCash: Number(d.incomeCash || 0),
          incomeBank: Number(d.incomeBank || 0),
          grossIncome,
          expenseCash: Number(d.expenseCash || 0),
          expenseBank: Number(d.expenseBank || 0),
          grossExpense,
          cashDepositInBank: Number(d.cashDepositInBank || 0),
          totalAmountInBank: Number(d.closingBank || 0),
          totalCashInHand: Number(d.closingCash || 0),
          incomes,
          expenses: expensesList,
          incomeTotal,
          expenseTotal,
          grandTotal: incomeTotal - expenseTotal,
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    rangeRows.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ success: true, data: rangeRows, dayBook: dailyBook });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to load daybook." });
  }
};

exports.getLedger = async (req, res) => {
  try {
    const { start, end } = parseRange(req);
    const accountId = req.query.accountId ? String(req.query.accountId) : "";
    const accountName = req.query.accountName ? String(req.query.accountName).trim() : "";

    const entries = await JournalEntry.find({
      date: { $gte: start, $lte: end },
      status: "POSTED",
    })
      .sort({ date: 1, createdAt: 1 })
      .lean();

    const entryIds = entries.map((e) => e._id);
    const lineFilter = { journalEntryId: { $in: entryIds } };
    if (accountId) lineFilter.accountId = accountId;
    const lines = await JournalLine.find(lineFilter).lean();
    const accountIds = [...new Set(lines.map((l) => String(l.accountId)))];
    const accounts = await Account.find({ _id: { $in: accountIds } }).lean();
    const accountMap = new Map(accounts.map((a) => [String(a._id), a]));

    const rows = lines
      .map((l) => {
        const je = entries.find((e) => String(e._id) === String(l.journalEntryId));
        const acc = accountMap.get(String(l.accountId));
        return {
          date: je?.date || new Date(),
          account: acc?.name || "Account",
          description: je?.narration || "",
          debit: Number(l.debit || 0),
          credit: Number(l.credit || 0),
        };
      })
      .filter((r) =>
        accountName ? r.account.toLowerCase().includes(accountName.toLowerCase()) : true
      );

    rows.sort((a, b) => new Date(a.date) - new Date(b.date));
    let running = 0;
    const withRunning = rows.map((e) => {
      running += Number(e.debit || 0) - Number(e.credit || 0);
      return { ...e, balance: running };
    });
    res.json({ success: true, data: withRunning });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to load ledger." });
  }
};

exports.getCashSummary = async (req, res) => {
  try {
    const { start, end } = parseRange(req);
    const [sales, purchases, expenses] = await Promise.all([
      Transaction.find({ type: "SALE", date: { $gte: start, $lte: end } }).lean(),
      Transaction.find({ type: "PURCHASE", date: { $gte: start, $lte: end } }).lean(),
      ExpenseEntry.find({ date: { $gte: start, $lte: end } }).lean(),
    ]);

    const inflow = sales.reduce((sum, t) => sum + paidAmount(t), 0);
    const outPurch = purchases.reduce((sum, t) => sum + paidAmount(t), 0);
    const outExp = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const outflow = outPurch + outExp;
    res.json({
      success: true,
      data: { inflow, outflow, cashInHand: inflow - outflow },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to load cash summary." });
  }
};

exports.getExpensesReport = async (req, res) => {
  try {
    const { start, end } = parseRange(req);
    const expenses = await ExpenseEntry.find({
      date: { $gte: start, $lte: end },
    }).lean();
    res.json({ success: true, data: expenses });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to load expenses." });
  }
};

exports.getProfitLoss = async (req, res) => {
  try {
    const { start, end } = parseRange(req);
    const entries = await JournalEntry.find({
      date: { $gte: start, $lte: end },
      status: "POSTED",
    }).lean();
    const lines = await JournalLine.find({
      journalEntryId: { $in: entries.map((e) => e._id) },
    }).lean();
    const accounts = await Account.find({
      _id: { $in: [...new Set(lines.map((l) => String(l.accountId)))] },
    }).lean();
    const accountMap = new Map(accounts.map((a) => [String(a._id), a]));

    let salesTotal = 0;
    let purchasesTotal = 0;
    let expenseTotal = 0;
    let payrollTotal = 0;
    let cogsTotal = 0;
    lines.forEach((l) => {
      const acc = accountMap.get(String(l.accountId));
      if (!acc) return;
      const debit = Number(l.debit || 0);
      const credit = Number(l.credit || 0);
      if (acc.code === "4100") salesTotal += credit - debit;
      if (acc.code === "5100") purchasesTotal += debit - credit;
      if (acc.code === "5300") payrollTotal += debit - credit;
      if (acc.code === "6100") cogsTotal += debit - credit;
      if (acc.type === "EXPENSE" && !["5100", "5300"].includes(acc.code)) {
        expenseTotal += debit - credit;
      }
    });
    const profit =
      Number(salesTotal || 0) -
      Number(cogsTotal || 0) -
      Number(purchasesTotal || 0) -
      Number(expenseTotal || 0) -
      Number(payrollTotal || 0);
    res.json({
      success: true,
      data: {
        salesTotal,
        purchasesTotal,
        expenseTotal,
        payrollTotal,
        cogsTotal,
        profit,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to load P&L." });
  }
};

exports.getBalanceSheet = async (req, res) => {
  try {
    const { start, end } = parseRange(req);
    const entries = await JournalEntry.find({
      date: { $lte: end },
      status: "POSTED",
    }).lean();
    const lines = await JournalLine.find({
      journalEntryId: { $in: entries.map((e) => e._id) },
    }).lean();
    const accounts = await Account.find({
      _id: { $in: [...new Set(lines.map((l) => String(l.accountId)))] },
    }).lean();
    const accountMap = new Map(accounts.map((a) => [String(a._id), a]));

    const balances = new Map();
    lines.forEach((l) => {
      const acc = accountMap.get(String(l.accountId));
      if (!acc) return;
      const prev = Number(balances.get(acc.code) || 0);
      const next =
        acc.type === "ASSET" || acc.type === "EXPENSE" || acc.type === "COGS"
          ? prev + Number(l.debit || 0) - Number(l.credit || 0)
          : prev + Number(l.credit || 0) - Number(l.debit || 0);
      balances.set(acc.code, next);
    });

    const cash = Number(balances.get("1100") || 0) + Number(balances.get("1110") || 0);
    const receivables = Number(balances.get("1200") || 0);
    const inventoryRaw = Number(balances.get("1300") || 0);
    const inventoryFinished = Number(balances.get("1310") || 0);
    const inventory = inventoryRaw + inventoryFinished;
    const payables = Number(balances.get("2100") || 0);
    const longTerm = Number(balances.get("2200") || 0);
    const equity = Number(balances.get("3000") || 0);
    res.json({
      success: true,
      data: {
        assets: { cash, receivables, inventory, fixedAssets: 0 },
        liabilities: { payables, longTerm },
        equity,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to load balance sheet." });
  }
};

exports.getPartyLedger = async (req, res) => {
  try {
    const { start, end } = parseRange(req);
    const [sales, purchases] = await Promise.all([
      Transaction.find({ type: "SALE", date: { $gte: start, $lte: end } }).lean(),
      Transaction.find({ type: "PURCHASE", date: { $gte: start, $lte: end } }).lean(),
    ]);
    const map = new Map();
    const add = (name, salesAmt, purchasesAmt, recv, pay) => {
      const key = name || "Party";
      const current = map.get(key) || {
        party: key,
        sales: 0,
        purchases: 0,
        receivable: 0,
        payable: 0,
      };
      current.sales += salesAmt;
      current.purchases += purchasesAmt;
      current.receivable += recv;
      current.payable += pay;
      map.set(key, current);
    };
    sales.forEach((t) => {
      add(
        t.companyName || "Customer",
        Number(t.totalAmount || 0),
        0,
        remainingAmount(t),
        0
      );
    });
    purchases.forEach((t) => {
      add(
        t.companyName || "Supplier",
        0,
        Number(t.totalAmount || 0),
        0,
        remainingAmount(t)
      );
    });
    res.json({ success: true, data: Array.from(map.values()) });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to load party ledger." });
  }
};

exports.getOutstandingReceivables = async (req, res) => {
  try {
    const { start, end } = parseRange(req);
    const sales = await Transaction.find({
      type: "SALE",
      date: { $gte: start, $lte: end },
      paymentStatus: { $in: ["UNPAID", "PARTIAL"] },
    }).lean();
    const data = sales.map((s) => ({
      date: s.date,
      invoiceNo: s.invoiceNo,
      party: s.companyName || "Customer",
      totalAmount: Number(s.totalAmount || 0),
      paid: Number(s.partialPaid || 0),
      outstanding: remainingAmount(s),
      dueDate: s.dueDate || null,
    }));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to load receivables." });
  }
};

exports.getOutstandingPayables = async (req, res) => {
  try {
    const { start, end } = parseRange(req);
    const purchases = await Transaction.find({
      type: "PURCHASE",
      date: { $gte: start, $lte: end },
      paymentStatus: { $in: ["UNPAID", "PARTIAL"] },
    }).lean();
    const data = purchases.map((p) => ({
      date: p.date,
      invoiceNo: p.invoiceNo,
      party: p.companyName || "Supplier",
      totalAmount: Number(p.totalAmount || 0),
      paid: Number(p.partialPaid || 0),
      outstanding: remainingAmount(p),
      dueDate: p.dueDate || null,
    }));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to load payables." });
  }
};

exports.getAccounts = async (_req, res) => {
  try {
    await ensureDefaultAccounts();
    const data = await Account.find({}).sort({ code: 1 }).lean();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to load accounts." });
  }
};

exports.createAccount = async (req, res) => {
  try {
    const payload = req.body || {};
    const doc = await Account.create({
      code: String(payload.code || "").trim(),
      name: String(payload.name || "").trim(),
      type: payload.type,
      subType: String(payload.subType || "").trim(),
      parentAccountId: payload.parentAccountId || null,
      isControl: !!payload.isControl,
      isActive: payload.isActive !== false,
    });
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || "Unable to create account." });
  }
};

exports.postManualJournal = async (req, res) => {
  try {
    await ensureDefaultAccounts();
    const body = req.body || {};
    const lines = Array.isArray(body.lines) ? body.lines : [];
    const entry = await postJournalEntry({
      date: body.date || new Date(),
      sourceModule: "MANUAL_JV",
      sourceRefType: "MANUAL",
      sourceRefId: body.sourceRefId || "",
      narration: body.narration || "Manual journal",
      createdBy: body.createdBy || "admin",
      lines: lines.map((l) => ({
        accountId: l.accountId,
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
        partyId: l.partyId || "",
        partyName: l.partyName || "",
        remarks: l.remarks || "",
      })),
    });
    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || "Unable to post journal." });
  }
};

exports.getJournalEntries = async (req, res) => {
  try {
    const { start, end } = parseRange(req);
    const entries = await JournalEntry.find({
      date: { $gte: start, $lte: end },
    })
      .sort({ date: -1, createdAt: -1 })
      .lean();
    const lines = await JournalLine.find({
      journalEntryId: { $in: entries.map((e) => e._id) },
    }).lean();
    const accounts = await Account.find({
      _id: { $in: [...new Set(lines.map((l) => String(l.accountId)))] },
    }).lean();
    const accountMap = new Map(accounts.map((a) => [String(a._id), a]));
    const data = entries.map((e) => ({
      ...e,
      lines: lines
        .filter((l) => String(l.journalEntryId) === String(e._id))
        .map((l) => ({
          ...l,
          accountCode: accountMap.get(String(l.accountId))?.code || "",
          accountName: accountMap.get(String(l.accountId))?.name || "",
        })),
    }));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to load journal." });
  }
};

exports.reverseJournalEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const entry = await JournalEntry.findById(id);
    if (!entry) {
      return res.status(404).json({ success: false, message: "Journal entry not found." });
    }
    await reverseBySource({
      sourceModule: entry.sourceModule,
      sourceRefType: entry.sourceRefType,
      sourceRefId: entry.sourceRefId,
      reason: "Manual reverse",
    });
    res.json({ success: true, message: "Journal reversed." });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || "Unable to reverse." });
  }
};

exports.getTrialBalance = async (req, res) => {
  try {
    const { end } = parseRange(req);
    const entries = await JournalEntry.find({
      date: { $lte: end },
      status: "POSTED",
    }).lean();
    const lines = await JournalLine.find({
      journalEntryId: { $in: entries.map((e) => e._id) },
    }).lean();
    const accounts = await Account.find({}).lean();
    const accountMap = new Map(accounts.map((a) => [String(a._id), a]));

    const bucket = new Map();
    lines.forEach((l) => {
      const acc = accountMap.get(String(l.accountId));
      if (!acc) return;
      const key = String(acc._id);
      const row = bucket.get(key) || {
        accountId: key,
        code: acc.code,
        account: acc.name,
        debit: 0,
        credit: 0,
      };
      row.debit += Number(l.debit || 0);
      row.credit += Number(l.credit || 0);
      bucket.set(key, row);
    });
    const data = Array.from(bucket.values()).sort((a, b) =>
      String(a.code).localeCompare(String(b.code))
    );
    const totalDebit = data.reduce((s, r) => s + Number(r.debit || 0), 0);
    const totalCredit = data.reduce((s, r) => s + Number(r.credit || 0), 0);
    res.json({ success: true, data, totals: { totalDebit, totalCredit } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to load trial balance." });
  }
};

exports.runBackfill = async (_req, res) => {
  try {
    await ensureDefaultAccounts();
    const settings =
      (await SystemSettings.findOne()) || (await SystemSettings.create({}));
    const currentVersion = Number(settings.accountingBackfillVersion || 0);
    const targetVersion = Number(_req.body?.version || 1);

    if (currentVersion >= targetVersion && !_req.body?.force) {
      return res.json({
        success: true,
        message: "Backfill already applied.",
        data: { backfillVersion: currentVersion },
      });
    }

    const transactions = await Transaction.find({}).sort({ date: 1, createdAt: 1 });
    for (const tx of transactions) {
      // eslint-disable-next-line no-await-in-loop
      await reverseBySource({
        sourceModule: "TRANSACTION",
        sourceRefType: tx.type,
        sourceRefId: tx._id,
        reason: "Backfill refresh",
      });
      // eslint-disable-next-line no-await-in-loop
      await postTransactionEntry(tx);
    }

    const expenses = await ExpenseEntry.find({}).sort({ date: 1, createdAt: 1 });
    for (const ex of expenses) {
      // eslint-disable-next-line no-await-in-loop
      await reverseBySource({
        sourceModule: "EXPENSE",
        sourceRefType: "EXPENSE_ENTRY",
        sourceRefId: ex._id,
        reason: "Backfill refresh",
      });
      // eslint-disable-next-line no-await-in-loop
      await postExpenseEntry(ex);
    }

    const batches = await ProductionBatch.find({}).sort({ date: 1, createdAt: 1 }).lean();
    for (const b of batches) {
      for (const o of b.outputs || []) {
        // eslint-disable-next-line no-await-in-loop
        await reverseBySource({
          sourceModule: "PRODUCTION",
          sourceRefType: "OUTPUT",
          sourceRefId: `${b._id}:${o.productTypeId}:${new Date(o.outputDate || b.date).getTime()}`,
          reason: "Backfill refresh",
        });
        // eslint-disable-next-line no-await-in-loop
        await postProductionOutputEntry({
          batchId: b._id,
          batchNo: b.batchNo,
          outputDate: o.outputDate || b.date,
          companyId: o.companyId || b.sourceCompanyId || null,
          companyName: o.companyName || b.sourceCompanyName || "",
          productTypeId: o.productTypeId,
          productTypeName: o.productTypeName,
          netWeightKg: o.netWeightKg,
        });
      }
    }
    settings.accountingBackfillVersion = targetVersion;
    settings.accountingBackfillAt = new Date();
    await settings.save();

    res.json({
      success: true,
      message: "Accounting backfill completed.",
      data: { backfillVersion: targetVersion },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Backfill failed." });
  }
};

// Expenses CRUD
exports.listExpenses = async (req, res) => {
  try {
    const { start, end } = parseRange(req);
    const rows = await ExpenseEntry.find({ date: { $gte: start, $lte: end } })
      .sort({ date: -1 })
      .lean();
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to load expenses." });
  }
};

exports.createExpense = async (req, res) => {
  try {
    const payload = req.body || {};
    const doc = await ExpenseEntry.create({
      date: payload.date ? new Date(payload.date) : new Date(),
      categoryId: payload.categoryId || null,
      categoryName: String(payload.categoryName || "").trim(),
      amount: Number(payload.amount || 0),
      paymentMethod: payload.paymentMethod || "CASH",
      remarks: String(payload.remarks || "").trim(),
    });
    await reverseBySource({
      sourceModule: "EXPENSE",
      sourceRefType: "EXPENSE_ENTRY",
      sourceRefId: doc._id,
      reason: "Repost",
    });
    await postExpenseEntry(doc);
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || "Unable to save." });
  }
};

exports.updateExpense = async (req, res) => {
  try {
    const payload = req.body || {};
    const doc = await ExpenseEntry.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          date: payload.date ? new Date(payload.date) : new Date(),
          categoryId: payload.categoryId || null,
          categoryName: String(payload.categoryName || "").trim(),
          amount: Number(payload.amount || 0),
          paymentMethod: payload.paymentMethod || "CASH",
          remarks: String(payload.remarks || "").trim(),
        },
      },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: "Expense not found." });
    await reverseBySource({
      sourceModule: "EXPENSE",
      sourceRefType: "EXPENSE_ENTRY",
      sourceRefId: doc._id,
      reason: "Expense updated",
    });
    await postExpenseEntry(doc);
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || "Unable to update." });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    const doc = await ExpenseEntry.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: "Expense not found." });
    await reverseBySource({
      sourceModule: "EXPENSE",
      sourceRefType: "EXPENSE_ENTRY",
      sourceRefId: doc._id,
      reason: "Expense deleted",
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Unable to delete." });
  }
};
