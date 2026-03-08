const HREmployee = require("../models/hrEmployeeModel");
const HRJob = require("../models/hrJobModel");
const HRApplicant = require("../models/hrApplicantModel");
const HRLeave = require("../models/hrLeaveModel");
const HRAdvance = require("../models/hrAdvanceModel");
const HRPayroll = require("../models/hrPayrollModel");
const SystemSettings = require("../models/systemSettingsModel");

const toNumber = (v) => (v == null || v === "" ? 0 : Number(v));
const clean = (v) => String(v || "").trim();
const phoneDigits = (v) => String(v || "").replace(/\D/g, "");
const isValidName = (v) => /^[A-Za-z\s.'-]{2,80}$/.test(clean(v));
const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(v));
const isValidPhone = (v) => /^03\d{9}$/.test(phoneDigits(v));

function validateEmployeePayload(payload) {
  if (!isValidName(payload.name)) return "Employee name is invalid.";
  if (!clean(payload.role)) return "Role is required.";
  if (!clean(payload.department)) return "Department is required.";
  if (!isValidPhone(payload.phone)) return "Phone must be 11 digits (03XXXXXXXXX).";
  if (!isValidEmail(payload.email)) return "Valid email is required.";
  if (!clean(payload.address)) return "Address is required.";
  if (!payload.joinDate) return "Join date is required.";
  if (toNumber(payload.basicSalary) <= 0) return "Basic salary must be greater than 0.";
  return null;
}

const getHrSettings = async () => {
  const settings = await SystemSettings.findOne({}).lean();
  return {
    monthlyWorkingDays: Number(settings?.hrMonthlyWorkingDays || 30),
    workingHoursPerDay: Number(settings?.hrWorkingHoursPerDay || 8),
    overtimeRate: Number(settings?.hrOvertimeRate || 1.5),
    allowPaidLeave: settings?.hrAllowPaidLeave !== false,
    allowUnpaidLeave: settings?.hrAllowUnpaidLeave !== false,
    advanceDeductionMode: settings?.hrAdvanceDeductionMode || "FULL",
  };
};

// Employees
exports.listEmployees = async (_req, res) => {
  try {
    const rows = await HREmployee.find({}).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to load employees." });
  }
};

exports.createEmployee = async (req, res) => {
  try {
    const payload = req.body || {};
    const validation = validateEmployeePayload(payload);
    if (validation) {
      return res.status(400).json({ success: false, message: validation });
    }
    const doc = await HREmployee.create({
      name: clean(payload.name),
      role: clean(payload.role),
      department: clean(payload.department),
      phone: phoneDigits(payload.phone),
      email: clean(payload.email).toLowerCase(),
      address: clean(payload.address),
      joinDate: payload.joinDate ? new Date(payload.joinDate) : null,
      status: payload.status || "Active",
      basicSalary: toNumber(payload.basicSalary),
    });
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || "Unable to save." });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const payload = req.body || {};
    const validation = validateEmployeePayload(payload);
    if (validation) {
      return res.status(400).json({ success: false, message: validation });
    }
    const doc = await HREmployee.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          name: clean(payload.name),
          role: clean(payload.role),
          department: clean(payload.department),
          phone: phoneDigits(payload.phone),
          email: clean(payload.email).toLowerCase(),
          address: clean(payload.address),
          joinDate: payload.joinDate ? new Date(payload.joinDate) : null,
          status: payload.status || "Active",
          basicSalary: toNumber(payload.basicSalary),
        },
      },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: "Employee not found." });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || "Unable to update." });
  }
};

exports.deleteEmployee = async (req, res) => {
  try {
    const doc = await HREmployee.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: "Employee not found." });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Unable to delete." });
  }
};

// Jobs
exports.listJobs = async (_req, res) => {
  try {
    const rows = await HRJob.find({}).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to load jobs." });
  }
};

exports.createJob = async (req, res) => {
  try {
    const payload = req.body || {};
    const doc = await HRJob.create({
      title: String(payload.title || "").trim(),
      department: String(payload.department || "").trim(),
      vacancies: Math.max(1, toNumber(payload.vacancies || 1)),
      status: payload.status || "Open",
      description: String(payload.description || "").trim(),
    });
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || "Unable to save." });
  }
};

