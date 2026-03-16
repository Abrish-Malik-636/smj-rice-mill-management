const mongoose = require("mongoose");
const HREmployee = require("../models/hrEmployeeModel");
const HRAdvance = require("../models/hrAdvanceModel");
const HRPayroll = require("../models/hrPayrollModel");
const SystemSettings = require("../models/systemSettingsModel");
const { ensureDefaultAccounts, getAccountsMap, postJournalEntry, reverseBySource } = require("../services/accountingJournalService");

const round2 = (n) => Number((Number(n || 0)).toFixed(2));

const DEFAULT_DEPARTMENTS = [
  "Administration",
  "Milling / Production",
  "Labour",
  "Packing",
  "Loading",
  "Accounts",
  "Security",
];

async function getDepartments() {
  const s = await SystemSettings.findOne({}).lean().select("hrDepartments");
  const saved = Array.isArray(s?.hrDepartments) ? s.hrDepartments : [];
  const merged = [...DEFAULT_DEPARTMENTS, ...saved]
    .map((x) => String(x || "").trim())
    .filter(Boolean);

  // Dedupe case-insensitively so "Packing" and "packing" don't show twice.
  const seen = new Set();
  const out = [];
  for (const dep of merged) {
    const key = dep.toLowerCase();
    // "Other..." is handled by the UI as a special option with free typing.
    if (key === "other" || key === "others") continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(dep);
  }
  return out;
}

function computeNet({ basicSalary, overtime, bonus, allowances, deductions, advanceDeduction }) {
  const net =
    Number(basicSalary || 0) +
    Number(overtime || 0) +
    Number(bonus || 0) +
    Number(allowances || 0) -
    Number(deductions || 0) -
    Number(advanceDeduction || 0);
  return Math.max(0, round2(net));
}

function computeTotalsFromItems({ earnings, deductions }) {
  const e = Array.isArray(earnings) ? earnings : [];
  const d = Array.isArray(deductions) ? deductions : [];
  const totalEarnings = round2(e.reduce((s, it) => s + Number(it?.amount || 0), 0));
  const totalDeductions = round2(d.reduce((s, it) => s + Number(it?.amount || 0), 0));
  const netPay = Math.max(0, round2(totalEarnings - totalDeductions));
  return { totalEarnings, totalDeductions, netPay };
}

function defaultEarnings({ basicSalary }) {
  const base = round2(Number(basicSalary || 0));
  return [
    { key: "basic", title: "Basic", amount: base },
    { key: "incentive", title: "Incentive", amount: 0 },
    { key: "overtime", title: "Overtime", amount: 0 },
    { key: "bonus", title: "Bonus", amount: 0 },
    { key: "other", title: "Other", amount: 0 },
  ];
}

function defaultDeductions() {
  return [
    { key: "advance", title: "Advance / Loan", amount: 0 },
    { key: "pf", title: "Provident Fund", amount: 0 },
    { key: "tax", title: "Professional Tax", amount: 0 },
    { key: "other", title: "Other Deduction", amount: 0 },
  ];
}

async function applyAdvanceDeduction({ employeeId, amount, payrollId }) {
  let remaining = Number(amount || 0);
  if (!remaining || remaining <= 0) return { usedAdvanceIds: [], usedAmount: 0 };

  const advances = await HRAdvance.find({ employeeId, status: "OPEN", remainingBalance: { $gt: 0 } })
    .sort({ date: 1, createdAt: 1 });

  const usedAdvanceIds = [];
  let usedAmount = 0;
  for (const adv of advances) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, Number(adv.remainingBalance || 0));
    if (take <= 0) continue;
    adv.remainingBalance = round2(Number(adv.remainingBalance || 0) - take);
    if (adv.remainingBalance <= 0.0001) {
      adv.remainingBalance = 0;
      adv.status = "SETTLED";
    }
    // eslint-disable-next-line no-await-in-loop
    await adv.save();
    usedAdvanceIds.push(adv._id);
    usedAmount += take;
    remaining -= take;
  }

  return { usedAdvanceIds, usedAmount: round2(usedAmount) };
}

exports.getMeta = async (req, res) => {
  try {
    const departments = await getDepartments();
    return res.json({ success: true, data: { departments } });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Failed to load HR meta." });
  }
};

