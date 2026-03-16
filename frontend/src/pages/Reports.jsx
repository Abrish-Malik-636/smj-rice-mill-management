import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Package,
  Factory,
  ShoppingCart,
  Truck,
  Users,
  TrendingUp,
  Scale,
  Landmark,
  HandCoins,
  BookOpen,
  BookCopy,
  FileText,
  Printer,
  UserRound,
  UsersRound,
  Tags,
} from "lucide-react";
import DataTable from "../components/ui/DataTable";
import api from "../services/api";
import ProductManager from "../components/MasterData/ProductManager";

const REPORT_TABS = [
  { key: "stock", label: "Stock Report", icon: <Package size={16} /> },
  { key: "production", label: "Production Report", icon: <Factory size={16} /> },
  { key: "sales", label: "Sales Report", icon: <ShoppingCart size={16} /> },
  { key: "purchases", label: "Purchase Report", icon: <Truck size={16} /> },
  { key: "hr", label: "HR Reports", icon: <Users size={16} /> },
  { key: "pl", label: "Profit & Loss", icon: <TrendingUp size={16} /> },
  { key: "trial", label: "Trial Balance", icon: <Scale size={16} /> },
  { key: "balance", label: "Balance Sheet", icon: <Landmark size={16} /> },
  { key: "receivables", label: "Outstanding Receivables", icon: <HandCoins size={16} /> },
  { key: "payables", label: "Outstanding Payables", icon: <HandCoins size={16} /> },
  { key: "daybook", label: "Day Book", icon: <BookOpen size={16} /> },
  { key: "ledger", label: "Ledger", icon: <BookCopy size={16} /> },
  { key: "customers", label: "Customer Report", icon: <UserRound size={16} /> },
  { key: "wholesellers", label: "Wholeseller Report", icon: <UsersRound size={16} /> },
  { key: "brands", label: "Brand Report", icon: <Tags size={16} /> },
];

const RANGE_OPTIONS = [
  { value: "day", label: "Day (Today)" },
  { value: "particular", label: "Particular Date" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
  { value: "custom", label: "Custom Range" },
];

const num = (v) => Math.round(Number(v || 0));
const fmt = (v) => `Rs ${num(v)}`;
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString() : "-");
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
const n0 = (v) => (v === "" || v == null ? 0 : Number(v || 0) || 0);
const round2 = (n) => Number((Number(n || 0)).toFixed(2));

function computeTotalsFromItems({ earnings, deductionsItems }) {
  const e = Array.isArray(earnings) ? earnings : [];
  const d = Array.isArray(deductionsItems) ? deductionsItems : [];
  const totalEarnings = round2(e.reduce((s, it) => s + n0(it?.amount), 0));
  const totalDeductions = round2(d.reduce((s, it) => s + n0(it?.amount), 0));
  const netPay = Math.max(0, round2(totalEarnings - totalDeductions));
  return { totalEarnings, totalDeductions, netPay };
}