exports.updateJob = async (req, res) => {
  try {
    const payload = req.body || {};
    const doc = await HRJob.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          title: String(payload.title || "").trim(),
          department: String(payload.department || "").trim(),
          vacancies: Math.max(1, toNumber(payload.vacancies || 1)),
          status: payload.status || "Open",
          description: String(payload.description || "").trim(),
        },
      },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: "Job not found." });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || "Unable to update." });
  }
};

exports.deleteJob = async (req, res) => {
  try {
    const doc = await HRJob.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: "Job not found." });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Unable to delete." });
  }
};

// Applicants
exports.listApplicants = async (_req, res) => {
  try {
    const rows = await HRApplicant.find({}).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to load applicants." });
  }
};

exports.createApplicant = async (req, res) => {
  try {
    const payload = req.body || {};
    if (!isValidName(payload.name)) {
      return res.status(400).json({ success: false, message: "Applicant name is invalid." });
    }
    if (payload.phone && !isValidPhone(payload.phone)) {
      return res.status(400).json({ success: false, message: "Phone must be 11 digits (03XXXXXXXXX)." });
    }
    if (payload.email && !isValidEmail(payload.email)) {
      return res.status(400).json({ success: false, message: "Valid email is required." });
    }
    const doc = await HRApplicant.create({
      name: clean(payload.name),
      phone: phoneDigits(payload.phone),
      email: clean(payload.email).toLowerCase(),
      jobId: payload.jobId || null,
      jobTitle: String(payload.jobTitle || "").trim(),
      status: payload.status || "Applied",
      notes: String(payload.notes || "").trim(),
    });
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || "Unable to save." });
  }
};

exports.updateApplicant = async (req, res) => {
  try {
    const payload = req.body || {};
    if (!isValidName(payload.name)) {
      return res.status(400).json({ success: false, message: "Applicant name is invalid." });
    }
    if (payload.phone && !isValidPhone(payload.phone)) {
      return res.status(400).json({ success: false, message: "Phone must be 11 digits (03XXXXXXXXX)." });
    }
    if (payload.email && !isValidEmail(payload.email)) {
      return res.status(400).json({ success: false, message: "Valid email is required." });
    }
    const doc = await HRApplicant.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          name: clean(payload.name),
          phone: phoneDigits(payload.phone),
          email: clean(payload.email).toLowerCase(),
          jobId: payload.jobId || null,
          jobTitle: String(payload.jobTitle || "").trim(),
          status: payload.status || "Applied",
          notes: String(payload.notes || "").trim(),
        },
      },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: "Applicant not found." });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || "Unable to update." });
  }
};

exports.deleteApplicant = async (req, res) => {
  try {
    const doc = await HRApplicant.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: "Applicant not found." });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Unable to delete." });
  }
};

// Leaves
exports.listLeaves = async (_req, res) => {
  try {
    const rows = await HRLeave.find({}).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to load leaves." });
  }
};

exports.createLeave = async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.employeeId) {
      return res.status(400).json({ success: false, message: "Employee is required." });
    }
    const startDate = new Date(payload.startDate);
    const endDate = new Date(payload.endDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return res.status(400).json({ success: false, message: "Valid leave dates are required." });
    }
    if (endDate < startDate) {
      return res.status(400).json({ success: false, message: "End date must be after start date." });
    }
    if (!clean(payload.reason)) {
      return res.status(400).json({ success: false, message: "Leave reason is required." });
    }
    const doc = await HRLeave.create({
      employeeId: payload.employeeId,
      employeeName: clean(payload.employeeName),
      type: payload.type || "Paid",
      startDate,
      endDate,
      days: Math.max(1, toNumber(payload.days || 1)),
      reason: clean(payload.reason),
      status: payload.status || "Pending",
    });
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || "Unable to save." });
  }
};

exports.updateLeave = async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.employeeId) {
      return res.status(400).json({ success: false, message: "Employee is required." });
    }
    const startDate = new Date(payload.startDate);
    const endDate = new Date(payload.endDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return res.status(400).json({ success: false, message: "Valid leave dates are required." });
    }
    if (endDate < startDate) {
      return res.status(400).json({ success: false, message: "End date must be after start date." });
    }
    if (!clean(payload.reason)) {
      return res.status(400).json({ success: false, message: "Leave reason is required." });
    }
    const doc = await HRLeave.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          employeeId: payload.employeeId,
          employeeName: clean(payload.employeeName),
          type: payload.type || "Paid",
          startDate,
          endDate,
          days: Math.max(1, toNumber(payload.days || 1)),
          reason: clean(payload.reason),
          status: payload.status || "Pending",
        },
      },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: "Leave not found." });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || "Unable to update." });
  }
};

