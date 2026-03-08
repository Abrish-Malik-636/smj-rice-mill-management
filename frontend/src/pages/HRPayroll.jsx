import React, { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Lock } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import api from "../services/api";
import DataTable from "../components/ui/DataTable";
import Pin4Input from "../components/Pin4Input";

const TABS = [
  { key: "employees", label: "Employees" },
  { key: "leaves", label: "Leaves" },
  { key: "advances", label: "Advances" },
  { key: "payroll", label: "Payroll" },
  { key: "settings", label: "Settings" },
];

const emptyEmployee = {
  name: "",
  role: "",
  department: "",
  phone: "",
  email: "",
  address: "",
  joinDate: "",
  status: "Active",
  basicSalary: "",
};

const emptyJob = {
  title: "",
  department: "",
  vacancies: "1",
  status: "Open",
  description: "",
};

const emptyApplicant = {
  name: "",
  phone: "",
  email: "",
  jobId: "",
  status: "Applied",
  notes: "",
};

const emptyLeave = {
  employeeId: "",
  type: "Paid",
  startDate: "",
  endDate: "",
  days: "1",
  reason: "",
  status: "Pending",
};

const emptyAdvance = {
  employeeId: "",
  amount: "",
  date: "",
  status: "Pending",
  note: "",
};

const emptyPayroll = {
  employeeId: "",
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  daysWorked: "",
  overtimeHours: "",
  extraPay: "",
  otherDeductions: "",
  status: "Unpaid",
  notes: "",
};