function defaultEarningsFromBasic(basicSalary) {
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

export default function Reports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("stock");
  const [range, setRange] = useState("month");
  const [particularDate, setParticularDate] = useState(new Date().toISOString().slice(0, 10));
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hrSubTab, setHrSubTab] = useState("employees");
  const [hrRows, setHrRows] = useState([]);
  const [hrPayrollFilters, setHrPayrollFilters] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    employeeId: "",
  });
  // Kept for backward compatibility; customers/wholesellers now load from dedicated tables.
  const [partyBuckets, setPartyBuckets] = useState({ customers: [], wholesalers: [] });

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && REPORT_TABS.some((t) => t.key === tab)) setActiveTab(tab);
  }, [searchParams]);

  const params = useMemo(() => {
    const p = { range };
    if (range === "particular" && particularDate) p.date = particularDate;
    if (range === "custom") {
      if (startDate) p.startDate = startDate;
      if (endDate) p.endDate = endDate;
    }
    return { params: p };
  }, [range, particularDate, startDate, endDate]);

  const loadReport = async () => {
    try {
      setLoading(true);
      if (activeTab === "hr") {
        // HR reports are not range-based for now; keep UX simple.
        const endpoint =
          hrSubTab === "employees"
            ? "/hr/reports/employees"
            : hrSubTab === "advanceBalances"
              ? "/hr/reports/advance-balances"
              : hrSubTab === "payrollSummary"
                ? "/hr/reports/payroll-summary"
                : hrSubTab === "payrolls"
                  ? "/hr/payrolls"
                  : "/hr/reports/employees";
        const res = await api.get(endpoint, hrSubTab === "payrolls" ? { params: hrPayrollFilters } : undefined);
        const data = res.data?.data || [];
        if (hrSubTab === "payrollSummary") {
          setHrRows(
            data.map((r) => ({
              __rowId: `${r.year}-${r.month}`,
              ...r,
            }))
          );
        } else if (hrSubTab === "advanceBalances") {
          setHrRows(
            data.map((r) => ({
              __rowId: String(r.employeeId || r._id || ""),
              ...r,
            }))
          );
        } else if (hrSubTab === "payrolls") {
          setHrRows(
            data.map((r) => ({
              __rowId: String(r._id || ""),
              ...r,
            }))
          );
        } else {
          setHrRows(data);
        }
        setRows([]);
        return;
      }
      if (activeTab === "customers" || activeTab === "brands") {
        setRows([]);
        return;
      }
      if (activeTab === "stock") {
        const res = await api.get("/reports/stock", params);
        const production = (res.data?.data?.production || []).map((r, idx) => ({
          id: `p-${idx}`,
          stockType: "Production",
          item: r.productTypeName || "-",
          party: r.companyName || "-",
          balance: `${num(r.balanceKg)} kg`,
        }));
        const managerial = (res.data?.data?.managerial || []).map((r, idx) => ({
          id: `m-${idx}`,
          stockType: "Managerial",
          item: r.itemName || "-",
          party: r.category || "-",
          balance: `${num(r.balanceQty)} ${r.unit || ""}`.trim(),
        }));
        setRows([...production, ...managerial]);
        return;
      }
      if (activeTab === "production") {
        const res = await api.get("/reports/production", params);
        const mapped = (res.data?.data || []).flatMap((b) =>
          (b.outputs?.length ? b.outputs : [{ productTypeName: "-", netWeightKg: 0, outputDate: b.date }]).map((o, idx) => ({
            id: `${b._id}-${idx}`,
            date: fmtDate(o.outputDate || b.date),
            batchNo: b.batchNo || "-",
            company: o.companyName || b.sourceCompanyName || "-",
            product: o.productTypeName || "-",
            outputKg: num(o.netWeightKg),
            status: b.status || "-",
          }))
        );
        setRows(mapped);
        return;
      }
      if (activeTab === "sales") {
        const res = await api.get("/reports/sales", params);
        setRows(
          (res.data?.data || []).map((r) => ({
            ...r,
            date: fmtDate(r.date),
            totalAmount: num(r.totalAmount),
            partialPaid: num(r.partialPaid),
            remaining: Math.max(num(r.totalAmount) - num(r.partialPaid), 0),
          }))
        );
        return;
      }
      if (activeTab === "purchases") {
        const res = await api.get("/reports/purchases", params);
        setRows(
          (res.data?.data || []).map((r) => ({
            ...r,
            date: fmtDate(r.date),
            totalAmount: num(r.totalAmount),
            partialPaid: num(r.partialPaid),
            remaining: Math.max(num(r.totalAmount) - num(r.partialPaid), 0),
          }))
        );
        return;
      }
      if (activeTab === "trial") {
        const res = await api.get("/accounting/trial-balance", params);
        setRows(res.data?.data || []);
        return;
      }
      if (activeTab === "pl") {
        const res = await api.get("/accounting/pl", params);
        const p = res.data?.data || {};
        setRows([
          { id: "sales", line: "Sales Revenue", amount: num(p.salesTotal) },
          { id: "cogs", line: "Cost of Goods Sold", amount: -num(p.cogsTotal) },
          { id: "purchase", line: "Purchases Expense", amount: -num(p.purchasesTotal) },
          { id: "expense", line: "Operating Expense", amount: -num(p.expenseTotal) },
          { id: "payroll", line: "Payroll Expense", amount: -num(p.payrollTotal) },
          { id: "net", line: "Net Profit / (Loss)", amount: num(p.profit) },
        ]);
        return;
      }
      if (activeTab === "balance") {
        const res = await api.get("/accounting/balance", params);
        const b = res.data?.data || {};
        setRows([
          { id: "a1", section: "Assets", line: "Cash & Bank", amount: num(b.assets?.cash) },
          { id: "a2", section: "Assets", line: "Accounts Receivable", amount: num(b.assets?.receivables) },
          { id: "a3", section: "Assets", line: "Inventory", amount: num(b.assets?.inventory) },
          { id: "a4", section: "Assets", line: "Fixed Assets", amount: num(b.assets?.fixedAssets) },
          { id: "l1", section: "Liabilities", line: "Accounts Payable", amount: num(b.liabilities?.payables) },
          { id: "l2", section: "Liabilities", line: "Long-term Liabilities", amount: num(b.liabilities?.longTerm) },
          { id: "e1", section: "Equity", line: "Owner Equity", amount: num(b.equity) },
        ]);
        return;
      }
      if (activeTab === "receivables") {
        const res = await api.get("/accounting/outstanding/receivables", params);
        setRows(res.data?.data || []);
        return;
      }
      if (activeTab === "payables") {
        const res = await api.get("/accounting/outstanding/payables", params);
        setRows(res.data?.data || []);
        return;
      }
      if (activeTab === "daybook") {
        const res = await api.get("/accounting/daybook", params);
        setRows(
          (res.data?.data || []).map((r, idx) => ({
            id: `${idx}-${r.description || ""}`,
            date: fmtDate(r.date),
            type: r.type || "-",
            party: r.party || "-",
            description: r.description || "-",
            inflow: num(r.inflow),
            outflow: num(r.outflow),
          }))
        );
        return;
      }
      if (activeTab === "ledger") {
        const res = await api.get("/accounting/ledger", params);
        setRows(
          (res.data?.data || []).map((r, idx) => ({
            id: `${idx}-${r.account || ""}`,
            date: fmtDate(r.date),
            account: r.account || "-",
            description: r.description || "-",
            debit: num(r.debit),
            credit: num(r.credit),
            balance: num(r.balance),
          }))
        );
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load report.");
      setRows([]);
    } finally {
      setLoading(false);
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

      const allForEmployee = row?.employeeId
        ? await api.get("/hr/payrolls", { params: { employeeId: row.employeeId } })
        : { data: { data: [] } };
      const employeePayrolls = allForEmployee?.data?.data || [];
      const lastTwo = employeePayrolls
        .filter((p) => String(p._id) !== String(row._id) && p.status === "PAID")
        .sort((a, b) => new Date(b.paymentDate || b.createdAt || 0) - new Date(a.paymentDate || a.createdAt || 0))
        .slice(0, 2);

      const earnings =
        Array.isArray(row.earnings) && row.earnings.length
          ? row.earnings
          : defaultEarningsFromBasic(row.basicSalary);
      const deductionsItems =
        Array.isArray(row.deductionsItems) && row.deductionsItems.length
          ? row.deductionsItems
          : defaultDeductions();

      const { totalEarnings, totalDeductions, netPay } = computeTotalsFromItems({
        earnings,
        deductionsItems,
      });

      const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Payslip</title>
  <style>
    @page { size: A4; margin: 14mm; }
    body { font-family: Arial, sans-serif; color: #0f172a; }
    .hdr { text-align:center; border-bottom: 2px solid #10b981; padding-bottom:10px; }
    .logo { width:52px; height:52px; object-fit:contain; display:block; margin: 0 auto 6px; }
    h1 { font-size:18px; margin:0; }
    .muted { color:#475569; font-size:11px; margin-top:2px; }
    .meta { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; font-size:12px; }
    .meta .row { display:flex; justify-content: space-between; gap: 12px; }
    .grid2 { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 18px; }
    .secTitle { font-weight:700; font-size:12px; margin-bottom:6px; }
    .tbl { width:100%; border-collapse: collapse; font-size:12px; }
    .tbl th, .tbl td { border:1px solid #e2e8f0; padding:8px; text-align:left; }
    .tbl th { background:#f8fafc; }
    .tot { margin-top: 10px; display:flex; justify-content: space-between; font-size:12px; }
    .tot b { font-size: 13px; }
    .box { border:1px solid #e2e8f0; border-radius:10px; padding:12px; margin-top:12px; }
    .sig { margin-top: 24px; display:flex; justify-content: space-between; gap: 18px; }
    .sig .line { margin-top: 34px; border-top: 1px solid #0f172a; padding-top: 6px; font-size: 11px; color: #334155; }
    .ft { margin-top:16px; border-top:1px solid #e2e8f0; padding-top:8px; font-size:11px; color:#475569; text-align:center; }
  </style>
</head>
<body>
  <div class="hdr">
    ${logoUrl ? `<img class="logo" src="${logoUrl}" />` : ""}
    <h1>Payslip</h1>
    <div class="muted">${companyName}</div>
    <div class="muted">${address ? address : ""}${address && phone ? " | " : ""}${phone ? phone : ""}</div>
  </div>

  <div class="meta">
    <div>
      <div class="row"><div>Date of Joining</div><div>: ${row.joiningDate ? fmtDate(row.joiningDate) : "-"}</div></div>
      <div class="row"><div>Pay Period</div><div>: ${row.month || "-"} / ${row.year || "-"}</div></div>
    </div>
    <div>
      <div class="row"><div>Employee name</div><div>: ${row.employeeName || "-"}</div></div>
      <div class="row"><div>Department</div><div>: ${row.department || "-"}</div></div>
    </div>
  </div>

  <div class="grid2">
    <div>
      <div class="secTitle">Earnings</div>
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
      <div class="secTitle">Deductions</div>
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
    <div class="secTitle">Last 2 Months Paid</div>
    <table class="tbl">
      <thead><tr><th>Month</th><th>Paid Date</th><th>Net Pay</th></tr></thead>
      <tbody>
        ${
          lastTwo.length
            ? lastTwo
                .map((p) => `<tr><td>${p.month}/${p.year}</td><td>${p.paymentDate ? fmtDate(p.paymentDate) : "-"}</td><td>${Math.round(Number(p.netPay ?? p.netSalary ?? 0))}</td></tr>`)
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

  <div class="ft">This is system generated payslip</div>
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
      toast.error(err?.response?.data?.message || "Failed to print payslip");
    }
  };

  useEffect(() => {
    if (activeTab === "hr") loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, hrSubTab]);

  useEffect(() => {
    if (activeTab !== "hr" || hrSubTab !== "payrolls") return;
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hrPayrollFilters.month, hrPayrollFilters.year, hrPayrollFilters.employeeId]);

  useEffect(() => {
    loadReport();
  }, [activeTab, params]);

  useEffect(() => {
    const loadPartyBuckets = async () => {
      if (activeTab !== "customers" && activeTab !== "wholesellers") return;
      try {
        if (activeTab === "customers") {
          const res = await api.get("/customers");
          const list = res.data?.data || [];
          setRows(
            list.map((c) => ({
              id: c._id,
              name: c.name || "-",
              phone: c.phone || "-",
              email: c.email || "-",
              address: c.address || "-",
              updatedAt: c.updatedAt || c.createdAt,
            }))
          );
        } else {
          const res = await api.get("/wholesellers");
          const list = res.data?.data || [];
          setRows(
            list.map((c) => ({
              id: c._id,
              name: c.name || "-",
              phone: c.phone || "-",
              email: c.email || "-",
              address: c.address || "-",
              updatedAt: c.updatedAt || c.createdAt,
            }))
          );
        }
      } catch {
        setRows([]);
      }
    };
    loadPartyBuckets();
  }, [activeTab]);

  const columns = useMemo(() => {
    if (activeTab === "customers" || activeTab === "wholesellers") {
      return [
        { key: "name", label: "Name" },
        { key: "phone", label: "Phone" },
        { key: "email", label: "Email" },
        { key: "address", label: "Address" },
        { key: "updatedAt", label: "Updated", render: (v) => fmtDate(v) },
      ];
    }
    if (activeTab === "stock") {
      return [
        { key: "stockType", label: "Stock Type" },
        { key: "item", label: "Item / Product" },
        { key: "party", label: "Brand / Category" },
        { key: "balance", label: "Balance" },
      ];
    }
    if (activeTab === "production") {
      return [
        { key: "date", label: "Date" },
        { key: "batchNo", label: "Batch #" },
        { key: "company", label: "Brand" },
        { key: "product", label: "Product" },
        { key: "outputKg", label: "Output (kg)" },
        { key: "status", label: "Status" },
      ];
    }
    if (activeTab === "sales" || activeTab === "purchases") {
      const partyLabel = activeTab === "sales" ? "Customer" : "Supplier";
      return [
        { key: "date", label: "Date" },
        { key: "invoiceNo", label: "Invoice #" },
        { key: "companyName", label: partyLabel },
        { key: "paymentStatus", label: "Payment Status" },
        { key: "totalAmount", label: "Total (PKR)", render: (v) => fmt(v) },
        { key: "partialPaid", label: "Paid (PKR)", render: (v) => fmt(v) },
        { key: "remaining", label: "Remaining (PKR)", render: (v) => fmt(v) },
      ];
    }
    if (activeTab === "trial") {
      return [
        { key: "code", label: "Code" },
        { key: "account", label: "Account" },
        { key: "debit", label: "Debit (PKR)", render: (v) => fmt(v) },
        { key: "credit", label: "Credit (PKR)", render: (v) => fmt(v) },
      ];
    }
    if (activeTab === "pl") {
      return [
        { key: "line", label: "Particular" },
        { key: "amount", label: "Amount (PKR)", render: (v) => fmt(v) },
      ];
    }
    if (activeTab === "balance") {
      return [
        { key: "section", label: "Section" },
        { key: "line", label: "Particular" },
        { key: "amount", label: "Amount (PKR)", render: (v) => fmt(v) },
      ];
    }
    if (activeTab === "receivables" || activeTab === "payables") {
      return [
        { key: "date", label: "Date", render: (v) => fmtDate(v) },
        { key: "invoiceNo", label: "Invoice #" },
        { key: "party", label: "Party" },
        { key: "totalAmount", label: "Total (PKR)", render: (v) => fmt(v) },
        { key: "paid", label: "Paid (PKR)", render: (v) => fmt(v) },
        { key: "outstanding", label: "Outstanding (PKR)", render: (v) => fmt(v) },
        { key: "dueDate", label: "Due Date", render: (v) => fmtDate(v) },
      ];
    }
    if (activeTab === "daybook") {
      return [
        { key: "date", label: "Date" },
        { key: "type", label: "Type" },
        { key: "party", label: "Party" },
        { key: "description", label: "Description" },
        { key: "inflow", label: "Inflow (PKR)", render: (v) => fmt(v) },
        { key: "outflow", label: "Outflow (PKR)", render: (v) => fmt(v) },
      ];
    }
    return [
      { key: "date", label: "Date" },
      { key: "account", label: "Account" },
      { key: "description", label: "Description" },
      { key: "debit", label: "Debit (PKR)", render: (v) => fmt(v) },
      { key: "credit", label: "Credit (PKR)", render: (v) => fmt(v) },
      { key: "balance", label: "Balance (PKR)", render: (v) => fmt(v) },
    ];
  }, [activeTab]);

  const title = REPORT_TABS.find((t) => t.key === activeTab)?.label || "Report";

  const hrColumns = useMemo(() => {
    if (hrSubTab === "advanceBalances") {
      return [
        { key: "employeeCode", label: "Employee ID" },
        { key: "employeeName", label: "Employee" },
        { key: "department", label: "Department" },
        { key: "totalAdvance", label: "Total Advance", render: (v) => fmt(v) },
        { key: "remainingBalance", label: "Remaining", render: (v) => fmt(v) },
      ];
    }
    if (hrSubTab === "payrollSummary") {
      return [
        { key: "year", label: "Year" },
        { key: "month", label: "Month" },
        { key: "count", label: "Employees" },
        { key: "totalNet", label: "Total Net Salary", render: (v) => fmt(v) },
      ];
    }
    if (hrSubTab === "payrolls") {
      return [
        { key: "payrollId", label: "Payroll ID" },
        { key: "employeeName", label: "Employee" },
        { key: "department", label: "Department" },
        { key: "month", label: "Month" },
        { key: "year", label: "Year" },
        { key: "totalEarnings", label: "Earnings", render: (v) => fmt(v) },
        { key: "totalDeductions", label: "Deductions", render: (v) => fmt(v) },
        { key: "netPay", label: "Net Pay", render: (v, row) => fmt(v ?? row.netSalary ?? 0) },
        { key: "status", label: "Status" },
        { key: "paymentDate", label: "Payment Date", render: (v) => fmtDate(v) },
        {
          key: "actions",
          label: "Actions",
          skipExport: true,
          render: (_, row) => (
            <button
              type="button"
              className="p-1 rounded hover:bg-gray-50"
              title="Print payslip"
              onClick={() => printPayrollSlip(row)}
            >
              <Printer className="w-4 h-4 text-gray-700" />
            </button>
          ),
        },
      ];
    }
    return [
      { key: "employeeId", label: "Employee ID" },
      { key: "name", label: "Employee Name" },
      { key: "department", label: "Department" },
      { key: "designation", label: "Designation" },
      { key: "salaryType", label: "Salary Type" },
      { key: "basicSalary", label: "Basic Salary", render: (v) => fmt(v) },
      { key: "status", label: "Status" },
    ];
  }, [hrSubTab]);

  return (
    <div className="space-y-4">
      <div className="border-b border-emerald-200">
        <div className="flex flex-wrap gap-2">
          {REPORT_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.key);
                    setSearchParams({ tab: tab.key });
                  }}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm rounded-t-lg border-b-2 transition whitespace-nowrap
                  ${
                    isActive
                      ? "bg-emerald-50 text-emerald-700 font-semibold border-emerald-600"
                      : "text-gray-500 border-transparent hover:text-emerald-600 hover:bg-emerald-50"
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
        </div>
      </div>

      {activeTab !== "hr" && (
      <div className="bg-white rounded-lg border border-gray-200 p-3 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-gray-600 mb-1">Range</span>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm min-w-[160px]"
          >
            {RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        {range === "particular" && (
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">Date</span>
            <input
              type="date"
              value={particularDate}
              onChange={(e) => setParticularDate(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </label>
        )}
        {range === "custom" && (
          <>
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Start Date</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">End Date</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </label>
          </>
        )}
      </div>
      )}

      <div className="bg-white rounded-lg shadow-sm p-4">
        {activeTab === "brands" ? (
          <ProductManager tableOnly editInModal />
        ) : activeTab === "hr" ? (
          <>
            <div className="border-b border-emerald-200 mb-3">
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "employees", label: "Employee List", icon: <Users size={16} /> },
                  { key: "advanceBalances", label: "Advance Balance", icon: <HandCoins size={16} /> },
                  { key: "payrollSummary", label: "Monthly Payroll Summary", icon: <TrendingUp size={16} /> },
                  { key: "payrolls", label: "Payrolls", icon: <FileText size={16} /> },
                ].map((t) => {
                  const isActive = hrSubTab === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setHrSubTab(t.key)}
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

            {hrSubTab === "payrolls" && (
              <div className="bg-white rounded-lg border border-gray-200 p-3 flex flex-wrap items-end gap-3 mb-3">
                <label className="text-sm">
                  <span className="block text-gray-600 mb-1">Month</span>
                  <select
                    value={hrPayrollFilters.month}
                    onChange={(e) =>
                      setHrPayrollFilters((p) => ({ ...p, month: Number(e.target.value) }))
                    }
                    className="border border-gray-300 rounded px-3 py-2 text-sm w-44"
                  >
                    {MONTHS.map((m, idx) => (
                      <option key={m} value={idx + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="block text-gray-600 mb-1">Year</span>
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    value={hrPayrollFilters.year}
                    onChange={(e) => setHrPayrollFilters((p) => ({ ...p, year: Number(e.target.value) }))}
                    className="border border-gray-300 rounded px-3 py-2 text-sm w-32"
                  />
                </label>
                <label className="text-sm">
                  <span className="block text-gray-600 mb-1">Employee</span>
                  <select
                    value={hrPayrollFilters.employeeId}
                    onChange={(e) => setHrPayrollFilters((p) => ({ ...p, employeeId: e.target.value }))}
                    className="border border-gray-300 rounded px-3 py-2 text-sm min-w-[240px]"
                  >
                    <option value="">All</option>
                    {(hrRows || [])
                      .map((r) => ({ id: r.employeeId, name: r.employeeName }))
                      .filter((x) => x.id && x.name)
                      .filter((x, i, arr) => arr.findIndex((y) => y.id === x.id) === i)
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
            )}
            {loading ? (
              <div className="text-sm text-gray-500">Loading hr reports...</div>
            ) : (
              <DataTable
                title="HR Reports"
                columns={hrColumns}
                data={hrRows}
                idKey={hrSubTab === "employees" ? "_id" : "__rowId"}
                emptyMessage="No data found."
              />
            )}
          </>
        ) : (
          loading ? (
          <div className="text-sm text-gray-500">Loading {title.toLowerCase()}...</div>
        ) : (
          <DataTable
            title={title}
            columns={columns}
            data={rows}
            idKey="id"
            searchPlaceholder={`Search ${title.toLowerCase()}...`}
            emptyMessage={`No ${title.toLowerCase()} found.`}
          />
        )
        )}
      </div>
    </div>
  );
}