// Employees
exports.listEmployees = async (req, res) => {
  try {
    const q = {};
    if (req.query.status) q.status = String(req.query.status).toUpperCase();
    const rows = await HREmployee.find(q).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to load employees." });
  }
};

exports.createEmployee = async (req, res) => {
  try {
    const body = req.body || {};
    const department = String(body.department || "").trim();
    const doc = await HREmployee.create({
      name: String(body.name || "").trim(),
      fatherName: String(body.fatherName || "").trim(),
      cnic: String(body.cnic || "").trim(),
      phone: String(body.phone || "").trim(),
      address: String(body.address || "").trim(),
      department,
      designation: "",
      joiningDate: body.joiningDate ? new Date(body.joiningDate) : null,
      salaryType: String(body.salaryType || "MONTHLY").toUpperCase(),
      basicSalary: Number(body.basicSalary || 0) || 0,
      status: String(body.status || "ACTIVE").toUpperCase(),
    });

    // If user added a new department, persist it so it appears in dropdown next time.
    if (department) {
      await SystemSettings.findOneAndUpdate(
        {},
        { $addToSet: { hrDepartments: department } },
        { upsert: true, new: false }
      );
    }
    res.status(201).json({ success: true, data: doc });
  } catch (e) {
    const msg = e?.message || "Failed to create employee.";
    res.status(400).json({ success: false, message: msg });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }
    const body = req.body || {};
    const department = body.department != null ? String(body.department).trim() : undefined;
    const doc = await HREmployee.findByIdAndUpdate(
      id,
      {
        $set: {
          name: body.name != null ? String(body.name).trim() : undefined,
          fatherName: body.fatherName != null ? String(body.fatherName).trim() : undefined,
          cnic: body.cnic != null ? String(body.cnic).trim() : undefined,
          phone: body.phone != null ? String(body.phone).trim() : undefined,
          address: body.address != null ? String(body.address).trim() : undefined,
          department,
          designation: "",
          joiningDate: body.joiningDate != null ? (body.joiningDate ? new Date(body.joiningDate) : null) : undefined,
          salaryType: body.salaryType != null ? String(body.salaryType).toUpperCase() : undefined,
          basicSalary: body.basicSalary != null ? Number(body.basicSalary || 0) : undefined,
          status: body.status != null ? String(body.status).toUpperCase() : undefined,
        },
      },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: "Employee not found" });

    if (department) {
      await SystemSettings.findOneAndUpdate(
        {},
        { $addToSet: { hrDepartments: department } },
        { upsert: true, new: false }
      );
    }
    res.json({ success: true, data: doc });
  } catch (e) {
    res.status(400).json({ success: false, message: e?.message || "Failed to update employee." });
  }
};

exports.deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }
    const doc = await HREmployee.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ success: false, message: "Employee not found" });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to delete employee." });
  }
};

// Advances
exports.listAdvances = async (req, res) => {
  try {
    const rows = await HRAdvance.find({}).sort({ date: -1, createdAt: -1 }).lean();
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to load advances." });
  }
};

exports.createAdvance = async (req, res) => {
  try {
    const body = req.body || {};
    const employeeId = body.employeeId;
    if (!employeeId || !mongoose.isValidObjectId(employeeId)) {
      return res.status(400).json({ success: false, message: "Employee is required." });
    }
    const emp = await HREmployee.findById(employeeId).lean();
    if (!emp) return res.status(400).json({ success: false, message: "Invalid employee." });

    const amount = Number(body.amount || 0);
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Advance amount must be > 0." });
    }

    const date = body.date ? new Date(body.date) : new Date();
    const paymentMethod = String(body.paymentMethod || "CASH").toUpperCase() === "BANK" ? "BANK" : "CASH";

    const doc = await HRAdvance.create({
      employeeId: emp._id,
      employeeCode: emp.employeeId || "",
      employeeName: emp.name || "",
      date,
      amount: round2(amount),
      remainingBalance: round2(amount),
      status: "OPEN",
      note: String(body.note || "").trim(),
      paymentMethod,
    });

    // Accounting: Employee Advances (Debit) / Cash|Bank (Credit)
    await ensureDefaultAccounts();
    const map = await getAccountsMap();
    const advAcc = map.get("1400");
    const payAcc = map.get(paymentMethod === "BANK" ? "1110" : "1100");
    if (advAcc && payAcc) {
      await reverseBySource({ sourceModule: "HR", sourceRefType: "ADVANCE", sourceRefId: doc._id, reason: "Repost" });
      await postJournalEntry({
        date,
        sourceModule: "HR",
        sourceRefType: "ADVANCE",
        sourceRefId: doc._id,
        narration: `Employee advance ${emp.name}`,
        lines: [
          { accountId: advAcc._id, debit: doc.amount, credit: 0, partyId: String(emp._id), partyName: emp.name },
          { accountId: payAcc._id, debit: 0, credit: doc.amount, partyId: String(emp._id), partyName: emp.name },
        ],
      });
    }

    res.status(201).json({ success: true, data: doc });
  } catch (e) {
    res.status(400).json({ success: false, message: e?.message || "Failed to create advance." });
  }
};

