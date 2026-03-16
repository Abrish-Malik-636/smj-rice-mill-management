import React, { useEffect, useMemo, useState } from "react";
import { Save, Trash2, Wand2, CreditCard } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../services/api";
import DataTable from "../components/ui/DataTable";

const TABS = [
  { key: "advances", label: "Advances" },
  { key: "payroll", label: "Payroll" },
  { key: "employees", label: "Employees" },
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
  basicSalary: "",
  overtime: "",
  bonus: "",
  allowances: "",
  deductions: "",
  advanceDeduction: "",
  paymentDate: "",
  paymentMethod: "CASH",
};

const num = (v) => (v === "" || v == null ? 0 : Number(v || 0) || 0);
const round2 = (n) => Number((Number(n || 0)).toFixed(2));

function computeNet(p) {
  const net =
    num(p.basicSalary) +
    num(p.overtime) +
    num(p.bonus) +
    num(p.allowances) -
    num(p.deductions) -
    num(p.advanceDeduction);
  return Math.max(0, round2(net));
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

  const [payrollForm, setPayrollForm] = useState({ ...emptyPayroll });
  const [payrollSaving, setPayrollSaving] = useState(false);
  const [payrollErrors, setPayrollErrors] = useState({});
  const [payrollGenerating, setPayrollGenerating] = useState(false);
  const [payTarget, setPayTarget] = useState(null);

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
      const res = await api.post("/hr/advances", payload);
      toast.success("Advance saved");
      setAdvanceForm({ ...emptyAdvance });
      setAdvanceErrors({});
      setAdvances((prev) => [res.data.data, ...prev]);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save advance");
    } finally {
      setAdvanceSaving(false);
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

  const payPayroll = async () => {
    if (!payTarget?._id) return toast.error("Select a payroll row to pay");
    const nextErr = {};
    if (num(payrollForm.advanceDeduction) < 0) nextErr.advanceDeduction = "Cannot be negative";
    setPayrollErrors(nextErr);
    if (Object.keys(nextErr).length) return;
    setPayrollSaving(true);
    try {
      const payload = {
        overtime: num(payrollForm.overtime),
        bonus: num(payrollForm.bonus),
        allowances: num(payrollForm.allowances),
        deductions: num(payrollForm.deductions),
        advanceDeduction: num(payrollForm.advanceDeduction),
        paymentDate: payrollForm.paymentDate || new Date().toISOString().slice(0, 10),
        paymentMethod: payrollForm.paymentMethod || "CASH",
      };
      await api.post(`/hr/payrolls/${payTarget._id}/pay`, payload);
      toast.success("Salary paid");
      setPayTarget(null);
      setPayrollForm((p) => ({ ...p, overtime: "", bonus: "", allowances: "", deductions: "", advanceDeduction: "", paymentDate: "" }));
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
    { key: "basicSalary", label: "Basic", render: (v) => Math.round(Number(v || 0)) },
    { key: "advanceDeduction", label: "Advance Ded.", render: (v) => Math.round(Number(v || 0)) },
    { key: "netSalary", label: "Net", render: (v) => Math.round(Number(v || 0)) },
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
      render: (_, row) =>
        row.status === "DRAFT" ? (
          <button
            type="button"
            className="px-2 py-1 rounded border border-emerald-200 text-emerald-800 text-[11px] hover:bg-emerald-50 inline-flex items-center gap-1"
            onClick={() => {
              setPayTarget(row);
              setPayrollForm((p) => ({
                ...p,
                month: row.month,
                year: row.year,
                basicSalary: String(row.basicSalary ?? ""),
                overtime: "",
                bonus: "",
                allowances: "",
                deductions: "",
                advanceDeduction: "",
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
        ),
    },
  ];

  const advanceColumns = [
    { key: "employeeName", label: "Employee" },
    { key: "date", label: "Date", render: (v) => (v ? new Date(v).toLocaleDateString() : "-") },
    { key: "amount", label: "Advance", render: (v) => Math.round(Number(v || 0)) },
    { key: "remainingBalance", label: "Remaining", render: (v) => Math.round(Number(v || 0)) },
    { key: "status", label: "Status" },
    { key: "paymentMethod", label: "Method" },
  ];


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
                className={`px-3 sm:px-4 py-2 text-xs sm:text-sm rounded-t-lg border-b-2 transition whitespace-nowrap
                  ${
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
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-4 space-y-3">
            <div className="text-sm font-semibold text-emerald-800">Add Advance</div>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-gray-600">Employee *</label>
                <select
                  className={`w-full border rounded p-2 text-sm ${advanceErrors.employeeId ? "border-red-400 bg-red-50" : "border-gray-300"}`}
                  value={advanceForm.employeeId}
                  onChange={(e) => {
                    setAdvanceForm((p) => ({ ...p, employeeId: e.target.value }));
                    setAdvanceErrors((p) => ({ ...p, employeeId: "" }));
                  }}
                >
                  <option value="">Select</option>
                  {employeeOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <div className="min-h-[14px] text-[11px] text-red-600">{advanceErrors.employeeId || ""}</div>
              </div>
              <div>
                <label className="text-xs text-gray-600">Date</label>
                <input type="date" className="w-full border rounded p-2 text-sm" value={advanceForm.date} onChange={(e) => setAdvanceForm((p) => ({ ...p, date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-600">Amount *</label>
                <input
                  type="number"
                  min="0"
                  className={`w-full border rounded p-2 text-sm ${advanceErrors.amount ? "border-red-400 bg-red-50" : "border-gray-300"}`}
                  value={advanceForm.amount}
                  onChange={(e) => {
                    setAdvanceForm((p) => ({ ...p, amount: e.target.value }));
                    setAdvanceErrors((p) => ({ ...p, amount: "" }));
                  }}
                />
                <div className="min-h-[14px] text-[11px] text-red-600">{advanceErrors.amount || ""}</div>
              </div>
              <div>
                <label className="text-xs text-gray-600">Payment Method</label>
                <select className="w-full border rounded p-2 text-sm" value={advanceForm.paymentMethod} onChange={(e) => setAdvanceForm((p) => ({ ...p, paymentMethod: e.target.value }))}>
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bank</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600">Note</label>
                <input className="w-full border rounded p-2 text-sm" value={advanceForm.note} onChange={(e) => setAdvanceForm((p) => ({ ...p, note: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={createAdvance}
                disabled={advanceSaving}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs hover:bg-emerald-700 disabled:opacity-60"
              >
                <Save size={14} /> {advanceSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-4">
            <DataTable title="Advances" columns={advanceColumns} data={advances} idKey="_id" emptyMessage="No advances" />
          </div>
        </div>
      )}

      {activeTab === "payroll" && (
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-emerald-800">Payroll Generation</div>
              <button
                type="button"
                onClick={generatePayroll}
                disabled={payrollGenerating}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs hover:bg-emerald-700 disabled:opacity-60"
              >
                <Wand2 size={14} /> {payrollGenerating ? "Generating..." : "Generate Payroll"}
              </button>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-600">Month *</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    className={`w-full border rounded p-2 text-sm ${payrollErrors.month ? "border-red-400 bg-red-50" : "border-gray-300"}`}
                    value={payrollForm.month}
                    onChange={(e) => {
                      setPayrollForm((p) => ({ ...p, month: Number(e.target.value) }));
                      setPayrollErrors((p) => ({ ...p, month: "" }));
                    }}
                  />
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
            {payTarget && (
              <div className="mt-2 border-t pt-3 space-y-2">
                <div className="text-xs font-semibold text-emerald-900">
                  Pay Salary: {payTarget.employeeName} ({payTarget.month}/{payTarget.year})
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-600">Overtime</label>
                    <input type="number" min="0" className="w-full border rounded p-2 text-sm" value={payrollForm.overtime} onChange={(e) => setPayrollForm((p) => ({ ...p, overtime: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Bonus</label>
                    <input type="number" min="0" className="w-full border rounded p-2 text-sm" value={payrollForm.bonus} onChange={(e) => setPayrollForm((p) => ({ ...p, bonus: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Allowances</label>
                    <input type="number" min="0" className="w-full border rounded p-2 text-sm" value={payrollForm.allowances} onChange={(e) => setPayrollForm((p) => ({ ...p, allowances: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Deductions</label>
                    <input type="number" min="0" className="w-full border rounded p-2 text-sm" value={payrollForm.deductions} onChange={(e) => setPayrollForm((p) => ({ ...p, deductions: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-600">Advance Deduction</label>
                  <input
                    type="number"
                    min="0"
                    className={`w-full border rounded p-2 text-sm ${payrollErrors.advanceDeduction ? "border-red-400 bg-red-50" : "border-gray-300"}`}
                    value={payrollForm.advanceDeduction}
                    onChange={(e) => {
                      setPayrollForm((p) => ({ ...p, advanceDeduction: e.target.value }));
                      setPayrollErrors((p) => ({ ...p, advanceDeduction: "" }));
                    }}
                  />
                  <div className="min-h-[14px] text-[11px] text-red-600">{payrollErrors.advanceDeduction || ""}</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-600">Payment Date</label>
                    <input type="date" className="w-full border rounded p-2 text-sm" value={payrollForm.paymentDate} onChange={(e) => setPayrollForm((p) => ({ ...p, paymentDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Method</label>
                    <select className="w-full border rounded p-2 text-sm" value={payrollForm.paymentMethod} onChange={(e) => setPayrollForm((p) => ({ ...p, paymentMethod: e.target.value }))}>
                      <option value="CASH">Cash</option>
                      <option value="BANK">Bank</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-600">
                    Net Salary: <span className="font-semibold text-gray-900">{Math.round(computeNet({ ...payTarget, ...payrollForm, basicSalary: payTarget.basicSalary }))}</span>
                  </div>
                  <button
                    type="button"
                    onClick={payPayroll}
                    disabled={payrollSaving}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-700 text-white text-xs hover:bg-emerald-800 disabled:opacity-60"
                  >
                    <Save size={14} /> {payrollSaving ? "Paying..." : "Pay Now"}
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-4">
            <DataTable title="Payrolls" columns={payrollColumns} data={payrolls} idKey="_id" emptyMessage="No payrolls" />
          </div>
        </div>
      )}

      {/* HR reports moved to Reports module */}
    </div>
  );
}
