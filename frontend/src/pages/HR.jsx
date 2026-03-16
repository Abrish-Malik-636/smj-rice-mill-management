import React, { useEffect, useMemo, useState } from "react";
import { Save, Trash2, Wand2, CreditCard, Users, Wallet, Edit2, Printer } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../services/api";
import DataTable from "../components/ui/DataTable";

const TABS = [
  { key: "payroll", label: "Payroll", icon: <Wallet size={16} /> },
  { key: "employees", label: "Employees", icon: <Users size={16} /> },
];

const emptyEmployee = {
  name: "",
  fatherName: "",
  cnic: "",
  phone: "",
  address: "",
  department: "",
  joiningDate: "",
  salaryType: "MONTHLY",
  basicSalary: "",
  status: "ACTIVE",
};

const OTHER_OPTION = "__OTHER__";
const NAME_REGEX = /^[A-Za-z\s.'-]+$/;
const CNIC_REGEX = /^\d{5}-\d{7}-\d{1}$/;
const PHONE_REGEX = /^03\d{2}-\d{7}$/;

function toTitleCaseName(raw) {
  const s = String(raw || "").trim().toLowerCase();
  // Uppercase first letter of each word, including parts after - and '
  return s.replace(/(^|[\s-'])\w/g, (m) => m.toUpperCase());
}

function normalizeName(raw) {
  return String(raw || "")
    .replace(/[^A-Za-z\s.'-]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 25);
}

function normalizeSalaryDigits(raw) {
  // Keep digits only; allow empty; max 10 digits.
  const digits = String(raw ?? "").replace(/\D/g, "").slice(0, 10);
  return digits;
}

function normalizeCNIC(raw) {
  const digits = String(raw || "").replace(/\D/g, "").slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

function normalizePhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

const emptyAdvance = {
  employeeId: "",
  date: "",
  amount: "",
  paymentMethod: "CASH",
  note: "",
};

const emptyPayroll = {
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  earnings: [],
  deductionsItems: [],
  paymentDate: "",
  paymentMethod: "CASH",
};

const num = (v) => (v === "" || v == null ? 0 : Number(v || 0) || 0);
const round2 = (n) => Number((Number(n || 0)).toFixed(2));

function computeTotalsFromItems({ earnings, deductionsItems }) {
  const e = Array.isArray(earnings) ? earnings : [];
  const d = Array.isArray(deductionsItems) ? deductionsItems : [];
  const totalEarnings = round2(e.reduce((s, it) => s + num(it?.amount), 0));
  const totalDeductions = round2(d.reduce((s, it) => s + num(it?.amount), 0));
  const netPay = Math.max(0, round2(totalEarnings - totalDeductions));
  return { totalEarnings, totalDeductions, netPay };
}

const EARNINGS_PRESETS = [
  "Basic",
  "Incentive",
  "Overtime",
  "Bonus",
  "Other",
];
const DEDUCTION_PRESETS = [
  "Advance / Loan",
  "Provident Fund",
  "Professional Tax",
  "Other Deduction",
];
const NEW_OPT = "__NEW__";
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function makeDefaultEarnings(basicSalary) {
  return [
    { key: "basic", title: "Basic", amount: String(Math.round(num(basicSalary))) },
    { key: "incentive", title: "Incentive", amount: "" },
    { key: "overtime", title: "Overtime", amount: "" },
    { key: "bonus", title: "Bonus", amount: "" },
    { key: "other", title: "Other", amount: "" },
  ];
}

function makeDefaultDeductions(openAdvance) {
  return [
    { key: "advance", title: "Advance / Loan", amount: openAdvance ? String(Math.round(num(openAdvance))) : "" },
    { key: "pf", title: "Provident Fund", amount: "" },
    { key: "tax", title: "Professional Tax", amount: "" },
    { key: "other", title: "Other Deduction", amount: "" },
  ];
}

export default function HR() {
  const [activeTab, setActiveTab] = useState("employees");
  const [meta, setMeta] = useState({ departments: [] });

  const [employees, setEmployees] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  const [advances, setAdvances] = useState([]);

  const [employeeForm, setEmployeeForm] = useState({ ...emptyEmployee });
  const [employeeSaving, setEmployeeSaving] = useState(false);
  const [employeeErrors, setEmployeeErrors] = useState({});
  const [customDepartment, setCustomDepartment] = useState("");
  const [employeeSubmitted, setEmployeeSubmitted] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);

  const [advanceForm, setAdvanceForm] = useState({ ...emptyAdvance });
  const [advanceSaving, setAdvanceSaving] = useState(false);
  const [advanceErrors, setAdvanceErrors] = useState({});
  const [advanceEditingId, setAdvanceEditingId] = useState(null);

  const [payrollForm, setPayrollForm] = useState({ ...emptyPayroll });
  const [payrollSaving, setPayrollSaving] = useState(false);
  const [payrollErrors, setPayrollErrors] = useState({});
  const [payrollGenerating, setPayrollGenerating] = useState(false);
  const [payTarget, setPayTarget] = useState(null);
  const [expandedEmployeeId, setExpandedEmployeeId] = useState(null);

  const employeeOptions = useMemo(
    () =>
      (employees || [])
        .filter((e) => e.status === "ACTIVE")
        .map((e) => ({ id: e._id, label: `${e.employeeId || ""} ${e.name || ""}`.trim() })),
    [employees],
  );

  const loadAll = async () => {
    try {
      const [m, e, p, a] = await Promise.all([
        api.get("/hr/meta"),
        api.get("/hr/employees"),
        api.get("/hr/payrolls"),
        api.get("/hr/advances"),
      ]);
      setMeta(m.data?.data || { departments: [] });
      setEmployees(e.data?.data || []);
      setPayrolls(p.data?.data || []);
      setAdvances(a.data?.data || []);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load HR data");
    }
  };


  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    // Keep payrolls in sync with selected month/year in payroll tab.
    const month = Number(payrollForm.month);
    const year = Number(payrollForm.year);
    if (!month || !year) return;
    api
      .get("/hr/payrolls", { params: { month, year } })
      .then((res) => setPayrolls(res.data?.data || []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payrollForm.month, payrollForm.year]);


  const getEmployeeFieldState = (field, value) => {
    const v = String(value ?? "").trim();
    const deptFinal =
      employeeForm.department === OTHER_OPTION
        ? String(customDepartment || "").trim()
        : String(employeeForm.department || "").trim();

    if (field === "name") {
      if (!v) return { error: "Employee name is required", ok: false };
      if (v.length > 25) return { error: "Name must be 25 characters or less", ok: false };
      if (!NAME_REGEX.test(v)) return { error: "Name: letters only", ok: false };
      return { error: "", ok: true };
    }
    if (field === "fatherName") {
      if (!v) return { error: "Father name is required", ok: false };
      if (v.length > 25) return { error: "Father name must be 25 characters or less", ok: false };
      if (!NAME_REGEX.test(v)) return { error: "Father name: letters only", ok: false };
      return { error: "", ok: true };
    }
    if (field === "cnic") {
      if (!v) return { error: "CNIC is required", ok: false };
      if (!CNIC_REGEX.test(v)) return { error: "CNIC: 12345-1234567-1", ok: false };
      return { error: "", ok: true };
    }
    if (field === "phone") {
      if (!v) return { error: "Phone is required", ok: false };
      if (!PHONE_REGEX.test(v)) return { error: "Phone: 03XX-XXXXXXX", ok: false };
      return { error: "", ok: true };
    }
    if (field === "department") {
      if (!deptFinal) return { error: "Department is required", ok: false };
      if (deptFinal.length < 2) return { error: "Department must be at least 2 characters", ok: false };
      return { error: "", ok: true };
    }
    if (field === "basicSalary") {
      if (employeeForm.basicSalary === "") return { error: "Basic salary is required", ok: false };
      if (String(employeeForm.basicSalary || "").length > 10) return { error: "Basic salary: max 10 digits", ok: false };
      if (num(employeeForm.basicSalary) < 0) return { error: "Basic salary cannot be negative", ok: false };
      return { error: "", ok: true };
    }
    if (field === "address") {
      if (!v) return { error: "Address is required", ok: false };
      if (v.length < 5) return { error: "Address must be at least 5 characters", ok: false };
      if (v.length > 200) return { error: "Address is too long", ok: false };
      return { error: "", ok: true };
    }
    if (field === "joiningDate") {
      if (!v) return { error: "Joining date is required", ok: false };
      return { error: "", ok: true };
    }
    return { error: "", ok: false };
  };

  const validateEmployeeAll = () => {
    const nextErr = {};
    const n = getEmployeeFieldState("name", employeeForm.name);
    if (n.error) nextErr.name = n.error;

    const f = getEmployeeFieldState("fatherName", employeeForm.fatherName);
    if (f.error) nextErr.fatherName = f.error;

    const c = getEmployeeFieldState("cnic", employeeForm.cnic);
    if (c.error) nextErr.cnic = c.error;

    const p = getEmployeeFieldState("phone", employeeForm.phone);
    if (p.error) nextErr.phone = p.error;

    const d = getEmployeeFieldState("department", employeeForm.department);
    if (d.error) nextErr.department = d.error;

    const b = getEmployeeFieldState("basicSalary", employeeForm.basicSalary);
    if (b.error) nextErr.basicSalary = b.error;

    const a = getEmployeeFieldState("address", employeeForm.address);
    if (a.error) nextErr.address = a.error;

    const j = getEmployeeFieldState("joiningDate", employeeForm.joiningDate);
    if (j.error) nextErr.joiningDate = j.error;

    setEmployeeErrors(nextErr);
    return Object.keys(nextErr).length === 0;
  };

  const createEmployee = async () => {
    setEmployeeSubmitted(true);
    if (!validateEmployeeAll()) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    const name = String(employeeForm.name || "").trim();
    const deptFinal =
      employeeForm.department === OTHER_OPTION
        ? String(customDepartment || "").trim()
        : String(employeeForm.department || "").trim();
    setEmployeeSaving(true);
    try {
      const payload = {
        ...employeeForm,
        name,
        basicSalary: num(employeeForm.basicSalary),
        department: deptFinal,
      };
      const res = await api.post("/hr/employees", payload);
      toast.success("Employee saved");
      setEmployeeForm({ ...emptyEmployee });
      setEmployeeErrors({});
      setCustomDepartment("");
      setEmployeeSubmitted(false);
      setEmployees((prev) => [res.data.data, ...prev]);
      // refresh departments list (in case a new one was added)
      const m = await api.get("/hr/meta");
      setMeta(m.data?.data || { departments: [] });
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save employee");
    } finally {
      setEmployeeSaving(false);
    }
  };

  const deleteEmployee = async (row) => {
    if (!row?._id) return;
    if (!confirm("Delete employee permanently?")) return;
    try {
      await api.delete(`/hr/employees/${row._id}`);
      toast.success("Employee deleted");
      setEmployees((prev) => prev.filter((e) => e._id !== row._id));
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete employee");
    }
  };

  const createAdvance = async () => {
    const nextErr = {};
    if (!advanceForm.employeeId) nextErr.employeeId = "Employee is required";
    if (num(advanceForm.amount) <= 0) nextErr.amount = "Advance amount must be > 0";
    setAdvanceErrors(nextErr);
    if (Object.keys(nextErr).length) return;
    setAdvanceSaving(true);
    try {
      const payload = {
        ...advanceForm,
        date: advanceForm.date || new Date().toISOString().slice(0, 10),
        amount: num(advanceForm.amount),
      };
      if (advanceEditingId) {
        const res = await api.put(`/hr/advances/${advanceEditingId}`, payload);
        toast.success("Advance updated");
        setAdvances((prev) => prev.map((a) => (a._id === advanceEditingId ? res.data.data : a)));
        setAdvanceEditingId(null);
      } else {
        const res = await api.post("/hr/advances", payload);
        toast.success("Advance saved");
        setAdvances((prev) => [res.data.data, ...prev]);
      }
      setAdvanceForm({ ...emptyAdvance });
      setAdvanceErrors({});
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save advance");
    } finally {
      setAdvanceSaving(false);
    }
  };

  const deleteAdvance = async (row) => {
    if (!row?._id) return;
    // eslint-disable-next-line no-alert
    if (!confirm("Delete this advance permanently?")) return;
    try {
      await api.delete(`/hr/advances/${row._id}`);
      toast.success("Advance deleted");
      setAdvances((prev) => prev.filter((a) => a._id !== row._id));
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete advance");
    }
  };

  const printPayrollSlip = async (row) => {
    try {
      const s = await api.get("/settings");
      const data = s.data?.data || {};
      const general = data.general || data.generalSettings || data;
      const companyName = general.companyName || general.millName || "SMJ Rice Mill";
      const address = general.address || general.companyAddress || "";
      const phone = general.phone || general.companyPhone || "";
      const logoUrl = general.logoUrl || general.logo || "";

      const earnings = Array.isArray(row.earnings) && row.earnings.length
        ? row.earnings
        : makeDefaultEarnings(row.basicSalary).map((x) => ({ ...x, amount: num(x.amount) }));
      const deductionsItems = Array.isArray(row.deductionsItems) && row.deductionsItems.length
        ? row.deductionsItems
        : makeDefaultDeductions(row.advanceDeduction).map((x) => ({ ...x, amount: num(x.amount) }));

      const { totalEarnings, totalDeductions, netPay } = computeTotalsFromItems({ earnings, deductionsItems });
      const lastTwo = (payrolls || [])
        .filter((p) => String(p.employeeId) === String(row.employeeId) && p.status === "PAID")
        .sort((a, b) => new Date(b.paymentDate || b.createdAt || 0) - new Date(a.paymentDate || a.createdAt || 0))
        .filter((p) => String(p._id) !== String(row._id))
        .slice(0, 2);

      const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Payroll Slip</title>
  <style>
    @page { size: A4; margin: 14mm; }
    body { font-family: Arial, sans-serif; color: #0f172a; }
    .hdr { display:flex; gap:12px; align-items:center; border-bottom: 2px solid #10b981; padding-bottom:10px; }
    .logo { width:48px; height:48px; object-fit:contain; }
    h1 { font-size:16px; margin:0; }
    .muted { color:#475569; font-size:11px; margin-top:2px; }
    .box { border:1px solid #e2e8f0; border-radius:10px; padding:12px; margin-top:12px; }
    .row { display:flex; justify-content:space-between; gap:12px; font-size:12px; }
    .row + .row { margin-top:6px; }
    .grid2 { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
    .tbl { width:100%; border-collapse: collapse; font-size:12px; }
    .tbl th, .tbl td { border:1px solid #e2e8f0; padding:8px; text-align:left; }
    .tbl th { background:#f8fafc; }
    .tot { margin-top: 10px; display:flex; justify-content: space-between; font-size:12px; }
    .tot b { font-size: 13px; }
    .ft { margin-top:14px; border-top:1px solid #e2e8f0; padding-top:8px; font-size:11px; color:#475569; }
    .sig { margin-top: 18px; display:flex; justify-content: space-between; gap: 18px; }
    .sig .line { margin-top: 34px; border-top: 1px solid #0f172a; padding-top: 6px; font-size: 11px; color: #334155; }
  </style>
</head>
<body>
  <div class="hdr">
    ${logoUrl ? `<img class="logo" src="${logoUrl}" />` : ""}
    <div>
      <h1>${companyName}</h1>
      <div class="muted">${address ? address + " | " : ""}${phone ? phone : ""}</div>
    </div>
  </div>

  <div class="box">
    <div class="row"><div><b>Employee:</b> ${row.employeeName || "-"}</div><div><b>Month:</b> ${row.month || "-"} / ${row.year || "-"}</div></div>
    <div class="row"><div><b>Department:</b> ${row.department || "-"}</div><div><b>Status:</b> ${row.status || "-"}</div></div>
    <div class="row"><div><b>Payment Date:</b> ${row.paymentDate ? new Date(row.paymentDate).toLocaleDateString() : "-"}</div><div><b>Method:</b> ${row.paymentMethod || "-"}</div></div>
  </div>

  <div class="grid2">
    <div>
      <div style="font-weight:700; font-size:12px; margin-bottom:6px;">Earnings</div>
      <table class="tbl">
        <thead><tr><th>Title</th><th>Amount</th></tr></thead>
        <tbody>
          ${earnings
            .filter((x) => String(x.title || "").trim())
            .map((x) => `<tr><td>${String(x.title)}</td><td>${Math.round(Number(x.amount||0))}</td></tr>`)
            .join("")}
          <tr><td><b>Total Earnings</b></td><td><b>${Math.round(totalEarnings)}</b></td></tr>
        </tbody>
      </table>
    </div>
    <div>
      <div style="font-weight:700; font-size:12px; margin-bottom:6px;">Deductions</div>
      <table class="tbl">
        <thead><tr><th>Title</th><th>Amount</th></tr></thead>
        <tbody>
          ${deductionsItems
            .filter((x) => String(x.title || "").trim())
            .map((x) => `<tr><td>${String(x.title)}</td><td>${Math.round(Number(x.amount||0))}</td></tr>`)
            .join("")}
          <tr><td><b>Total Deductions</b></td><td><b>${Math.round(totalDeductions)}</b></td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="tot">
    <div><b>Net Pay</b></div>
    <div><b>${Math.round(netPay)}</b></div>
  </div>

  <div class="box">
    <div style="font-weight:700; font-size:12px; margin-bottom:6px;">Last 2 Months Paid</div>
    <table class="tbl">
      <thead><tr><th>Month</th><th>Paid Date</th><th>Net Pay</th></tr></thead>
      <tbody>
        ${
          lastTwo.length
            ? lastTwo
                .map((p) => `<tr><td>${p.month}/${p.year}</td><td>${p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : "-"}</td><td>${Math.round(Number(p.netPay ?? p.netSalary ?? 0))}</td></tr>`)
                .join("")
            : `<tr><td colspan="3">-</td></tr>`
        }
      </tbody>
    </table>
  </div>

  <div class="sig">
    <div style="flex:1;"><div class="line">Employer Signature</div></div>
    <div style="flex:1;"><div class="line">Employee Signature</div></div>
  </div>

  <div class="ft">
    This payroll slip is system generated.
  </div>
</body>
</html>`;

      const w = window.open("", "_blank");
      if (!w) {
        toast.error("Popup blocked. Allow popups to print.");
        return;
      }
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to print slip");
    }
  };

  const generatePayroll = async () => {
    const nextErr = {};
    if (!payrollForm.month || payrollForm.month < 1 || payrollForm.month > 12) nextErr.month = "Month must be 1..12";
    if (!payrollForm.year) nextErr.year = "Year is required";
    setPayrollErrors(nextErr);
    if (Object.keys(nextErr).length) return;
    setPayrollGenerating(true);
    try {
      const payload = { month: Number(payrollForm.month), year: Number(payrollForm.year) };
      const res = await api.post("/hr/payrolls/generate", payload);
      toast.success(`Generated ${res.data?.data?.createdCount || 0} payroll(s)`);
      setPayrollErrors({});
      const p = await api.get("/hr/payrolls", { params: payload });
      setPayrolls(p.data?.data || []);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to generate payroll");
    } finally {
      setPayrollGenerating(false);
    }
  };

  const generatePayrollForEmployee = async (emp) => {
    const nextErr = {};
    if (!payrollForm.month || payrollForm.month < 1 || payrollForm.month > 12) nextErr.month = "Month must be 1..12";
    if (!payrollForm.year) nextErr.year = "Year is required";
    setPayrollErrors(nextErr);
    if (Object.keys(nextErr).length) return;
    if (!emp?._id) return;

    setPayrollGenerating(true);
    try {
      const payload = { employeeId: String(emp._id), month: Number(payrollForm.month), year: Number(payrollForm.year) };
      const res = await api.post("/hr/payrolls/generate-one", payload);
      if (res.data?.created) toast.success("Payroll generated");
      else toast.success("Payroll already exists");
      const p = await api.get("/hr/payrolls", { params: { month: payload.month, year: payload.year } });
      setPayrolls(p.data?.data || []);
      return res.data?.data || null;
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to generate payroll");
      return null;
    } finally {
      setPayrollGenerating(false);
    }
  };

  const payPayroll = async () => {
    if (!payTarget?._id) return toast.error("Select a payroll row to pay");
    const nextErr = {};
    if ((payrollForm.earnings || []).some((x) => num(x.amount) < 0)) nextErr.earnings = "Earnings cannot be negative";
    if ((payrollForm.deductionsItems || []).some((x) => num(x.amount) < 0)) nextErr.deductionsItems = "Deductions cannot be negative";
    setPayrollErrors(nextErr);
    if (Object.keys(nextErr).length) return;
    setPayrollSaving(true);
    try {
      const payload = {
        earnings: (payrollForm.earnings || []).map((it) => ({
          key: String(it.key || "").trim(),
          title: String(it.title || "").trim(),
          amount: num(it.amount),
        })),
        deductionsItems: (payrollForm.deductionsItems || []).map((it) => ({
          key: String(it.key || "").trim(),
          title: String(it.title || "").trim(),
          amount: num(it.amount),
        })),
        paymentDate: payrollForm.paymentDate || new Date().toISOString().slice(0, 10),
        paymentMethod: payrollForm.paymentMethod || "CASH",
      };
      await api.post(`/hr/payrolls/${payTarget._id}/pay`, payload);
      toast.success("Salary paid");
      setPayTarget(null);
      setPayrollForm((p) => ({ ...p, earnings: [], deductionsItems: [], paymentDate: "" }));
      setPayrollErrors({});
      const pRes = await api.get("/hr/payrolls", { params: { month: payrollForm.month, year: payrollForm.year } });
      setPayrolls(pRes.data?.data || []);
      const a = await api.get("/hr/advances");
      setAdvances(a.data?.data || []);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to pay salary");
    } finally {
      setPayrollSaving(false);
    }
  };

  const employeeColumns = [
    { key: "employeeId", label: "Employee ID" },
    { key: "name", label: "Name" },
    { key: "department", label: "Department" },
    { key: "salaryType", label: "Salary Type" },
    {
      key: "basicSalary",
      label: "Basic Salary",
      render: (v) => Math.round(Number(v || 0)),
    },
    { key: "status", label: "Status" },
    {
      key: "actions",
      label: "Actions",
      skipExport: true,
      render: (_, row) => (
        <button
          type="button"
          className="p-1 rounded hover:bg-red-50"
          title="Delete"
          onClick={() => deleteEmployee(row)}
        >
          <Trash2 className="w-4 h-4 text-red-600" />
        </button>
      ),
    },
  ];

  const payrollColumns = [
    { key: "employeeName", label: "Employee" },
    { key: "month", label: "Month" },
    { key: "year", label: "Year" },
    { key: "totalEarnings", label: "Earnings", render: (v, row) => Math.round(Number(v ?? row.totalEarnings ?? 0)) },
    { key: "totalDeductions", label: "Deductions", render: (v, row) => Math.round(Number(v ?? row.totalDeductions ?? 0)) },
    { key: "netPay", label: "Net Pay", render: (v, row) => Math.round(Number(v ?? row.netPay ?? row.netSalary ?? 0)) },
    { key: "status", label: "Status" },
    {
      key: "paymentDate",
      label: "Payment Date",
      render: (v) => (v ? new Date(v).toLocaleDateString() : "-"),
    },
    { key: "paymentMethod", label: "Method" },
    {
      key: "actions",
      label: "Actions",
      skipExport: true,
      render: (_, row) => (
        <div className="flex items-center gap-2">
          {row.status === "DRAFT" ? (
            <button
              type="button"
              className="px-2 py-1 rounded border border-emerald-200 text-emerald-800 text-[11px] hover:bg-emerald-50 inline-flex items-center gap-1"
              onClick={() => {
                // Auto-fill advance deduction = total open remaining advances for this employee (user can change it).
                const advBal = (advances || [])
                  .filter((a) => String(a.employeeId) === String(row.employeeId) && a.status === "OPEN")
                  .reduce((s, a) => s + Number(a.remainingBalance || 0), 0);

                setPayTarget(row);
                setPayrollForm((p) => ({
                  ...p,
                  month: row.month,
                  year: row.year,
                  earnings: Array.isArray(row.earnings) && row.earnings.length
                    ? row.earnings.map((x) => ({ ...x, amount: x.amount === 0 ? "" : String(Math.round(Number(x.amount || 0))) }))
                    : makeDefaultEarnings(row.basicSalary),
                  deductionsItems: Array.isArray(row.deductionsItems) && row.deductionsItems.length
                    ? row.deductionsItems.map((x) => {
                        if (String(x.key) === "advance") {
                          const v = advBal ? Math.round(advBal) : Number(x.amount || 0);
                          return { ...x, amount: v ? String(v) : "" };
                        }
                        return { ...x, amount: x.amount === 0 ? "" : String(Math.round(Number(x.amount || 0))) };
                      })
                    : makeDefaultDeductions(advBal),
                  paymentDate: "",
                  paymentMethod: "CASH",
                }));
                setPayrollErrors({});
              }}
            >
              <CreditCard size={12} /> Pay
            </button>
          ) : (
            <span className="text-[11px] text-gray-400">Paid</span>
          )}

          <button
            type="button"
            className="p-1 rounded hover:bg-gray-50"
            title="Print payroll slip"
            onClick={() => printPayrollSlip(row)}
          >
            <Printer className="w-4 h-4 text-gray-700" />
          </button>

          {row.status === "DRAFT" && (
            <button
              type="button"
              className="p-1 rounded hover:bg-red-50"
              title="Delete payroll"
              onClick={async () => {
                // eslint-disable-next-line no-alert
                if (!confirm("Delete this DRAFT payroll?")) return;
                try {
                  await api.delete(`/hr/payrolls/${row._id}`);
                  toast.success("Payroll deleted");
                  setPayrolls((prev) => prev.filter((p) => p._id !== row._id));
                } catch (err) {
                  toast.error(err?.response?.data?.message || "Failed to delete payroll");
                }
              }}
            >
              <Trash2 className="w-4 h-4 text-red-600" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const advanceMiniRows = (employeeId) =>
    (advances || [])
      .filter((a) => String(a.employeeId) === String(employeeId))
      .sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0))
      .slice(0, 5);


  return (
    <div className="space-y-4">
      <div className="border-b border-emerald-200 mb-2">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const isActive = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm rounded-t-lg border-b-2 transition whitespace-nowrap
                  ${
                    isActive
                      ? "bg-emerald-50 text-emerald-700 font-semibold border-emerald-600"
                      : "text-gray-500 border-transparent hover:text-emerald-600 hover:bg-emerald-50"
                  }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "employees" && (
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-4 space-y-3">
            <div className="text-sm font-semibold text-emerald-800">Add Employee</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-gray-600">Employee Name *</label>
                {(() => {
                  const st = getEmployeeFieldState("name", employeeForm.name);
                  const showOk = st.ok;
                  const showErr = employeeSubmitted && !!st.error;
                  const cls = showErr
                    ? "border-red-400 bg-red-50"
                    : showOk
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-gray-300";
                  return (
                    <>
                      <input
                        className={`w-full border rounded p-2 text-sm ${cls}`}
                        value={employeeForm.name}
                        onChange={(e) => {
                          const v = normalizeName(e.target.value);
                          setEmployeeForm((p) => ({ ...p, name: v }));
                          if (employeeSubmitted) {
                            setEmployeeErrors((p) => ({
                              ...p,
                              name: getEmployeeFieldState("name", v).error || "",
                            }));
                          }
                        }}
                        onBlur={() => {
                          const v = toTitleCaseName(employeeForm.name);
                          if (v !== employeeForm.name) setEmployeeForm((p) => ({ ...p, name: v }));
                        }}
                      />
                      <div className="min-h-[14px] text-[11px] text-red-600">
                        {showErr ? employeeErrors.name || st.error : ""}
                      </div>
                    </>
                  );
                })()}
              </div>
              <div>
                <label className="text-xs text-gray-600">Father Name *</label>
                {(() => {
                  const st = getEmployeeFieldState("fatherName", employeeForm.fatherName);
                  const showOk = st.ok;
                  const showErr = employeeSubmitted && !!st.error;
                  const cls = showErr
                    ? "border-red-400 bg-red-50"
                    : showOk
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-gray-300";
                  return (
                    <>
                      <input
                        className={`w-full border rounded p-2 text-sm ${cls}`}
                        value={employeeForm.fatherName}
                        onChange={(e) => {
                          const v = normalizeName(e.target.value);
                          setEmployeeForm((p) => ({ ...p, fatherName: v }));
                          if (employeeSubmitted) {
                            setEmployeeErrors((p) => ({
                              ...p,
                              fatherName: getEmployeeFieldState("fatherName", v).error || "",
                            }));
                          }
                        }}
                        onBlur={() => {
                          const v = toTitleCaseName(employeeForm.fatherName);
                          if (v !== employeeForm.fatherName) setEmployeeForm((p) => ({ ...p, fatherName: v }));
                        }}
                      />
                      <div className="min-h-[14px] text-[11px] text-red-600">
                        {showErr ? employeeErrors.fatherName || st.error : ""}
                      </div>
                    </>
                  );
                })()}
              </div>
              <div>
                <label className="text-xs text-gray-600">CNIC *</label>
                {(() => {
                  const st = getEmployeeFieldState("cnic", employeeForm.cnic);
                  const showOk = st.ok;
                  const showErr = employeeSubmitted && !!st.error;
                  const cls = showErr
                    ? "border-red-400 bg-red-50"
                    : showOk
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-gray-300";
                  return (
                    <>
                      <input
                        className={`w-full border rounded p-2 text-sm ${cls}`}
                        value={employeeForm.cnic}
                        onChange={(e) => {
                          const v = normalizeCNIC(e.target.value);
                          setEmployeeForm((p) => ({ ...p, cnic: v }));
                          if (employeeSubmitted) {
                            setEmployeeErrors((p) => ({
                              ...p,
                              cnic: getEmployeeFieldState("cnic", v).error || "",
                            }));
                          }
                        }}
                        placeholder="12345-1234567-1"
                        maxLength={15}
                      />
                      <div className="min-h-[14px] text-[11px] text-red-600">
                        {showErr ? employeeErrors.cnic || st.error : ""}
                      </div>
                    </>
                  );
                })()}
              </div>
              <div>
                <label className="text-xs text-gray-600">Phone *</label>
                {(() => {
                  const st = getEmployeeFieldState("phone", employeeForm.phone);
                  const showOk = st.ok;
                  const showErr = employeeSubmitted && !!st.error;
                  const cls = showErr
                    ? "border-red-400 bg-red-50"
                    : showOk
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-gray-300";
                  return (
                    <>
                      <input
                        className={`w-full border rounded p-2 text-sm ${cls}`}
                        value={employeeForm.phone}
                        onChange={(e) => {
                          const v = normalizePhone(e.target.value);
                          setEmployeeForm((p) => ({ ...p, phone: v }));
                          if (employeeSubmitted) {
                            setEmployeeErrors((p) => ({
                              ...p,
                              phone: getEmployeeFieldState("phone", v).error || "",
                            }));
                          }
                        }}
                        placeholder="03XX-XXXXXXX"
                        maxLength={12}
                      />
                      <div className="min-h-[14px] text-[11px] text-red-600">
                        {showErr ? employeeErrors.phone || st.error : ""}
                      </div>
                    </>
                  );
                })()}
              </div>
              <div>
                <label className="text-xs text-gray-600">Department *</label>
                {(() => {
                  const st = getEmployeeFieldState("department", employeeForm.department);
                  const showOk = st.ok;
                  const showErr = employeeSubmitted && !!st.error;
                  const cls = showErr
                    ? "border-red-400 bg-red-50"
                    : showOk
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-gray-300";

                  const displayValue =
                    employeeForm.department === OTHER_OPTION
                      ? customDepartment
                      : String(employeeForm.department || "");
                  const isTypingOther = employeeForm.department === OTHER_OPTION;

                  return (
                    <>
                      <div className="relative">
                        <div className="flex gap-2 items-center">
                          <input
                            className={`w-full border rounded p-2 text-sm ${cls}`}
                            value={displayValue}
                            readOnly={!isTypingOther}
                            onChange={(e) => {
                              if (!isTypingOther) return;
                              const v = normalizeName(e.target.value).slice(0, 80);
                              setCustomDepartment(v);
                              if (employeeSubmitted) {
                                setEmployeeErrors((p) => ({
                                  ...p,
                                  department:
                                    getEmployeeFieldState("department", employeeForm.department).error ||
                                    "",
                                }));
                              }
                            }}
                            placeholder={isTypingOther ? "Type department name" : "Select department"}
                            onFocus={() => {
                              // In list mode, focusing should not allow typing; keep list closed unless user clicks list button.
                              if (!isTypingOther) setDeptOpen(false);
                            }}
                          />
                          <button
                            type="button"
                            className="shrink-0 px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs text-gray-700 hover:bg-gray-50"
                            onClick={() => setDeptOpen((v) => !v)}
                            title="Show departments list"
                          >
                            List
                          </button>
                        </div>

                        {deptOpen && (
                          <div className="absolute z-20 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                            <button
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                              onClick={() => {
                                setEmployeeForm((p) => ({ ...p, department: "" }));
                                setCustomDepartment("");
                                setDeptOpen(false);
                              }}
                            >
                              Select...
                            </button>
                            {(meta.departments || []).map((d) => (
                              <button
                                key={d}
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                                onClick={() => {
                                  setEmployeeForm((p) => ({ ...p, department: d }));
                                  setCustomDepartment("");
                                  setDeptOpen(false);
                                  if (employeeSubmitted) {
                                    setEmployeeErrors((p) => ({
                                      ...p,
                                      department: getEmployeeFieldState("department", d).error || "",
                                    }));
                                  }
                                }}
                              >
                                {d}
                              </button>
                            ))}
                            <div className="h-px bg-gray-100" />
                            <button
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                              onClick={() => {
                                setEmployeeForm((p) => ({ ...p, department: OTHER_OPTION }));
                                setCustomDepartment("");
                                setDeptOpen(false);
                                if (employeeSubmitted) {
                                  setEmployeeErrors((p) => ({
                                    ...p,
                                    department:
                                      getEmployeeFieldState("department", OTHER_OPTION).error || "",
                                  }));
                                }
                              }}
                            >
                              Other...
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="min-h-[14px] text-[11px] text-red-600">
                        {showErr ? employeeErrors.department || st.error : ""}
                      </div>
                    </>
                  );
                })()}
              </div>
              <div>
                <label className="text-xs text-gray-600">Joining Date *</label>
                {(() => {
                  const st = getEmployeeFieldState("joiningDate", employeeForm.joiningDate);
                  const showOk = st.ok;
                  const showErr = employeeSubmitted && !!st.error;
                  const cls = showErr
                    ? "border-red-400 bg-red-50"
                    : showOk
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-gray-300";
                  return (
                    <>
                      <input
                        type="date"
                        className={`w-full border rounded p-2 text-sm ${cls}`}
                        value={employeeForm.joiningDate}
                        onChange={(e) => {
                          setEmployeeForm((p) => ({ ...p, joiningDate: e.target.value }));
                          if (employeeSubmitted) {
                            setEmployeeErrors((p) => ({
                              ...p,
                              joiningDate:
                                getEmployeeFieldState("joiningDate", e.target.value).error || "",
                            }));
                          }
                        }}
                      />
                      <div className="min-h-[14px] text-[11px] text-red-600">
                        {showErr ? employeeErrors.joiningDate || st.error : ""}
                      </div>
                    </>
                  );
                })()}
              </div>
              <div>
                <label className="text-xs text-gray-600">Salary Type *</label>
                <select className="w-full border rounded p-2 text-sm" value={employeeForm.salaryType} onChange={(e) => setEmployeeForm((p) => ({ ...p, salaryType: e.target.value }))}>
                  <option value="MONTHLY">Monthly</option>
                  <option value="DAILY">Daily</option>
                  <option value="PER_BAG">Per Bag</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600">Basic Salary *</label>
                {(() => {
                  const st = getEmployeeFieldState("basicSalary", employeeForm.basicSalary);
                  const showOk = st.ok;
                  const showErr = employeeSubmitted && !!st.error;
                  const cls = showErr
                    ? "border-red-400 bg-red-50"
                    : showOk
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-gray-300";
                  return (
                    <>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={10}
                        className={`w-full border rounded p-2 text-sm ${cls}`}
                        value={employeeForm.basicSalary}
                        onChange={(e) => {
                          const v = normalizeSalaryDigits(e.target.value);
                          setEmployeeForm((p) => ({ ...p, basicSalary: v }));
                          if (employeeSubmitted) {
                            setEmployeeErrors((p) => ({ ...p, basicSalary: getEmployeeFieldState("basicSalary", v).error || "" }));
                          }
                        }}
                      />
                      <div className="min-h-[14px] text-[11px] text-red-600">
                        {showErr ? employeeErrors.basicSalary || st.error : ""}
                      </div>
                    </>
                  );
                })()}
              </div>
              <div>
                <label className="text-xs text-gray-600">Status *</label>
                <select className="w-full border rounded p-2 text-sm" value={employeeForm.status} onChange={(e) => setEmployeeForm((p) => ({ ...p, status: e.target.value }))}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-600">Address *</label>
                {(() => {
                  const st = getEmployeeFieldState("address", employeeForm.address);
                  const showOk = st.ok;
                  const showErr = employeeSubmitted && !!st.error;
                  const cls = showErr
                    ? "border-red-400 bg-red-50"
                    : showOk
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-gray-300";
                  return (
                    <>
                      <input
                        className={`w-full border rounded p-2 text-sm ${cls}`}
                        value={employeeForm.address}
                        onChange={(e) => {
                          const v = String(e.target.value || "").slice(0, 200);
                          setEmployeeForm((p) => ({ ...p, address: v }));
                          if (employeeSubmitted) {
                            setEmployeeErrors((p) => ({
                              ...p,
                              address: getEmployeeFieldState("address", v).error || "",
                            }));
                          }
                        }}
                      />
                      <div className="min-h-[14px] text-[11px] text-red-600">
                        {showErr ? employeeErrors.address || st.error : ""}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={createEmployee}
                disabled={employeeSaving}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs hover:bg-emerald-700 disabled:opacity-60"
              >
                <Save size={14} /> {employeeSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-4">
            <DataTable
              title="Employees"
              columns={employeeColumns}
              data={employees}
              idKey="_id"
              emptyMessage="No employees"
            />
          </div>
        </div>
      )}

      {activeTab === "advances" && (
        <div />
      )}

      {activeTab === "payroll" && (
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-emerald-800">Payroll</div>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-600">Month *</label>
                  <select
                    className={`w-full border rounded p-2 text-sm ${payrollErrors.month ? "border-red-400 bg-red-50" : "border-gray-300"}`}
                    value={payrollForm.month}
                    onChange={(e) => {
                      setPayrollForm((p) => ({ ...p, month: Number(e.target.value) }));
                      setPayrollErrors((p) => ({ ...p, month: "" }));
                    }}
                  >
                    {MONTHS.map((m, idx) => (
                      <option key={m} value={idx + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <div className="min-h-[14px] text-[11px] text-red-600">{payrollErrors.month || ""}</div>
                </div>
                <div>
                  <label className="text-xs text-gray-600">Year *</label>
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    className={`w-full border rounded p-2 text-sm ${payrollErrors.year ? "border-red-400 bg-red-50" : "border-gray-300"}`}
                    value={payrollForm.year}
                    onChange={(e) => {
                      setPayrollForm((p) => ({ ...p, year: Number(e.target.value) }));
                      setPayrollErrors((p) => ({ ...p, year: "" }));
                    }}
                  />
                  <div className="min-h-[14px] text-[11px] text-red-600">{payrollErrors.year || ""}</div>
                </div>
              </div>
            </div>

            <div className="border-t pt-3">
              <div className="text-xs font-semibold text-gray-700 mb-2">Employees</div>
              <div className="border rounded-xl overflow-hidden">
                {(employees || [])
                  .filter((e) => e.status === "ACTIVE")
                  .map((emp) => {
                    const p = (payrolls || []).find(
                      (x) =>
                        String(x.employeeId) === String(emp._id) &&
                        Number(x.month) === Number(payrollForm.month) &&
                        Number(x.year) === Number(payrollForm.year)
                    );
                    const openAdvance = Math.round(
                      (advances || [])
                        .filter((a) => String(a.employeeId) === String(emp._id) && a.status === "OPEN")
                        .reduce((s, a) => s + Number(a.remainingBalance || 0), 0)
                    );
                    const expanded = String(expandedEmployeeId) === String(emp._id);

                    const statusEl = !p ? (
                      <span className="text-[11px] text-gray-500">Not generated</span>
                    ) : p.status === "PAID" ? (
                      <span className="text-[11px] text-emerald-700 font-semibold">Paid</span>
                    ) : (
                      <span className="text-[11px] text-amber-700 font-semibold">Generated</span>
                    );

                    return (
                      <div key={emp._id} className="border-b last:border-b-0">
                        <div className="p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-gray-900 truncate">
                              {emp.name}{" "}
                              <span className="text-xs font-normal text-gray-500">({emp.employeeId || "-"})</span>
                            </div>
                            <div className="text-xs text-gray-600 truncate">{emp.department || "-"}</div>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-700">
                            <div>
                              <div className="text-[10px] text-gray-500">Basic</div>
                              <div className="font-semibold">{Math.round(Number(emp.basicSalary || 0))}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-gray-500">Open Advance</div>
                              <div className="font-semibold">{openAdvance}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-gray-500">Payroll</div>
                              <div>{statusEl}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 sm:justify-end">
                            <button
                              type="button"
                              className="px-2 py-1 rounded border border-gray-200 text-gray-800 text-[11px] hover:bg-gray-50 inline-flex items-center gap-1"
                              onClick={() => {
                                setExpandedEmployeeId(expanded ? null : emp._id);
                                setPayTarget(p || null);
                                const advBal = openAdvance;
                                setAdvanceEditingId(null);
                                setAdvanceErrors({});
                                setAdvanceForm({
                                  ...emptyAdvance,
                                  employeeId: String(emp._id),
                                  date: new Date().toISOString().slice(0, 10),
                                  paymentMethod: "CASH",
                                });

                                if (p) {
                                  setPayrollForm((prev) => ({
                                    ...prev,
                                    month: p.month,
                                    year: p.year,
                                    earnings:
                                      Array.isArray(p.earnings) && p.earnings.length
                                        ? p.earnings.map((x) => ({
                                            ...x,
                                            amount:
                                              x.amount === 0 ? "" : String(Math.round(Number(x.amount || 0))),
                                          }))
                                        : makeDefaultEarnings(p.basicSalary),
                                    deductionsItems:
                                      Array.isArray(p.deductionsItems) && p.deductionsItems.length
                                        ? p.deductionsItems.map((x) => {
                                            if (String(x.key) === "advance") {
                                              const v = advBal ? Math.round(advBal) : Number(x.amount || 0);
                                              return { ...x, amount: v ? String(v) : "" };
                                            }
                                            return {
                                              ...x,
                                              amount:
                                                x.amount === 0 ? "" : String(Math.round(Number(x.amount || 0))),
                                            };
                                          })
                                        : makeDefaultDeductions(advBal),
                                    paymentDate: "",
                                    paymentMethod: "CASH",
                                  }));
                                } else {
                                  // Pre-fill UI so user can edit before generating payroll.
                                  setPayrollForm((prev) => ({
                                    ...prev,
                                    earnings: makeDefaultEarnings(emp.basicSalary),
                                    deductionsItems: makeDefaultDeductions(advBal),
                                    paymentDate: "",
                                    paymentMethod: "CASH",
                                  }));
                                }
                              }}
                            >
                              <Edit2 size={12} /> Details
                            </button>

                            {p && (
                              <button
                                type="button"
                                className="p-1 rounded hover:bg-gray-50"
                                title="Print payslip"
                                onClick={() => printPayrollSlip(p)}
                              >
                                <Printer className="w-4 h-4 text-gray-700" />
                              </button>
                            )}
                          </div>
                        </div>

                        {expanded && (
                          <div className="px-3 pb-3">
                            <div className="mt-2 border-t pt-3 space-y-2">
                              {!p && (
                                <div className="flex items-center justify-between">
                                  <div className="text-xs text-gray-600">
                                    Payroll not generated for this month/year.
                                  </div>
                                  <button
                                    type="button"
                                    className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs hover:bg-emerald-700 disabled:opacity-60 inline-flex items-center gap-2"
                                    disabled={payrollGenerating}
                                    onClick={async () => {
                                      const created = await generatePayrollForEmployee(emp);
                                      if (!created?._id) return;
                                      setPayTarget(created);
                                      setPayrolls((prev) => {
                                        const exists = prev.some((x) => String(x._id) === String(created._id));
                                        return exists ? prev : [created, ...prev];
                                      });
                                    }}
                                  >
                                    <Wand2 size={14} /> {payrollGenerating ? "Generating..." : "Generate Payroll"}
                                  </button>
                                </div>
                              )}

                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                <div className="border rounded-xl p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="text-xs font-semibold text-gray-700">Earnings</div>
                                    <button
                                      type="button"
                                      className="px-2 py-1 rounded border border-gray-200 text-[11px] hover:bg-gray-50"
                                      onClick={() => setPayrollForm((pp) => ({ ...pp, earnings: [...(pp.earnings || []), { key: "", title: "", amount: "" }] }))}
                                    >
                                      + Add
                                    </button>
                                  </div>
                                  <div className="space-y-2">
                                    {(payrollForm.earnings || []).map((it, idx) => (
                                      <div key={`e-${idx}`} className="grid grid-cols-12 gap-2 items-center">
                                        <div className="col-span-7">
                                          <select
                                            className="w-full border rounded px-2 py-1 text-xs"
                                            value={EARNINGS_PRESETS.includes(it.title) ? it.title : it.title ? NEW_OPT : ""}
                                            onChange={(e) => {
                                              const v = e.target.value;
                                              setPayrollForm((pp) => {
                                                const next = [...(pp.earnings || [])];
                                                if (v === NEW_OPT) next[idx] = { ...next[idx], title: "" };
                                                else next[idx] = { ...next[idx], title: v };
                                                return { ...pp, earnings: next };
                                              });
                                            }}
                                          >
                                            <option value="">Select</option>
                                            {EARNINGS_PRESETS.map((t) => (
                                              <option key={t} value={t}>{t}</option>
                                            ))}
                                            <option value={NEW_OPT}>Add new...</option>
                                          </select>
                                          {(!EARNINGS_PRESETS.includes(it.title) || it.title === "") && (
                                            <input
                                              className="mt-1 w-full border rounded px-2 py-1 text-xs"
                                              placeholder="Title"
                                              value={it.title}
                                              onChange={(e) => {
                                                const v = String(e.target.value || "").slice(0, 40);
                                                setPayrollForm((pp) => {
                                                  const next = [...(pp.earnings || [])];
                                                  next[idx] = { ...next[idx], title: v };
                                                  return { ...pp, earnings: next };
                                                });
                                              }}
                                            />
                                          )}
                                        </div>
                                        <div className="col-span-4">
                                          <input
                                            type="number"
                                            min="0"
                                            className="w-full border rounded px-2 py-1 text-xs"
                                            value={it.amount}
                                            onChange={(e) => {
                                              const v = e.target.value;
                                              setPayrollForm((pp) => {
                                                const next = [...(pp.earnings || [])];
                                                next[idx] = { ...next[idx], amount: v };
                                                return { ...pp, earnings: next };
                                              });
                                            }}
                                          />
                                        </div>
                                        <div className="col-span-1 flex justify-end">
                                          <button type="button" className="p-1 rounded hover:bg-red-50" onClick={() => setPayrollForm((pp) => ({ ...pp, earnings: (pp.earnings || []).filter((_, i) => i !== idx) }))}>
                                            <Trash2 className="w-4 h-4 text-red-600" />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="border rounded-xl p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="text-xs font-semibold text-gray-700">Deductions</div>
                                    <button
                                      type="button"
                                      className="px-2 py-1 rounded border border-gray-200 text-[11px] hover:bg-gray-50"
                                      onClick={() => setPayrollForm((pp) => ({ ...pp, deductionsItems: [...(pp.deductionsItems || []), { key: "", title: "", amount: "" }] }))}
                                    >
                                      + Add
                                    </button>
                                  </div>
                                  <div className="space-y-2">
                                    {(payrollForm.deductionsItems || []).map((it, idx) => (
                                      <div key={`d-${idx}`} className="grid grid-cols-12 gap-2 items-center">
                                        <div className="col-span-7">
                                          <select
                                            className="w-full border rounded px-2 py-1 text-xs"
                                            value={DEDUCTION_PRESETS.includes(it.title) ? it.title : it.title ? NEW_OPT : ""}
                                            onChange={(e) => {
                                              const v = e.target.value;
                                              setPayrollForm((pp) => {
                                                const next = [...(pp.deductionsItems || [])];
                                                if (v === NEW_OPT) next[idx] = { ...next[idx], title: "" };
                                                else next[idx] = { ...next[idx], title: v, key: v === "Advance / Loan" ? "advance" : next[idx].key };
                                                return { ...pp, deductionsItems: next };
                                              });
                                            }}
                                          >
                                            <option value="">Select</option>
                                            {DEDUCTION_PRESETS.map((t) => (
                                              <option key={t} value={t}>{t}</option>
                                            ))}
                                            <option value={NEW_OPT}>Add new...</option>
                                          </select>
                                          {(!DEDUCTION_PRESETS.includes(it.title) || it.title === "") && (
                                            <input
                                              className="mt-1 w-full border rounded px-2 py-1 text-xs"
                                              placeholder="Title"
                                              value={it.title}
                                              onChange={(e) => {
                                                const v = String(e.target.value || "").slice(0, 40);
                                                setPayrollForm((pp) => {
                                                  const next = [...(pp.deductionsItems || [])];
                                                  next[idx] = { ...next[idx], title: v };
                                                  return { ...pp, deductionsItems: next };
                                                });
                                              }}
                                            />
                                          )}
                                        </div>
                                        <div className="col-span-4">
                                          <input
                                            type="number"
                                            min="0"
                                            className="w-full border rounded px-2 py-1 text-xs"
                                            value={it.amount}
                                            onChange={(e) => {
                                              const v = e.target.value;
                                              setPayrollForm((pp) => {
                                                const next = [...(pp.deductionsItems || [])];
                                                next[idx] = { ...next[idx], amount: v };
                                                return { ...pp, deductionsItems: next };
                                              });
                                            }}
                                          />
                                        </div>
                                        <div className="col-span-1 flex justify-end">
                                          <button type="button" className="p-1 rounded hover:bg-red-50" onClick={() => setPayrollForm((pp) => ({ ...pp, deductionsItems: (pp.deductionsItems || []).filter((_, i) => i !== idx) }))}>
                                            <Trash2 className="w-4 h-4 text-red-600" />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <div className="border rounded-xl p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="text-xs font-semibold text-gray-700">Advance (Optional)</div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                                  <div>
                                    <label className="text-[11px] text-gray-600">Date</label>
                                    <input
                                      type="date"
                                      className="w-full border rounded px-2 py-1 text-xs"
                                      value={advanceForm.date}
                                      onChange={(e) => setAdvanceForm((pp) => ({ ...pp, date: e.target.value }))}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[11px] text-gray-600">Amount</label>
                                    <input
                                      type="number"
                                      min="0"
                                      className={`w-full border rounded px-2 py-1 text-xs ${advanceErrors.amount ? "border-red-400 bg-red-50" : ""}`}
                                      value={advanceForm.amount}
                                      onChange={(e) => {
                                        setAdvanceForm((pp) => ({ ...pp, amount: e.target.value }));
                                        setAdvanceErrors((pp) => ({ ...pp, amount: "" }));
                                      }}
                                    />
                                    <div className="min-h-[14px] text-[11px] text-red-600">{advanceErrors.amount || ""}</div>
                                  </div>
                                  <div>
                                    <label className="text-[11px] text-gray-600">Method</label>
                                    <select
                                      className="w-full border rounded px-2 py-1 text-xs"
                                      value={advanceForm.paymentMethod}
                                      onChange={(e) => setAdvanceForm((pp) => ({ ...pp, paymentMethod: e.target.value }))}
                                    >
                                      <option value="CASH">Cash</option>
                                      <option value="BANK">Bank</option>
                                    </select>
                                  </div>
                                  <div className="flex items-end">
                                    <button
                                      type="button"
                                      onClick={createAdvance}
                                      disabled={advanceSaving}
                                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs hover:bg-emerald-700 disabled:opacity-60"
                                    >
                                      <Save size={14} /> {advanceSaving ? "Saving..." : "Add Advance"}
                                    </button>
                                  </div>
                                </div>
                                <div className="mt-2">
                                  <label className="text-[11px] text-gray-600">Note</label>
                                  <input
                                    className="w-full border rounded px-2 py-1 text-xs"
                                    value={advanceForm.note}
                                    onChange={(e) => setAdvanceForm((pp) => ({ ...pp, note: e.target.value }))}
                                  />
                                </div>

                                <div className="mt-3">
                                  <div className="text-[11px] text-gray-600 mb-1">Recent advances</div>
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full text-xs">
                                      <thead>
                                        <tr className="text-gray-600">
                                          <th className="text-left py-1 pr-2">Date</th>
                                          <th className="text-left py-1 pr-2">Amount</th>
                                          <th className="text-left py-1 pr-2">Remaining</th>
                                          <th className="text-left py-1 pr-2">Status</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {advanceMiniRows(emp._id).length ? (
                                          advanceMiniRows(emp._id).map((a) => (
                                            <tr key={a._id} className="border-t">
                                              <td className="py-1 pr-2">{a.date ? new Date(a.date).toLocaleDateString() : "-"}</td>
                                              <td className="py-1 pr-2">{Math.round(Number(a.amount || 0))}</td>
                                              <td className="py-1 pr-2">{Math.round(Number(a.remainingBalance || 0))}</td>
                                              <td className="py-1 pr-2">{a.status || "-"}</td>
                                            </tr>
                                          ))
                                        ) : (
                                          <tr className="border-t">
                                            <td className="py-2 text-gray-500" colSpan={4}>-</td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-xs text-gray-600">Payment Date</label>
                                  <input type="date" className="w-full border rounded p-2 text-sm" value={payrollForm.paymentDate} onChange={(e) => setPayrollForm((pp) => ({ ...pp, paymentDate: e.target.value }))} />
                                </div>
                                <div>
                                  <label className="text-xs text-gray-600">Method</label>
                                  <select className="w-full border rounded p-2 text-sm" value={payrollForm.paymentMethod} onChange={(e) => setPayrollForm((pp) => ({ ...pp, paymentMethod: e.target.value }))}>
                                    <option value="CASH">Cash</option>
                                    <option value="BANK">Bank</option>
                                  </select>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-gray-600">
                                  Net Pay: <span className="font-semibold text-gray-900">{Math.round(computeTotalsFromItems({ earnings: payrollForm.earnings || [], deductionsItems: payrollForm.deductionsItems || [] }).netPay)}</span>
                                </div>
                                <button type="button" onClick={payPayroll} disabled={payrollSaving || !p || (p.status === "PAID")} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-700 text-white text-xs hover:bg-emerald-800 disabled:opacity-60">
                                  <Save size={14} /> {!p ? "Generate first" : p.status === "PAID" ? "Paid" : payrollSaving ? "Paying..." : "Pay Now"}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* HR reports moved to Reports module */}
    </div>
  );
}