exports.updateAdvance = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }
    const body = req.body || {};
    const existing = await HRAdvance.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: "Advance not found." });

    const date = body.date ? new Date(body.date) : existing.date;
    const paymentMethod = body.paymentMethod
      ? (String(body.paymentMethod || "CASH").toUpperCase() === "BANK" ? "BANK" : "CASH")
      : existing.paymentMethod;
    const note = body.note != null ? String(body.note || "").trim() : existing.note;

    let amount = existing.amount;
    if (body.amount != null) {
      const nextAmount = Number(body.amount || 0);
      if (!nextAmount || nextAmount <= 0) {
        return res.status(400).json({ success: false, message: "Advance amount must be > 0." });
      }
      amount = round2(nextAmount);
    }

    const used = round2(Number(existing.amount || 0) - Number(existing.remainingBalance || 0));
    const remaining = Math.max(0, round2(amount - used));
    const status = remaining > 0 ? "OPEN" : "SETTLED";

    existing.date = date;
    existing.paymentMethod = paymentMethod;
    existing.note = note;
    existing.amount = amount;
    existing.remainingBalance = remaining;
    existing.status = status;
    await existing.save();

    await ensureDefaultAccounts();
    const map = await getAccountsMap();
    const advAcc = map.get("1400");
    const payAcc = map.get(paymentMethod === "BANK" ? "1110" : "1100");
    if (advAcc && payAcc) {
      await reverseBySource({ sourceModule: "HR", sourceRefType: "ADVANCE", sourceRefId: existing._id, reason: "Edit" });
      const emp = await HREmployee.findById(existing.employeeId).lean();
      const partyId = emp ? String(emp._id) : String(existing.employeeId);
      const partyName = emp?.name || existing.employeeName || "Employee";
      await postJournalEntry({
        date,
        sourceModule: "HR",
        sourceRefType: "ADVANCE",
        sourceRefId: existing._id,
        narration: `Employee advance ${partyName}`,
        lines: [
          { accountId: advAcc._id, debit: existing.amount, credit: 0, partyId, partyName },
          { accountId: payAcc._id, debit: 0, credit: existing.amount, partyId, partyName },
        ],
      });
    }

    res.json({ success: true, data: existing });
  } catch (e) {
    res.status(400).json({ success: false, message: e?.message || "Failed to update advance." });
  }
};

exports.deleteAdvance = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }
    const doc = await HRAdvance.findById(id);
    if (!doc) return res.status(404).json({ success: false, message: "Advance not found." });

    const used = round2(Number(doc.amount || 0) - Number(doc.remainingBalance || 0));
    if (used > 0) {
      return res.status(400).json({ success: false, message: "Cannot delete an advance that has been used in payroll." });
    }

    await reverseBySource({ sourceModule: "HR", sourceRefType: "ADVANCE", sourceRefId: doc._id, reason: "Delete" });
    await HRAdvance.deleteOne({ _id: doc._id });
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, message: e?.message || "Failed to delete advance." });
  }
};

// Payroll
exports.listPayrolls = async (req, res) => {
  try {
    const q = {};
    if (req.query.year) q.year = Number(req.query.year);
    if (req.query.month) q.month = Number(req.query.month);
    if (req.query.employeeId && mongoose.isValidObjectId(req.query.employeeId)) {
      q.employeeId = req.query.employeeId;
    }
    const rows = await HRPayroll.find(q).sort({ year: -1, month: -1, createdAt: -1 }).lean();
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to load payrolls." });
  }
};