exports.deleteLeave = async (req, res) => {
  try {
    const doc = await HRLeave.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: "Leave not found." });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Unable to delete." });
  }
};

// Advances
exports.listAdvances = async (_req, res) => {
  try {
    const rows = await HRAdvance.find({}).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to load advances." });
  }
};

exports.createAdvance = async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.employeeId) {
      return res.status(400).json({ success: false, message: "Employee is required." });
    }
    if (toNumber(payload.amount) <= 0) {
      return res.status(400).json({ success: false, message: "Advance amount must be greater than 0." });
    }
    if (!payload.date) {
      return res.status(400).json({ success: false, message: "Advance date is required." });
    }
    if (!clean(payload.note)) {
      return res.status(400).json({ success: false, message: "Advance note is required." });
    }
    const doc = await HRAdvance.create({
      employeeId: payload.employeeId,
      employeeName: clean(payload.employeeName),
      amount: Math.max(0, toNumber(payload.amount || 0)),
      date: payload.date ? new Date(payload.date) : new Date(),
      status: payload.status || "Pending",
      note: clean(payload.note),
    });
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || "Unable to save." });
  }
};

exports.updateAdvance = async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.employeeId) {
      return res.status(400).json({ success: false, message: "Employee is required." });
    }
    if (toNumber(payload.amount) <= 0) {
      return res.status(400).json({ success: false, message: "Advance amount must be greater than 0." });
    }
    if (!payload.date) {
      return res.status(400).json({ success: false, message: "Advance date is required." });
    }
    if (!clean(payload.note)) {
      return res.status(400).json({ success: false, message: "Advance note is required." });
    }
    const doc = await HRAdvance.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          employeeId: payload.employeeId,
          employeeName: clean(payload.employeeName),
          amount: Math.max(0, toNumber(payload.amount || 0)),
          date: payload.date ? new Date(payload.date) : new Date(),
          status: payload.status || "Pending",
          note: clean(payload.note),
        },
      },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: "Advance not found." });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || "Unable to update." });
  }
};

exports.deleteAdvance = async (req, res) => {
  try {
    const doc = await HRAdvance.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: "Advance not found." });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Unable to delete." });
  }
};

// Payroll
exports.listPayrolls = async (_req, res) => {
  try {
    const rows = await HRPayroll.find({}).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to load payrolls." });
  }
};

exports.createPayroll = async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.employeeId) {
      return res.status(400).json({ success: false, message: "Employee is required." });
    }
    if (!payload.month || !payload.year) {
      return res.status(400).json({ success: false, message: "Month and year are required." });
    }
    const settings = await getHrSettings();
    const employee = await HREmployee.findById(payload.employeeId).lean();
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found." });
    }

    const monthlyWorkingDays = Math.max(1, toNumber(payload.monthlyWorkingDays || settings.monthlyWorkingDays));
    const workingHoursPerDay = Math.max(1, toNumber(settings.workingHoursPerDay));
    const overtimeRate = toNumber(payload.overtimeRate || settings.overtimeRate);

    const daysWorked = Math.max(0, toNumber(payload.daysWorked || 0));
    if (daysWorked > 31) {
      return res.status(400).json({ success: false, message: "Days worked cannot exceed 31." });
    }
    const overtimeHours = Math.max(0, toNumber(payload.overtimeHours || 0));
    const extraPay = Math.max(0, toNumber(payload.extraPay || 0));
    const otherDeductions = Math.max(0, toNumber(payload.otherDeductions || 0));

    const basicSalary = toNumber(payload.basicSalary || employee.basicSalary || 0);
    const dailyRate = monthlyWorkingDays ? basicSalary / monthlyWorkingDays : 0;
    const hourlyRate = workingHoursPerDay ? dailyRate / workingHoursPerDay : 0;
    const overtimePay = overtimeHours * hourlyRate * overtimeRate;
    const basePay = dailyRate * daysWorked;

    let advanceDeducted = 0;
    let advanceIds = [];
    if (settings.advanceDeductionMode === "FULL") {
      const pending = await HRAdvance.find({
        employeeId: employee._id,
        status: "Pending",
      }).lean();
      advanceIds = pending.map((p) => p._id);
      const totalAdvance = pending.reduce((sum, a) => sum + toNumber(a.amount || 0), 0);
      advanceDeducted = Math.max(0, totalAdvance);
    }

    const grossPay = Math.max(0, basePay + overtimePay + extraPay);
    const netPay = Math.max(0, grossPay - advanceDeducted - otherDeductions);

    const doc = await HRPayroll.create({
      employeeId: employee._id,
      employeeName: employee.name,
      month: Number(payload.month),
      year: Number(payload.year),
      daysWorked,
      monthlyWorkingDays,
      overtimeHours,
      overtimeRate,
      basicSalary,
      extraPay,
      advanceDeducted,
      otherDeductions,
      grossPay,
      netPay,
      status: payload.status || "Unpaid",
      notes: String(payload.notes || "").trim(),
      advanceIds,
    });

    if (advanceIds.length) {
      await HRAdvance.updateMany(
        { _id: { $in: advanceIds } },
        { $set: { status: "Deducted", payrollId: doc._id } }
      );
    }

    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || "Unable to save." });
  }
};

