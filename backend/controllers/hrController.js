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

// Payroll
exports.listPayrolls = async (req, res) => {
  try {
    const q = {};
    if (req.query.year) q.year = Number(req.query.year);
    if (req.query.month) q.month = Number(req.query.month);
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

    const overtime = Number(body.overtime || 0);
    const bonus = Number(body.bonus || 0);
    const allowances = Number(body.allowances || 0);
    const deductions = Number(body.deductions || 0);
    const requestedAdvanceDeduction = Number(body.advanceDeduction || 0);

    const { usedAdvanceIds, usedAmount } = await applyAdvanceDeduction({
      employeeId: emp._id,
      amount: requestedAdvanceDeduction,
    });

    const advanceDeduction = usedAmount;
    const basicSalary = Number(doc.basicSalary || emp.basicSalary || 0);
    const netSalary = computeNet({ basicSalary, overtime, bonus, allowances, deductions, advanceDeduction });

    const paymentMethod = String(body.paymentMethod || "CASH").toUpperCase() === "BANK" ? "BANK" : "CASH";
    const paymentDate = body.paymentDate ? new Date(body.paymentDate) : new Date();

    doc.overtime = round2(overtime);
    doc.bonus = round2(bonus);
    doc.allowances = round2(allowances);
    doc.deductions = round2(deductions);
    doc.advanceDeduction = round2(advanceDeduction);
    doc.netSalary = round2(netSalary);
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