exports.generatePayrolls = async (req, res) => {
  try {
    const body = req.body || {};
    const month = Number(body.month);
    const year = Number(body.year);
    if (!month || month < 1 || month > 12) {
      return res.status(400).json({ success: false, message: "Month must be 1..12." });
    }
    if (!year || year < 2000) {
      return res.status(400).json({ success: false, message: "Year is required." });
    }

    const activeEmps = await HREmployee.find({ status: "ACTIVE" }).lean().sort({ createdAt: -1 });
    const created = [];
    const skipped = [];

    for (const emp of activeEmps) {
      // eslint-disable-next-line no-await-in-loop
      const exists = await HRPayroll.exists({ employeeId: emp._id, month, year });
      if (exists) {
        skipped.push(emp._id);
        continue;
      }
      const basicSalary = Number(emp.basicSalary || 0);
      const netSalary = computeNet({
        basicSalary,
        overtime: 0,
        bonus: 0,
        allowances: 0,
        deductions: 0,
        advanceDeduction: 0,
      });
      const earnings = defaultEarnings({ basicSalary });
      const deductionsItems = defaultDeductions();
      const { totalEarnings, totalDeductions, netPay } = computeTotalsFromItems({
        earnings,
        deductions: deductionsItems,
      });
      // eslint-disable-next-line no-await-in-loop
      const doc = await HRPayroll.create({
        employeeId: emp._id,
        employeeCode: emp.employeeId || "",
      employeeName: emp.name || "",
      department: emp.department || "",
      designation: "",
      month,
      year,
        basicSalary: round2(basicSalary),
        overtime: 0,
        bonus: 0,
        allowances: 0,
        deductions: 0,
        advanceDeduction: 0,
        netSalary: round2(netSalary),
        earnings,
        deductionsItems,
        totalEarnings,
        totalDeductions,
        netPay,
        paymentDate: null,
        paymentMethod: "CASH",
        status: "DRAFT",
        advanceIds: [],
      });
      created.push(doc);
    }

    res.status(201).json({
      success: true,
      data: { month, year, createdCount: created.length, skippedCount: skipped.length, created },
    });
  } catch (e) {
    res.status(400).json({ success: false, message: e?.message || "Failed to generate payroll." });
  }
};

exports.generatePayrollForEmployee = async (req, res) => {
  try {
    const body = req.body || {};
    const employeeId = body.employeeId;
    const month = Number(body.month);
    const year = Number(body.year);
    if (!employeeId || !mongoose.isValidObjectId(employeeId)) {
      return res.status(400).json({ success: false, message: "Employee is required." });
    }
    if (!month || month < 1 || month > 12) {
      return res.status(400).json({ success: false, message: "Month must be 1..12." });
    }
    if (!year || year < 2000) {
      return res.status(400).json({ success: false, message: "Year is required." });
    }

    const emp = await HREmployee.findById(employeeId).lean();
    if (!emp) return res.status(400).json({ success: false, message: "Invalid employee." });
    const exists = await HRPayroll.findOne({ employeeId: emp._id, month, year }).lean();
    if (exists) return res.json({ success: true, data: exists, created: false });

    const basicSalary = Number(emp.basicSalary || 0);
    const netSalary = computeNet({
      basicSalary,
      overtime: 0,
      bonus: 0,
      allowances: 0,
      deductions: 0,
      advanceDeduction: 0,
    });
    const earnings = defaultEarnings({ basicSalary });
    const deductionsItems = defaultDeductions();
    const { totalEarnings, totalDeductions, netPay } = computeTotalsFromItems({
      earnings,
      deductions: deductionsItems,
    });

    const doc = await HRPayroll.create({
      employeeId: emp._id,
      employeeCode: emp.employeeId || "",
      employeeName: emp.name || "",
      department: emp.department || "",
      designation: "",
      month,
      year,
      basicSalary: round2(basicSalary),
      overtime: 0,
      bonus: 0,
      allowances: 0,
      deductions: 0,
      advanceDeduction: 0,
      netSalary: round2(netSalary),
      earnings,
      deductionsItems,
      totalEarnings,
      totalDeductions,
      netPay,
      status: "DRAFT",
      paymentDate: null,
      paymentMethod: "",
      advanceIds: [],
    });

    res.status(201).json({ success: true, data: doc, created: true });
  } catch (e) {
    res.status(400).json({ success: false, message: e?.message || "Failed to generate payroll." });
  }
};