export default function HRPayroll() {
  const [activeTab, setActiveTab] = useState("employees");
  const [employees, setEmployees] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [applicants, setApplicants] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [payrolls, setPayrolls] = useState([]);

  const [employeeForm, setEmployeeForm] = useState(emptyEmployee);
  const [employeeEditingId, setEmployeeEditingId] = useState(null);

  const [jobForm, setJobForm] = useState(emptyJob);
  const [jobEditingId, setJobEditingId] = useState(null);

  const [applicantForm, setApplicantForm] = useState(emptyApplicant);
  const [applicantEditingId, setApplicantEditingId] = useState(null);

  const [leaveForm, setLeaveForm] = useState(emptyLeave);
  const [leaveEditingId, setLeaveEditingId] = useState(null);

  const [advanceForm, setAdvanceForm] = useState(emptyAdvance);
  const [advanceEditingId, setAdvanceEditingId] = useState(null);

  const [payrollForm, setPayrollForm] = useState(emptyPayroll);
  const [payrollEditingId, setPayrollEditingId] = useState(null);

  const [settings, setSettings] = useState(null);
  const [hrSettingsForm, setHrSettingsForm] = useState({
    hrMonthlyWorkingDays: "30",
    hrWorkingHoursPerDay: "8",
    hrOvertimeRate: "1.5",
    hrAllowPaidLeave: true,
    hrAllowUnpaidLeave: true,
    hrAdvanceDeductionMode: "FULL",
  });

  const [hrUnlock, setHrUnlock] = useState({
    open: false,
    pin: "",
    pinError: "",
  });
  const [hrUnlocked, setHrUnlocked] = useState(false);
  const [savingHrSettings, setSavingHrSettings] = useState(false);

  const loadAll = async () => {
    try {
      const [emp, job, app, leave, adv, pay, setRes] = await Promise.all([
        api.get("/hr/employees"),
        api.get("/hr/jobs"),
        api.get("/hr/applicants"),
        api.get("/hr/leaves"),
        api.get("/hr/advances"),
        api.get("/hr/payrolls"),
        api.get("/settings"),
      ]);
      setEmployees(emp.data?.data || []);
      setJobs(job.data?.data || []);
      setApplicants(app.data?.data || []);
      setLeaves(leave.data?.data || []);
      setAdvances(adv.data?.data || []);
      setPayrolls(pay.data?.data || []);
      setSettings(setRes.data?.data || setRes.data);
      const s = setRes.data?.data || setRes.data;
      setHrSettingsForm({
        hrMonthlyWorkingDays: String(s?.hrMonthlyWorkingDays ?? 30),
        hrWorkingHoursPerDay: String(s?.hrWorkingHoursPerDay ?? 8),
        hrOvertimeRate: String(s?.hrOvertimeRate ?? 1.5),
        hrAllowPaidLeave: s?.hrAllowPaidLeave !== false,
        hrAllowUnpaidLeave: s?.hrAllowUnpaidLeave !== false,
        hrAdvanceDeductionMode: s?.hrAdvanceDeductionMode || "FULL",
      });
    } catch {
      toast.error("Failed to load HR data.");
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const employeeOptions = useMemo(
    () => employees.map((e) => ({ id: e._id, name: e.name })),
    [employees]
  );
  const jobOptions = useMemo(
    () => jobs.map((j) => ({ id: j._id, title: j.title })),
    [jobs]
  );

  const numberOnly = (value, max = 10) =>
    value.replace(/[^\d.]/g, "").slice(0, max);
  const intOnly = (value, max = 10) => value.replace(/\D/g, "").slice(0, max);
  const textOnlyName = (value, max = 80) =>
    value.replace(/[^A-Za-z\s.'-]/g, "").replace(/\s{2,}/g, " ").slice(0, max);
  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
  const isPhone = (v) => /^03\d{9}$/.test(String(v || "").replace(/\D/g, ""));

  const monthName = (m) =>
    new Date(2000, Math.max(0, m - 1), 1).toLocaleString("en-US", {
      month: "short",
    });

  const getEmployee = (id) => employees.find((e) => e._id === id);

  const computePayrollPreview = () => {
    const employee = getEmployee(payrollForm.employeeId);
    const basicSalary = Number(employee?.basicSalary || 0);
    const workingDays = Number(hrSettingsForm.hrMonthlyWorkingDays || 30);
    const hoursPerDay = Number(hrSettingsForm.hrWorkingHoursPerDay || 8);
    const overtimeRate = Number(hrSettingsForm.hrOvertimeRate || 1.5);
    const daysWorked = Number(payrollForm.daysWorked || 0);
    const overtimeHours = Number(payrollForm.overtimeHours || 0);
    const extraPay = Number(payrollForm.extraPay || 0);
    const otherDeductions = Number(payrollForm.otherDeductions || 0);

    const dailyRate = workingDays ? basicSalary / workingDays : 0;
    const hourlyRate = hoursPerDay ? dailyRate / hoursPerDay : 0;
    const overtimePay = overtimeHours * hourlyRate * overtimeRate;
    const basePay = dailyRate * daysWorked;
    const gross = Math.max(0, basePay + overtimePay + extraPay);
    const net = Math.max(0, gross - otherDeductions);
    return { gross, net, basicSalary };
  };

  const handleSubmitEmployee = async (e) => {
    e.preventDefault();
    const name = String(employeeForm.name || "").trim();
    const role = String(employeeForm.role || "").trim();
    const department = String(employeeForm.department || "").trim();
    const basicSalary = Number(employeeForm.basicSalary || 0);
    if (!name || !role || !department || !employeeForm.joinDate || !employeeForm.phone || !employeeForm.email || !employeeForm.address) {
      toast.error("All employee fields are required.");
      return;
    }
    if (!/^[A-Za-z\s.'-]{2,80}$/.test(name)) {
      toast.error("Enter valid employee name.");
      return;
    }
    if (!isPhone(employeeForm.phone)) {
      toast.error("Phone must be 11 digits (03XXXXXXXXX).");
      return;
    }
    if (!isEmail(employeeForm.email)) {
      toast.error("Enter valid email.");
      return;
    }
    if (!basicSalary || basicSalary <= 0) {
      toast.error("Salary must be greater than 0.");
      return;
    }
    try {
      if (employeeEditingId) {
        await api.put(`/hr/employees/${employeeEditingId}`, {
          ...employeeForm,
          name,
          role,
          department,
          phone: intOnly(employeeForm.phone, 11),
          email: String(employeeForm.email || "").trim().toLowerCase(),
          address: String(employeeForm.address || "").trim(),
          basicSalary,
        });
        toast.success("Employee updated.");
      } else {
        await api.post("/hr/employees", {
          ...employeeForm,
          name,
          role,
          department,
          phone: intOnly(employeeForm.phone, 11),
          email: String(employeeForm.email || "").trim().toLowerCase(),
          address: String(employeeForm.address || "").trim(),
          basicSalary,
        });
        toast.success("Employee added.");
      }
      setEmployeeForm(emptyEmployee);
      setEmployeeEditingId(null);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "Unable to save employee.");
    }
  };

  const handleSubmitJob = async (e) => {
    e.preventDefault();
    if (!jobForm.title) {
      toast.error("Job title required.");
      return;
    }
    try {
      if (jobEditingId) {
        await api.put(`/hr/jobs/${jobEditingId}`, {
          ...jobForm,
          vacancies: Number(jobForm.vacancies || 1),
        });
        toast.success("Job updated.");
      } else {
        await api.post("/hr/jobs", {
          ...jobForm,
          vacancies: Number(jobForm.vacancies || 1),
        });
        toast.success("Job added.");
      }
      setJobForm(emptyJob);
      setJobEditingId(null);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "Unable to save job.");
    }
  };

  const handleSubmitApplicant = async (e) => {
    e.preventDefault();
    if (!applicantForm.name) {
      toast.error("Applicant name required.");
      return;
    }
    const job = jobs.find((j) => j._id === applicantForm.jobId);
    try {
      if (applicantEditingId) {
        await api.put(`/hr/applicants/${applicantEditingId}`, {
          ...applicantForm,
          jobTitle: job?.title || "",
        });
        toast.success("Applicant updated.");
      } else {
        await api.post("/hr/applicants", {
          ...applicantForm,
          jobTitle: job?.title || "",
        });
        toast.success("Applicant added.");
      }
      setApplicantForm(emptyApplicant);
      setApplicantEditingId(null);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "Unable to save applicant.");
    }
  };

  const handleSubmitLeave = async (e) => {
    e.preventDefault();
    if (!leaveForm.employeeId || !leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason) {
      toast.error("Employee and dates are required.");
      return;
    }
    if (new Date(leaveForm.endDate) < new Date(leaveForm.startDate)) {
      toast.error("End date must be after start date.");
      return;
    }
    const employee = getEmployee(leaveForm.employeeId);
    try {
      if (leaveEditingId) {
        await api.put(`/hr/leaves/${leaveEditingId}`, {
          ...leaveForm,
          employeeName: employee?.name || "",
          days: Math.max(1, Number(leaveForm.days || 1)),
          reason: String(leaveForm.reason || "").trim(),
        });
        toast.success("Leave updated.");
      } else {
        await api.post("/hr/leaves", {
          ...leaveForm,
          employeeName: employee?.name || "",
          days: Math.max(1, Number(leaveForm.days || 1)),
          reason: String(leaveForm.reason || "").trim(),
        });
        toast.success("Leave added.");
      }
      setLeaveForm(emptyLeave);
      setLeaveEditingId(null);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "Unable to save leave.");
    }
  };

  const handleSubmitAdvance = async (e) => {
    e.preventDefault();
    const amount = Number(advanceForm.amount || 0);
    if (!advanceForm.employeeId || !amount || !advanceForm.date || !advanceForm.note) {
      toast.error("Employee and amount are required.");
      return;
    }
    if (amount <= 0) {
      toast.error("Advance amount must be greater than 0.");
      return;
    }
    const employee = getEmployee(advanceForm.employeeId);
    try {
      if (advanceEditingId) {
        await api.put(`/hr/advances/${advanceEditingId}`, {
          ...advanceForm,
          employeeName: employee?.name || "",
          amount,
          note: String(advanceForm.note || "").trim(),
        });
        toast.success("Advance updated.");
      } else {
        await api.post("/hr/advances", {
          ...advanceForm,
          employeeName: employee?.name || "",
          amount,
          note: String(advanceForm.note || "").trim(),
        });
        toast.success("Advance added.");
      }
      setAdvanceForm(emptyAdvance);
      setAdvanceEditingId(null);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "Unable to save advance.");
    }
  };

  const handleSubmitPayroll = async (e) => {
    e.preventDefault();
    if (!payrollForm.employeeId || payrollForm.daysWorked === "") {
      toast.error("Employee and days worked are required.");
      return;
    }
    if (Number(payrollForm.daysWorked) < 0 || Number(payrollForm.daysWorked) > 31) {
      toast.error("Days worked must be between 0 and 31.");
      return;
    }
    if (Number(payrollForm.overtimeHours || 0) < 0) {
      toast.error("Overtime hours cannot be negative.");
      return;
    }
    try {
      if (payrollEditingId) {
        await api.put(`/hr/payrolls/${payrollEditingId}`, {
          ...payrollForm,
          daysWorked: Number(payrollForm.daysWorked || 0),
          overtimeHours: Number(payrollForm.overtimeHours || 0),
          extraPay: Number(payrollForm.extraPay || 0),
          otherDeductions: Number(payrollForm.otherDeductions || 0),
        });
        toast.success("Payroll updated.");
      } else {
        await api.post("/hr/payrolls", {
          ...payrollForm,
          daysWorked: Number(payrollForm.daysWorked || 0),
          overtimeHours: Number(payrollForm.overtimeHours || 0),
          extraPay: Number(payrollForm.extraPay || 0),
          otherDeductions: Number(payrollForm.otherDeductions || 0),
        });
        toast.success("Payroll saved.");
      }
      setPayrollForm({ ...emptyPayroll, month: payrollForm.month, year: payrollForm.year });
      setPayrollEditingId(null);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "Unable to save payroll.");
    }
  };

  const handleDelete = async (path, id, label) => {
    try {
      await api.delete(`${path}/${id}`);
      toast.success(`${label} deleted.`);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "Unable to delete.");
    }
  };

  const handleSaveHrSettings = async () => {
    if (!settings) return;
    if (hrUnlock.pin.length !== 4) {
      setHrUnlock((p) => ({ ...p, pinError: "Enter 4-digit PIN." }));
      return;
    }
    try {
      setSavingHrSettings(true);
      const res = await api.put("/settings", {
        ...hrSettingsForm,
        hrMonthlyWorkingDays: Number(hrSettingsForm.hrMonthlyWorkingDays || 30),
        hrWorkingHoursPerDay: Number(hrSettingsForm.hrWorkingHoursPerDay || 8),
        hrOvertimeRate: Number(hrSettingsForm.hrOvertimeRate || 1.5),
        adminPin: hrUnlock.pin,
      });
      if (res.data?.success) {
        setSettings(res.data.data);
        setHrUnlock({ open: false, pin: "", pinError: "" });
        setHrUnlocked(true);
        toast.success("HR settings saved.");
      } else {
        setHrUnlock((p) => ({ ...p, pinError: res.data?.message || "Failed to save." }));
      }
    } catch (err) {
      setHrUnlock((p) => ({
        ...p,
        pinError: err.response?.data?.message || "Failed to save.",
      }));
    } finally {
      setSavingHrSettings(false);
    }
  };

  const unlockHrSettings = (pin) => {
    const expected = settings?.adminPin || "0000";
    if (pin === expected) {
      setHrUnlocked(true);
      setHrUnlock({ open: false, pin: "", pinError: "" });
      return;
    }
    setHrUnlock((p) => ({ ...p, pinError: "Incorrect PIN." }));
  };

  const payrollPreview = computePayrollPreview();

  const employeeColumns = [
    { key: "name", label: "Name" },
    { key: "role", label: "Role" },
    { key: "department", label: "Department" },
    { key: "basicSalary", label: "Basic Salary" },
    { key: "status", label: "Status" },
    {
      key: "actions",
      label: "Actions",
      skipExport: true,
      render: (_, row) => (
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEmployeeEditingId(row._id);
              setEmployeeForm({
                name: row.name || "",
                role: row.role || "",
                department: row.department || "",
                phone: row.phone || "",
                email: row.email || "",
                address: row.address || "",
                joinDate: row.joinDate ? row.joinDate.slice(0, 10) : "",
                status: row.status || "Active",
                basicSalary: String(row.basicSalary || ""),
              });
            }}
            className="p-1 rounded hover:bg-emerald-50"
            title="Edit"
          >
            <Pencil size={16} className="text-emerald-600" />
          </button>
          <button
            onClick={() => handleDelete("/hr/employees", row._id, "Employee")}
            className="p-1 rounded hover:bg-red-50"
            title="Delete"
          >
            <Trash2 size={16} className="text-red-500" />
          </button>
        </div>
      ),
    },
  ];

  const jobColumns = [
    { key: "title", label: "Title" },
    { key: "department", label: "Department" },
    { key: "vacancies", label: "Vacancies" },
    { key: "status", label: "Status" },
    {
      key: "actions",
      label: "Actions",
      skipExport: true,
      render: (_, row) => (
        <div className="flex gap-2">
          <button
            onClick={() => {
              setJobEditingId(row._id);
              setJobForm({
                title: row.title || "",
                department: row.department || "",
                vacancies: String(row.vacancies || 1),
                status: row.status || "Open",
                description: row.description || "",
              });
            }}
            className="p-1 rounded hover:bg-emerald-50"
          >
            <Pencil size={16} className="text-emerald-600" />
          </button>
          <button
            onClick={() => handleDelete("/hr/jobs", row._id, "Job")}
            className="p-1 rounded hover:bg-red-50"
          >
            <Trash2 size={16} className="text-red-500" />
          </button>
        </div>
      ),
    },
  ];

  const applicantColumns = [
    { key: "name", label: "Name" },
    { key: "jobTitle", label: "Job" },
    { key: "phone", label: "Phone" },
    { key: "status", label: "Status" },
    {
      key: "actions",
      label: "Actions",
      skipExport: true,
      render: (_, row) => (
        <div className="flex gap-2">
          <button
            onClick={() => {
              setApplicantEditingId(row._id);
              setApplicantForm({
                name: row.name || "",
                phone: row.phone || "",
                email: row.email || "",
                jobId: row.jobId || "",
                status: row.status || "Applied",
                notes: row.notes || "",
              });
            }}
            className="p-1 rounded hover:bg-emerald-50"
          >
            <Pencil size={16} className="text-emerald-600" />
          </button>
          <button
            onClick={() => handleDelete("/hr/applicants", row._id, "Applicant")}
            className="p-1 rounded hover:bg-red-50"
          >
            <Trash2 size={16} className="text-red-500" />
          </button>
        </div>
      ),
    },
  ];

  const leaveColumns = [
    { key: "employeeName", label: "Employee" },
    { key: "type", label: "Type" },
    { key: "days", label: "Days" },
    {
      key: "startDate",
      label: "Start",
      render: (val) => (val ? new Date(val).toLocaleDateString() : "-"),
    },
    {
      key: "endDate",
      label: "End",
      render: (val) => (val ? new Date(val).toLocaleDateString() : "-"),
    },
    { key: "status", label: "Status" },
    {
      key: "actions",
      label: "Actions",
      skipExport: true,
      render: (_, row) => (
        <div className="flex gap-2">
          <button
            onClick={() => {
              setLeaveEditingId(row._id);
              setLeaveForm({
                employeeId: row.employeeId || "",
                type: row.type || "Paid",
                startDate: row.startDate ? row.startDate.slice(0, 10) : "",
                endDate: row.endDate ? row.endDate.slice(0, 10) : "",
                days: String(row.days || 1),
                reason: row.reason || "",
                status: row.status || "Pending",
              });
            }}
            className="p-1 rounded hover:bg-emerald-50"
          >
            <Pencil size={16} className="text-emerald-600" />
          </button>
          <button
            onClick={() => handleDelete("/hr/leaves", row._id, "Leave")}
            className="p-1 rounded hover:bg-red-50"
          >
            <Trash2 size={16} className="text-red-500" />
          </button>
        </div>
      ),
    },
  ];

  const advanceColumns = [
    { key: "employeeName", label: "Employee" },
    { key: "amount", label: "Amount" },
    {
      key: "date",
      label: "Date",
      render: (val) => (val ? new Date(val).toLocaleDateString() : "-"),
    },
    { key: "status", label: "Status" },
    {
      key: "actions",
      label: "Actions",
      skipExport: true,
      render: (_, row) => (
        <div className="flex gap-2">
          <button
            onClick={() => {
              setAdvanceEditingId(row._id);
              setAdvanceForm({
                employeeId: row.employeeId || "",
                amount: String(row.amount || ""),
                date: row.date ? row.date.slice(0, 10) : "",
                status: row.status || "Pending",
                note: row.note || "",
              });
            }}
            className="p-1 rounded hover:bg-emerald-50"
          >
            <Pencil size={16} className="text-emerald-600" />
          </button>
          <button
            onClick={() => handleDelete("/hr/advances", row._id, "Advance")}
            className="p-1 rounded hover:bg-red-50"
          >
            <Trash2 size={16} className="text-red-500" />
          </button>
        </div>
      ),
    },
  ];

  const payrollColumns = [
    { key: "employeeName", label: "Employee" },
    {
      key: "month",
      label: "Month",
      render: (val, row) => `${monthName(val)} ${row.year}`,
    },
    { key: "daysWorked", label: "Days" },
    { key: "grossPay", label: "Gross" },
    { key: "netPay", label: "Net" },
    { key: "status", label: "Status" },
    {
      key: "actions",
      label: "Actions",
      skipExport: true,
      render: (_, row) => (
        <div className="flex gap-2">
          <button
            onClick={() => {
              setPayrollEditingId(row._id);
              setPayrollForm({
                employeeId: row.employeeId || "",
                month: row.month || new Date().getMonth() + 1,
                year: row.year || new Date().getFullYear(),
                daysWorked: String(row.daysWorked || ""),
                overtimeHours: String(row.overtimeHours || ""),
                extraPay: String(row.extraPay || ""),
                otherDeductions: String(row.otherDeductions || ""),
                status: row.status || "Unpaid",
                notes: row.notes || "",
              });
            }}
            className="p-1 rounded hover:bg-emerald-50"
          >
            <Pencil size={16} className="text-emerald-600" />
          </button>
          <button
            onClick={() => handleDelete("/hr/payrolls", row._id, "Payroll")}
            className="p-1 rounded hover:bg-red-50"
          >
            <Trash2 size={16} className="text-red-500" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <Toaster />
      <div className="border-b border-emerald-200">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const isActive = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-2 text-sm rounded-t-lg border-b-2 ${
                  isActive
                    ? "bg-emerald-50 text-emerald-700 font-semibold border-emerald-600"
                    : "text-gray-500 border-transparent hover:text-emerald-600 hover:bg-emerald-50"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "employees" && (
        <div className="grid lg:grid-cols-3 gap-4">
          <form
            onSubmit={handleSubmitEmployee}
            className="bg-white rounded-lg shadow p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-emerald-700">
                {employeeEditingId ? "Edit Employee" : "Add Employee"}
              </h3>
              <Plus size={16} className="text-emerald-600" />
            </div>
            <input
              value={employeeForm.name}
              onChange={(e) =>
                setEmployeeForm((p) => ({ ...p, name: textOnlyName(e.target.value) }))
              }
              placeholder="Employee name"
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <input
              value={employeeForm.role}
              onChange={(e) =>
                setEmployeeForm((p) => ({ ...p, role: textOnlyName(e.target.value) }))
              }
              placeholder="Role"
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <input
              value={employeeForm.department}
              onChange={(e) =>
                setEmployeeForm((p) => ({ ...p, department: textOnlyName(e.target.value) }))
              }
              placeholder="Department"
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <input
              value={employeeForm.basicSalary}
              onChange={(e) =>
                setEmployeeForm((p) => ({
                  ...p,
                  basicSalary: numberOnly(e.target.value, 10),
                }))
              }
              placeholder="Basic salary"
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <input
              value={employeeForm.phone}
              onChange={(e) =>
                setEmployeeForm((p) => ({ ...p, phone: intOnly(e.target.value, 11) }))
              }
              placeholder="03XXXXXXXXX"
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <input
              value={employeeForm.email}
              onChange={(e) =>
                setEmployeeForm((p) => ({ ...p, email: e.target.value }))
              }
              placeholder="Email"
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <input
              value={employeeForm.address}
              onChange={(e) =>
                setEmployeeForm((p) => ({ ...p, address: e.target.value }))
              }
              placeholder="Address"
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={employeeForm.joinDate}
              onChange={(e) =>
                setEmployeeForm((p) => ({ ...p, joinDate: e.target.value }))
              }
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <select
              value={employeeForm.status}
              onChange={(e) =>
                setEmployeeForm((p) => ({ ...p, status: e.target.value }))
              }
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <div className="flex justify-end gap-2">
              {employeeEditingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEmployeeEditingId(null);
                    setEmployeeForm(emptyEmployee);
                  }}
                  className="px-3 py-2 text-xs rounded border border-gray-300"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="px-3 py-2 text-xs rounded bg-emerald-600 text-white"
              >
                {employeeEditingId ? "Update" : "Save"}
              </button>
            </div>
          </form>

          <div className="lg:col-span-2 bg-white rounded-lg shadow p-4">
            <DataTable
              title="Employees"
              columns={employeeColumns}
              data={employees}
              searchPlaceholder="Search employees..."
              deleteAll={{
                description: "This will permanently delete ALL employees from the database.",
                onConfirm: async (adminPin) => {
                  const res = await api.post("/admin/purge", { adminPin, key: "hrEmployees" });
                  const deleted = res?.data?.data?.deletedCount ?? 0;
                  toast.success(`Deleted ${deleted} employees`);
                  loadAll();
                },
              }}
            />
          </div>
        </div>
      )}

      {activeTab === "hiring" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="space-y-4">
            <form
              onSubmit={handleSubmitJob}
              className="bg-white rounded-lg shadow p-4 space-y-3"
            >
              <h3 className="text-sm font-semibold text-emerald-700">
                {jobEditingId ? "Edit Job" : "Add Job"}
              </h3>
              <input
                value={jobForm.title}
                onChange={(e) =>
                  setJobForm((p) => ({ ...p, title: e.target.value }))
                }
                placeholder="Job title"
                className="w-full border rounded px-3 py-2 text-sm"
              />
              <input
                value={jobForm.department}
                onChange={(e) =>
                  setJobForm((p) => ({ ...p, department: e.target.value }))
                }
                placeholder="Department"
                className="w-full border rounded px-3 py-2 text-sm"
              />
              <input
                value={jobForm.vacancies}
                onChange={(e) =>
                  setJobForm((p) => ({
                    ...p,
                    vacancies: numberOnly(e.target.value, 3),
                  }))
                }
                placeholder="Vacancies"
                className="w-full border rounded px-3 py-2 text-sm"
              />
              <select
                value={jobForm.status}
                onChange={(e) =>
                  setJobForm((p) => ({ ...p, status: e.target.value }))
                }
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="Open">Open</option>
                <option value="Closed">Closed</option>
              </select>
              <textarea
                value={jobForm.description}
                onChange={(e) =>
                  setJobForm((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="Description"
                className="w-full border rounded px-3 py-2 text-sm"
              />
              <div className="flex justify-end gap-2">
                {jobEditingId && (
                  <button
                    type="button"
                    onClick={() => {
                      setJobEditingId(null);
                      setJobForm(emptyJob);
                    }}
                    className="px-3 py-2 text-xs rounded border border-gray-300"
                  >
                    Cancel
                  </button>
                )}
                <button className="px-3 py-2 text-xs rounded bg-emerald-600 text-white">
                  {jobEditingId ? "Update" : "Save"}
                </button>
              </div>
            </form>

            <div className="bg-white rounded-lg shadow p-4">
              <DataTable
                title="Jobs"
                columns={jobColumns}
                data={jobs}
                searchPlaceholder="Search jobs..."
                deleteAll={{
                  description: "This will permanently delete ALL jobs from the database.",
                  onConfirm: async (adminPin) => {
                    const res = await api.post("/admin/purge", { adminPin, key: "hrJobs" });
                    const deleted = res?.data?.data?.deletedCount ?? 0;
                    toast.success(`Deleted ${deleted} jobs`);
                    loadAll();
                  },
                }}
              />
            </div>
          </div>

          <div className="space-y-4">
            <form
              onSubmit={handleSubmitApplicant}
              className="bg-white rounded-lg shadow p-4 space-y-3"
            >
              <h3 className="text-sm font-semibold text-emerald-700">
                {applicantEditingId ? "Edit Applicant" : "Add Applicant"}
              </h3>
              <input
                value={applicantForm.name}
                onChange={(e) =>
                  setApplicantForm((p) => ({
                    ...p,
                    name: textOnlyName(e.target.value),
                  }))
                }
                placeholder="Applicant name"
                className="w-full border rounded px-3 py-2 text-sm"
              />
              <input
                value={applicantForm.phone}
                onChange={(e) =>
                  setApplicantForm((p) => ({
                    ...p,
                    phone: intOnly(e.target.value, 11),
                  }))
                }
                placeholder="03XXXXXXXXX"
                className="w-full border rounded px-3 py-2 text-sm"
              />
              <input
                value={applicantForm.email}
                onChange={(e) =>
                  setApplicantForm((p) => ({ ...p, email: e.target.value }))
                }
                placeholder="Email"
                className="w-full border rounded px-3 py-2 text-sm"
              />
              <select
                value={applicantForm.jobId}
                onChange={(e) =>
                  setApplicantForm((p) => ({ ...p, jobId: e.target.value }))
                }
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">Select job</option>
                {jobOptions.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                  </option>
                ))}
              </select>
              <select
                value={applicantForm.status}
                onChange={(e) =>
                  setApplicantForm((p) => ({ ...p, status: e.target.value }))
                }
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="Applied">Applied</option>
                <option value="Interview">Interview</option>
                <option value="Selected">Selected</option>
                <option value="Rejected">Rejected</option>
              </select>
              <textarea
                value={applicantForm.notes}
                onChange={(e) =>
                  setApplicantForm((p) => ({ ...p, notes: e.target.value }))
                }
                placeholder="Notes"
                className="w-full border rounded px-3 py-2 text-sm"
              />
              <div className="flex justify-end gap-2">
                {applicantEditingId && (
                  <button
                    type="button"
                    onClick={() => {
                      setApplicantEditingId(null);
                      setApplicantForm(emptyApplicant);
                    }}
                    className="px-3 py-2 text-xs rounded border border-gray-300"
                  >
                    Cancel
                  </button>
                )}
                <button className="px-3 py-2 text-xs rounded bg-emerald-600 text-white">
                  {applicantEditingId ? "Update" : "Save"}
                </button>
              </div>
            </form>

            <div className="bg-white rounded-lg shadow p-4">
              <DataTable
                title="Applicants"
                columns={applicantColumns}
                data={applicants}
                searchPlaceholder="Search applicants..."
                deleteAll={{
                  description: "This will permanently delete ALL applicants from the database.",
                  onConfirm: async (adminPin) => {
                    const res = await api.post("/admin/purge", { adminPin, key: "hrApplicants" });
                    const deleted = res?.data?.data?.deletedCount ?? 0;
                    toast.success(`Deleted ${deleted} applicants`);
                    loadAll();
                  },
                }}
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === "leaves" && (
        <div className="grid lg:grid-cols-3 gap-4">
          <form
            onSubmit={handleSubmitLeave}
            className="bg-white rounded-lg shadow p-4 space-y-3"
          >
            <h3 className="text-sm font-semibold text-emerald-700">
              {leaveEditingId ? "Edit Leave" : "Add Leave"}
            </h3>
            <select
              value={leaveForm.employeeId}
              onChange={(e) =>
                setLeaveForm((p) => ({ ...p, employeeId: e.target.value }))
              }
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="">Select employee</option>
              {employeeOptions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <div className="flex gap-3 text-sm text-gray-700">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={leaveForm.type === "Paid"}
                  onChange={() =>
                    setLeaveForm((p) => ({ ...p, type: "Paid" }))
                  }
                />
                Paid
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={leaveForm.type === "Unpaid"}
                  onChange={() =>
                    setLeaveForm((p) => ({ ...p, type: "Unpaid" }))
                  }
                />
                Unpaid
              </label>
            </div>
            <input
              type="date"
              value={leaveForm.startDate}
              onChange={(e) =>
                setLeaveForm((p) => ({ ...p, startDate: e.target.value }))
              }
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={leaveForm.endDate}
              onChange={(e) =>
                setLeaveForm((p) => ({ ...p, endDate: e.target.value }))
              }
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <input
              value={leaveForm.days}
              onChange={(e) =>
                setLeaveForm((p) => ({
                  ...p,
                  days: numberOnly(e.target.value, 3),
                }))
              }
              placeholder="Days"
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <select
              value={leaveForm.status}
              onChange={(e) =>
                setLeaveForm((p) => ({ ...p, status: e.target.value }))
              }
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
            <textarea
              value={leaveForm.reason}
              onChange={(e) =>
                setLeaveForm((p) => ({ ...p, reason: e.target.value }))
              }
              placeholder="Reason"
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2">
              {leaveEditingId && (
                <button
                  type="button"
                  onClick={() => {
                    setLeaveEditingId(null);
                    setLeaveForm(emptyLeave);
                  }}
                  className="px-3 py-2 text-xs rounded border border-gray-300"
                >
                  Cancel
                </button>
              )}
              <button className="px-3 py-2 text-xs rounded bg-emerald-600 text-white">
                {leaveEditingId ? "Update" : "Save"}
              </button>
            </div>
          </form>

          <div className="lg:col-span-2 bg-white rounded-lg shadow p-4">
            <DataTable
              title="Leaves"
              columns={leaveColumns}
              data={leaves}
              deleteAll={{
                description: "This will permanently delete ALL leaves from the database.",
                onConfirm: async (adminPin) => {
                  const res = await api.post("/admin/purge", { adminPin, key: "hrLeaves" });
                  const deleted = res?.data?.data?.deletedCount ?? 0;
                  toast.success(`Deleted ${deleted} leaves`);
                  loadAll();
                },
              }}
            />
          </div>
        </div>
      )}

      {activeTab === "advances" && (
        <div className="grid lg:grid-cols-3 gap-4">
          <form
            onSubmit={handleSubmitAdvance}
            className="bg-white rounded-lg shadow p-4 space-y-3"
          >
            <h3 className="text-sm font-semibold text-emerald-700">
              {advanceEditingId ? "Edit Advance" : "Add Advance"}
            </h3>
            <select
              value={advanceForm.employeeId}
              onChange={(e) =>
                setAdvanceForm((p) => ({ ...p, employeeId: e.target.value }))
              }
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="">Select employee</option>
              {employeeOptions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <input
              value={advanceForm.amount}
              onChange={(e) =>
                setAdvanceForm((p) => ({
                  ...p,
                  amount: numberOnly(e.target.value, 10),
                }))
              }
              placeholder="Amount"
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={advanceForm.date}
              onChange={(e) =>
                setAdvanceForm((p) => ({ ...p, date: e.target.value }))
              }
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <select
              value={advanceForm.status}
              onChange={(e) =>
                setAdvanceForm((p) => ({ ...p, status: e.target.value }))
              }
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="Pending">Pending</option>
              <option value="Deducted">Deducted</option>
            </select>
            <textarea
              value={advanceForm.note}
              onChange={(e) =>
                setAdvanceForm((p) => ({ ...p, note: e.target.value }))
              }
              placeholder="Note"
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2">
              {advanceEditingId && (
                <button
                  type="button"
                  onClick={() => {
                    setAdvanceEditingId(null);
                    setAdvanceForm(emptyAdvance);
                  }}
                  className="px-3 py-2 text-xs rounded border border-gray-300"
                >
                  Cancel
                </button>
              )}
              <button className="px-3 py-2 text-xs rounded bg-emerald-600 text-white">
                {advanceEditingId ? "Update" : "Save"}
              </button>
            </div>
          </form>

          <div className="lg:col-span-2 bg-white rounded-lg shadow p-4">
            <DataTable
              title="Advances"
              columns={advanceColumns}
              data={advances}
              deleteAll={{
                description: "This will permanently delete ALL advances from the database.",
                onConfirm: async (adminPin) => {
                  const res = await api.post("/admin/purge", { adminPin, key: "hrAdvances" });
                  const deleted = res?.data?.data?.deletedCount ?? 0;
                  toast.success(`Deleted ${deleted} advances`);
                  loadAll();
                },
              }}
            />
          </div>
        </div>
      )}

      {activeTab === "payroll" && (
        <div className="grid lg:grid-cols-3 gap-4">
          <form
            onSubmit={handleSubmitPayroll}
            className="bg-white rounded-lg shadow p-4 space-y-3"
          >
            <h3 className="text-sm font-semibold text-emerald-700">
              {payrollEditingId ? "Edit Payroll" : "Run Payroll"}
            </h3>
            <select
              value={payrollForm.employeeId}
              onChange={(e) =>
                setPayrollForm((p) => ({ ...p, employeeId: e.target.value }))
              }
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="">Select employee</option>
              {employeeOptions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={payrollForm.month}
                onChange={(e) =>
                  setPayrollForm((p) => ({
                    ...p,
                    month: Number(e.target.value || 1),
                  }))
                }
                placeholder="Month"
                className="w-full border rounded px-3 py-2 text-sm"
              />
              <input
                value={payrollForm.year}
                onChange={(e) =>
                  setPayrollForm((p) => ({
                    ...p,
                    year: Number(e.target.value || 2026),
                  }))
                }
                placeholder="Year"
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <input
              value={payrollForm.daysWorked}
              onChange={(e) =>
                setPayrollForm((p) => ({
                  ...p,
                  daysWorked: numberOnly(e.target.value, 3),
                }))
              }
              placeholder="Days worked"
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <input
              value={payrollForm.overtimeHours}
              onChange={(e) =>
                setPayrollForm((p) => ({
                  ...p,
                  overtimeHours: numberOnly(e.target.value, 4),
                }))
              }
              placeholder="Overtime hours"
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <input
              value={payrollForm.extraPay}
              onChange={(e) =>
                setPayrollForm((p) => ({
                  ...p,
                  extraPay: numberOnly(e.target.value, 10),
                }))
              }
              placeholder="Extra pay"
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <input
              value={payrollForm.otherDeductions}
              onChange={(e) =>
                setPayrollForm((p) => ({
                  ...p,
                  otherDeductions: numberOnly(e.target.value, 10),
                }))
              }
              placeholder="Other deductions"
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <select
              value={payrollForm.status}
              onChange={(e) =>
                setPayrollForm((p) => ({ ...p, status: e.target.value }))
              }
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="Unpaid">Unpaid</option>
              <option value="Paid">Paid</option>
            </select>
            <textarea
              value={payrollForm.notes}
              onChange={(e) =>
                setPayrollForm((p) => ({ ...p, notes: e.target.value }))
              }
              placeholder="Notes"
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <div className="text-xs text-gray-500">
              Gross: Rs {Math.round(payrollPreview.gross || 0)} | Net: Rs{" "}
              {Math.round(payrollPreview.net || 0)}
            </div>
            <div className="flex justify-end gap-2">
              {payrollEditingId && (
                <button
                  type="button"
                  onClick={() => {
                    setPayrollEditingId(null);
                    setPayrollForm(emptyPayroll);
                  }}
                  className="px-3 py-2 text-xs rounded border border-gray-300"
                >
                  Cancel
                </button>
              )}
              <button className="px-3 py-2 text-xs rounded bg-emerald-600 text-white">
                {payrollEditingId ? "Update" : "Save"}
              </button>
            </div>
          </form>

          <div className="lg:col-span-2 bg-white rounded-lg shadow p-4">
            <DataTable
              title="Payroll"
              columns={payrollColumns}
              data={payrolls}
              deleteAll={{
                description: "This will permanently delete ALL payroll records from the database.",
                onConfirm: async (adminPin) => {
                  const res = await api.post("/admin/purge", { adminPin, key: "hrPayrolls" });
                  const deleted = res?.data?.data?.deletedCount ?? 0;
                  toast.success(`Deleted ${deleted} payroll records`);
                  loadAll();
                },
              }}
            />
          </div>
        </div>
      )}

      {activeTab === "settings" && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-emerald-700">
              HR Settings
            </h3>
            {!hrUnlocked && (
              <button
                type="button"
                onClick={() =>
                  setHrUnlock({ open: true, pin: "", pinError: "" })
                }
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-amber-500 text-amber-700 hover:bg-amber-50"
              >
                <Lock size={14} />
                Unlock with PIN
              </button>
            )}
          </div>

          {hrUnlocked ? (
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Monthly working days
                </label>
                <input
                  value={hrSettingsForm.hrMonthlyWorkingDays}
                  onChange={(e) =>
                    setHrSettingsForm((p) => ({
                      ...p,
                      hrMonthlyWorkingDays: numberOnly(e.target.value, 3),
                    }))
                  }
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Working hours per day
                </label>
                <input
                  value={hrSettingsForm.hrWorkingHoursPerDay}
                  onChange={(e) =>
                    setHrSettingsForm((p) => ({
                      ...p,
                      hrWorkingHoursPerDay: numberOnly(e.target.value, 2),
                    }))
                  }
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Overtime rate
                </label>
                <input
                  value={hrSettingsForm.hrOvertimeRate}
                  onChange={(e) =>
                    setHrSettingsForm((p) => ({
                      ...p,
                      hrOvertimeRate: numberOnly(e.target.value, 4),
                    }))
                  }
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Advance deduction
                </label>
                <select
                  value={hrSettingsForm.hrAdvanceDeductionMode}
                  onChange={(e) =>
                    setHrSettingsForm((p) => ({
                      ...p,
                      hrAdvanceDeductionMode: e.target.value,
                    }))
                  }
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="FULL">Full Deduction</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={hrSettingsForm.hrAllowPaidLeave}
                  onChange={(e) =>
                    setHrSettingsForm((p) => ({
                      ...p,
                      hrAllowPaidLeave: e.target.checked,
                    }))
                  }
                />
                <span>Allow Paid Leave</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={hrSettingsForm.hrAllowUnpaidLeave}
                  onChange={(e) =>
                    setHrSettingsForm((p) => ({
                      ...p,
                      hrAllowUnpaidLeave: e.target.checked,
                    }))
                  }
                />
                <span>Allow Unpaid Leave</span>
              </div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setHrUnlocked(false)}
                  className="px-3 py-2 text-xs rounded border border-gray-300"
                >
                  Lock
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setHrUnlock({ open: true, pin: "", pinError: "" })
                  }
                  className="px-3 py-2 text-xs rounded border border-emerald-500 text-emerald-700"
                >
                  Confirm with PIN
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              Unlock to view and edit HR settings.
            </div>
          )}
        </div>
      )}

      {hrUnlock.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Admin PIN
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Enter PIN to unlock or save HR settings.
            </p>
            <Pin4Input
              value={hrUnlock.pin}
              onChange={(v) =>
                setHrUnlock((p) => ({ ...p, pin: v.slice(0, 4), pinError: "" }))
              }
              onComplete={(entered) => unlockHrSettings(entered)}
              error={!!hrUnlock.pinError}
              className="mb-3"
            />
            {hrUnlock.pinError && (
              <p className="text-xs text-red-600 mb-3">{hrUnlock.pinError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() =>
                  setHrUnlock({ open: false, pin: "", pinError: "" })
                }
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveHrSettings}
                disabled={savingHrSettings || hrUnlock.pin.length !== 4}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 text-sm"
              >
                {savingHrSettings ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