exports.updatePayroll = async (req, res) => {
  try {
    const payload = req.body || {};
    if (payload.daysWorked != null && toNumber(payload.daysWorked) > 31) {
      return res.status(400).json({ success: false, message: "Days worked cannot exceed 31." });
    }
    const existing = await HRPayroll.findById(req.params.id).lean();
    if (!existing) {
      return res.status(404).json({ success: false, message: "Payroll not found." });
    }
    const employee = await HREmployee.findById(payload.employeeId || existing.employeeId).lean();
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found." });
    }

    const settings = await getHrSettings();
    const monthlyWorkingDays = Math.max(1, toNumber(payload.monthlyWorkingDays || existing.monthlyWorkingDays || settings.monthlyWorkingDays));
    const workingHoursPerDay = Math.max(1, toNumber(settings.workingHoursPerDay));
    const overtimeRate = toNumber(payload.overtimeRate || existing.overtimeRate || settings.overtimeRate);

    const daysWorked = Math.max(0, toNumber(payload.daysWorked ?? existing.daysWorked));
    const overtimeHours = Math.max(0, toNumber(payload.overtimeHours ?? existing.overtimeHours));
    const extraPay = Math.max(0, toNumber(payload.extraPay ?? existing.extraPay));
    const otherDeductions = Math.max(0, toNumber(payload.otherDeductions ?? existing.otherDeductions));
    const basicSalary = toNumber(payload.basicSalary || existing.basicSalary || employee.basicSalary || 0);

    const dailyRate = monthlyWorkingDays ? basicSalary / monthlyWorkingDays : 0;
    const hourlyRate = workingHoursPerDay ? dailyRate / workingHoursPerDay : 0;
    const overtimePay = overtimeHours * hourlyRate * overtimeRate;
    const basePay = dailyRate * daysWorked;

    const advanceDeducted = toNumber(existing.advanceDeducted || 0);
    const grossPay = Math.max(0, basePay + overtimePay + extraPay);
    const netPay = Math.max(0, grossPay - advanceDeducted - otherDeductions);

    const doc = await HRPayroll.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          employeeId: employee._id,
          employeeName: employee.name,
          month: Number(payload.month ?? existing.month),
          year: Number(payload.year ?? existing.year),
          daysWorked,
          monthlyWorkingDays,
          overtimeHours,
          overtimeRate,
          basicSalary,
          extraPay,
          otherDeductions,
          grossPay,
          netPay,
          status: payload.status || existing.status,
          notes: String((payload.notes ?? existing.notes) || "").trim(),
        },
      },
      { new: true, runValidators: true }
    );

    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || "Unable to update." });
  }
};

exports.deletePayroll = async (req, res) => {
  try {
    const existing = await HRPayroll.findByIdAndDelete(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Payroll not found." });
    }
    if (existing.advanceIds && existing.advanceIds.length) {
      await HRAdvance.updateMany(
        { _id: { $in: existing.advanceIds } },
        { $set: { status: "Pending", payrollId: null } }
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Unable to delete." });
  }
};