exports.payPayroll = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }
    const body = req.body || {};
    const doc = await HRPayroll.findById(id);
    if (!doc) return res.status(404).json({ success: false, message: "Payroll not found" });
    if (doc.status === "PAID") {
      return res.status(400).json({ success: false, message: "Payroll already paid." });
    }

    const emp = await HREmployee.findById(doc.employeeId).lean();
    if (!emp) return res.status(400).json({ success: false, message: "Invalid employee." });

    const incomingEarnings = Array.isArray(body.earnings) ? body.earnings : null;
    const incomingDeductions = Array.isArray(body.deductionsItems) ? body.deductionsItems : null;

    // Backward compatibility: if UI sends old fields, fold them into items.
    const overtime = Number(body.overtime || 0);
    const bonus = Number(body.bonus || 0);
    const allowances = Number(body.allowances || 0);
    const deductions = Number(body.deductions || 0);
    const requestedAdvanceDeduction =
      incomingDeductions
        ? Number(incomingDeductions.find((d) => String(d?.key) === "advance")?.amount || 0)
        : Number(body.advanceDeduction || 0);

    const { usedAdvanceIds, usedAmount } = await applyAdvanceDeduction({
      employeeId: emp._id,
      amount: requestedAdvanceDeduction,
    });

    const advanceDeduction = usedAmount;
    const basicSalary = Number(doc.basicSalary || emp.basicSalary || 0);
    const netSalary = computeNet({ basicSalary, overtime, bonus, allowances, deductions, advanceDeduction });

    const earnings =
      incomingEarnings ||
      (Array.isArray(doc.earnings) && doc.earnings.length ? doc.earnings : defaultEarnings({ basicSalary }));
    let deductionsItems =
      incomingDeductions ||
      (Array.isArray(doc.deductionsItems) && doc.deductionsItems.length ? doc.deductionsItems : defaultDeductions());

    // Normalize amounts and ensure advance deduction equals the actually used amount.
    deductionsItems = deductionsItems.map((it) => {
      const key = String(it?.key || "").trim();
      const title = String(it?.title || "").trim();
      const amt = round2(Number(it?.amount || 0));
      if (key === "advance") return { key, title: title || "Advance / Loan", amount: round2(advanceDeduction) };
      return { key, title, amount: Math.max(0, amt) };
    });
    const safeEarnings = earnings.map((it) => ({
      key: String(it?.key || "").trim(),
      title: String(it?.title || "").trim(),
      amount: Math.max(0, round2(Number(it?.amount || 0))),
    }));

    const { totalEarnings, totalDeductions, netPay } = computeTotalsFromItems({
      earnings: safeEarnings,
      deductions: deductionsItems,
    });

    const paymentMethod = String(body.paymentMethod || "CASH").toUpperCase() === "BANK" ? "BANK" : "CASH";
    const paymentDate = body.paymentDate ? new Date(body.paymentDate) : new Date();

    // Keep legacy numeric fields in sync for downstream accounting/reporting.
    const advOnly = round2(advanceDeduction);
    doc.basicSalary = round2(Number(safeEarnings.find((x) => x.key === "basic")?.amount || doc.basicSalary || 0));
    doc.overtime = round2(Number(safeEarnings.find((x) => x.key === "overtime")?.amount || 0));
    doc.bonus = round2(Number(safeEarnings.find((x) => x.key === "bonus")?.amount || 0));
    // Treat the rest of earnings as allowances bucket.
    doc.allowances = round2(
      safeEarnings
        .filter((x) => !["basic", "overtime", "bonus"].includes(String(x.key || "")))
        .reduce((s, x) => s + Number(x.amount || 0), 0)
    );
    doc.deductions = round2(Math.max(0, totalDeductions - advOnly));
    doc.advanceDeduction = advOnly;
    // Use flexible computed netPay as primary.
    doc.netSalary = round2(netPay);
    doc.earnings = safeEarnings;
    doc.deductionsItems = deductionsItems;
    doc.totalEarnings = totalEarnings;
    doc.totalDeductions = totalDeductions;
    doc.netPay = netPay;
    doc.paymentDate = paymentDate;
    doc.paymentMethod = paymentMethod;
    doc.status = "PAID";
    doc.advanceIds = usedAdvanceIds;

    const saved = await doc.save();

    await ensureDefaultAccounts();
    const map = await getAccountsMap();
    const salAcc = map.get("5300");
    const advAcc = map.get("1400");
    const payAcc = map.get(paymentMethod === "BANK" ? "1110" : "1100");
    if (salAcc && payAcc) {
      const debitTotal = round2(saved.netSalary + saved.advanceDeduction);
      await reverseBySource({ sourceModule: "HR", sourceRefType: "PAYROLL", sourceRefId: saved._id, reason: "Repost" });
      const lines = [
        { accountId: salAcc._id, debit: debitTotal, credit: 0, partyId: String(emp._id), partyName: emp.name },
      ];
      if (saved.advanceDeduction > 0 && advAcc) {
        lines.push({ accountId: advAcc._id, debit: 0, credit: saved.advanceDeduction, partyId: String(emp._id), partyName: emp.name });
      }
      lines.push({ accountId: payAcc._id, debit: 0, credit: saved.netSalary, partyId: String(emp._id), partyName: emp.name });
      await postJournalEntry({
        date: paymentDate,
        sourceModule: "HR",
        sourceRefType: "PAYROLL",
        sourceRefId: saved._id,
        narration: `Salary paid ${emp.name} ${saved.month}/${saved.year}`,
        lines,
      });
    }

    res.json({ success: true, data: saved });
  } catch (e) {
    res.status(400).json({ success: false, message: e?.message || "Failed to pay payroll." });
  }
};

exports.deletePayroll = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }
    const doc = await HRPayroll.findById(id);
    if (!doc) return res.status(404).json({ success: false, message: "Payroll not found." });
    if (doc.status !== "DRAFT") {
      return res.status(400).json({ success: false, message: "Only DRAFT payrolls can be deleted." });
    }
    await HRPayroll.deleteOne({ _id: doc._id });
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, message: e?.message || "Failed to delete payroll." });
  }
};

// Reports (simple)
exports.getAdvanceBalances = async (req, res) => {
  try {
    const rows = await HRAdvance.aggregate([
      { $group: { _id: "$employeeId", remaining: { $sum: "$remainingBalance" }, totalAdvance: { $sum: "$amount" } } },
    ]);
    const emps = await HREmployee.find({ _id: { $in: rows.map((r) => r._id) } }).lean();
    const map = new Map(emps.map((e) => [String(e._id), e]));
    const out = rows.map((r) => {
      const e = map.get(String(r._id));
      return {
        employeeId: r._id,
        employeeCode: e?.employeeId || "",
        employeeName: e?.name || "",
        department: e?.department || "",
        remainingBalance: round2(r.remaining),
        totalAdvance: round2(r.totalAdvance),
      };
    });
    res.json({ success: true, data: out });
  } catch (e) {
    res.status(500).json({ success: false, message: "Failed to load advance balances." });
  }
};

exports.getEmployeeList = async (req, res) => {
  try {
    const rows = await HREmployee.find({}).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: rows });
  } catch {
    res.status(500).json({ success: false, message: "Failed to load employee list." });
  }
};

exports.getMonthlyPayrollSummary = async (req, res) => {
  try {
    const rows = await HRPayroll.aggregate([
      { $match: { status: "PAID" } },
      { $group: { _id: { year: "$year", month: "$month" }, count: { $sum: 1 }, totalNet: { $sum: "$netSalary" } } },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
    ]);
    res.json({
      success: true,
      data: rows.map((r) => ({
        year: r._id.year,
        month: r._id.month,
        count: r.count,
        totalNet: round2(r.totalNet),
      })),
    });
  } catch {
    res.status(500).json({ success: false, message: "Failed to load payroll summary." });
  }
};

exports.getDepartmentSalaryReport = async (req, res) => {
  try {
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    if (!year || !month) {
      return res.status(400).json({ success: false, message: "year and month are required" });
    }
    const rows = await HRPayroll.aggregate([
      { $match: { status: "PAID", year, month } },
      { $group: { _id: "$department", count: { $sum: 1 }, totalNet: { $sum: "$netSalary" } } },
      { $sort: { totalNet: -1 } },
    ]);
    res.json({
      success: true,
      data: rows.map((r) => ({
        department: r._id || "Unassigned",
        count: r.count,
        totalNet: round2(r.totalNet),
      })),
    });
  } catch {
    res.status(500).json({ success: false, message: "Failed to load department salary report." });
  }
};
