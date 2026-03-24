import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Package,
  Factory,
  Truck,
  TrendingUp,
  Scale,
  Landmark,
  HandCoins,
  BookOpen,
  BookCopy,
  FileText,
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
  { key: "pl", label: "Profit & Loss", icon: <TrendingUp size={16} /> },
  { key: "trial", label: "Trial Balance", icon: <Scale size={16} /> },
  { key: "balance", label: "Balance Sheet", icon: <Landmark size={16} /> },
  { key: "receivables", label: "Outstanding Receivables", icon: <HandCoins size={16} /> },
  { key: "payables", label: "Outstanding Payables", icon: <HandCoins size={16} /> },
  { key: "daybook", label: "Day Book", icon: <BookOpen size={16} /> },
  { key: "ledger", label: "Ledger", icon: <BookCopy size={16} /> },
  { key: "customers", label: "Customer Report", icon: <UserRound size={16} /> },
  { key: "wholesellers", label: "Wholeseller Report", icon: <UsersRound size={16} /> },
  { key: "brands", label: "Company Name Report", icon: <Tags size={16} /> },
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

  // Accounting filters (manual-entry reports)
  const [accCompanies, setAccCompanies] = useState([]);
  const [accAccounts, setAccAccounts] = useState([]);
  const [accParties, setAccParties] = useState([]);
  const [accProducts, setAccProducts] = useState([]);

  const [accCompanyId, setAccCompanyId] = useState("");
  const [accVoucherTypes, setAccVoucherTypes] = useState([]);
  const [accAccountIds, setAccAccountIds] = useState([]);
  const [accPartyIds, setAccPartyIds] = useState([]);
  const [accProductIds, setAccProductIds] = useState([]);

  const [filterTemplates, setFilterTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
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

    const isAccountingReport = [
      "trial",
      "pl",
      "balance",
      "receivables",
      "payables",
      "daybook",
      "ledger",
    ].includes(activeTab);

    if (isAccountingReport) {
      if (accCompanyId) p.companyId = accCompanyId;
      if (accVoucherTypes.length) p.voucherTypes = accVoucherTypes.join(",");
      if (accAccountIds.length) p.accountIds = accAccountIds.join(",");
      if (accPartyIds.length) p.partyIds = accPartyIds.join(",");
      if (accProductIds.length) p.productIds = accProductIds.join(",");
    }
    return { params: p };
  }, [
    range,
    particularDate,
    startDate,
    endDate,
    activeTab,
    accCompanyId,
    accVoucherTypes,
    accAccountIds,
    accPartyIds,
    accProductIds,
  ]);

  const loadReport = async () => {
    try {
      setLoading(true);
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
        setRows([...production]);
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
      if (activeTab === "trial") {
        const res = await api.get("/accounting/trial-balance", params);
        setRows(
          (res.data?.data || []).map((r) => ({
            id: r.accountId || r._id || `${r.code}-${r.account}`,
            ...r,
          }))
        );
        return;
      }
      if (activeTab === "pl") {
        const res = await api.get("/accounting/pl", params);
        const p = res.data?.data || {};
        const income = (p.income || []).map((r) => ({
          id: `inc-${r.accountId}`,
          section: "Income",
          line: r.account,
          amount: num(r.amount),
        }));
        const cogs = (p.cogs || []).map((r) => ({
          id: `cogs-${r.accountId}`,
          section: "COGS",
          line: r.account,
          amount: -num(r.amount),
        }));
        const exp = (p.expenses || []).map((r) => ({
          id: `exp-${r.accountId}`,
          section: "Expenses",
          line: r.account,
          amount: -num(r.amount),
        }));
        const totals = p.totals || {};
        const summary = [
          { id: "sum-income", section: "Summary", line: "Total Income", amount: num(totals.incomeTotal) },
          { id: "sum-cogs", section: "Summary", line: "Total COGS", amount: -num(totals.cogsTotal) },
          { id: "sum-gp", section: "Summary", line: "Gross Profit", amount: num(totals.grossProfit) },
          { id: "sum-exp", section: "Summary", line: "Total Expenses", amount: -num(totals.expenseTotal) },
          { id: "sum-np", section: "Summary", line: "Net Profit / (Loss)", amount: num(totals.profit) },
        ];
        setRows([...income, ...cogs, ...exp, ...summary]);
        return;
      }
      if (activeTab === "balance") {
        const res = await api.get("/accounting/balance", params);
        const b = res.data?.data || {};
        const assets = (b.assets || []).map((r) => ({
          id: `a-${r.accountId}`,
          section: "Assets",
          line: r.account,
          amount: num(r.balance),
        }));
        const liabilities = (b.liabilities || []).map((r) => ({
          id: `l-${r.accountId}`,
          section: "Liabilities",
          line: r.account,
          amount: num(r.balance),
        }));
        const equity = (b.equity || []).map((r) => ({
          id: `e-${r.accountId}`,
          section: "Equity",
          line: r.account,
          amount: num(r.balance),
        }));
        const totals = b.totals || {};
        const summary = [
          { id: "t-a", section: "Summary", line: "Total Assets", amount: num(totals.totalAssets) },
          { id: "t-l", section: "Summary", line: "Total Liabilities", amount: num(totals.totalLiabilities) },
          { id: "t-e", section: "Summary", line: "Total Equity", amount: num(totals.totalEquity) },
          { id: "t-le", section: "Summary", line: "Total L + E", amount: num(totals.totalLE) },
        ];
        setRows([...assets, ...liabilities, ...equity, ...summary]);
        return;
      }
      if (activeTab === "receivables") {
        const res = await api.get("/accounting/outstanding/receivables", params);
        setRows(
          (res.data?.data || []).map((r, idx) => ({
            id: `${idx}-${r.party}`,
            ...r,
          }))
        );
        return;
      }
      if (activeTab === "payables") {
        const res = await api.get("/accounting/outstanding/payables", params);
        setRows(
          (res.data?.data || []).map((r, idx) => ({
            id: `${idx}-${r.party}`,
            ...r,
          }))
        );
        return;
      }
      if (activeTab === "daybook") {
        const res = await api.get("/accounting/daybook", params);
        setRows(
          (res.data?.data || []).map((r, idx) => ({
            id: r.journalEntryId || `${idx}-${r.voucherNo}`,
            ...r,
          }))
        );
        return;
      }
      if (activeTab === "ledger") {
        const res = await api.get("/accounting/ledger", params);
        setRows(
          (res.data?.data || []).map((r, idx) => ({
            id: r.journalLineId || `${idx}-${r.account || ""}`,
            ...r,
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

  useEffect(() => {
    (async () => {
      try {
        const [compRes, accRes, partyRes, prodRes] = await Promise.all([
          api.get("/accounting/entities"),
          api.get("/accounting/accounts"),
          api.get("/accounting/parties"),
          api.get("/accounting/products"),
        ]);
        setAccCompanies(compRes.data?.data || []);
        setAccAccounts(accRes.data?.data || []);
        setAccParties(partyRes.data?.data || []);
        setAccProducts(prodRes.data?.data || []);
      } catch {
        // ignore; reports can still load without these filters
      }
    })();
  }, []);

  useEffect(() => {
    const isAccountingReport = [
      "trial",
      "pl",
      "balance",
      "receivables",
      "payables",
      "daybook",
      "ledger",
    ].includes(activeTab);
    if (!isAccountingReport) {
      setFilterTemplates([]);
      setSelectedTemplateId("");
      return;
    }
    (async () => {
      try {
        const res = await api.get("/accounting/templates", {
          params: { reportKey: activeTab, companyId: accCompanyId || "" },
        });
        setFilterTemplates(res.data?.data || []);
      } catch {
        setFilterTemplates([]);
      }
    })();
  }, [activeTab, accCompanyId]);



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
        { key: "party", label: "Company Name / Category" },
        { key: "balance", label: "Balance" },
      ];
    }
    if (activeTab === "production") {
      return [
        { key: "date", label: "Date" },
        { key: "batchNo", label: "Batch #" },
        { key: "company", label: "Company Name" },
        { key: "product", label: "Product" },
        { key: "outputKg", label: "Output (kg)" },
        { key: "status", label: "Status" },
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
        { key: "section", label: "Section" },
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
        { key: "party", label: "Party" },
        { key: "totalDebit", label: "Total Debit (PKR)", render: (v) => fmt(v) },
        { key: "totalCredit", label: "Total Credit (PKR)", render: (v) => fmt(v) },
        { key: "balance", label: "Balance (PKR)", render: (v) => fmt(v) },
      ];
    }
    if (activeTab === "daybook") {
      return [
        { key: "date", label: "Date", render: (v) => fmtDate(v) },
        { key: "voucherNo", label: "Voucher No" },
        { key: "type", label: "Type" },
        { key: "companyName", label: "Company" },
        { key: "description", label: "Description" },
        { key: "debit", label: "Debit (PKR)", render: (v) => fmt(v) },
        { key: "credit", label: "Credit (PKR)", render: (v) => fmt(v) },
        { key: "amount", label: "Amount (PKR)", render: (v) => fmt(v) },
        { key: "status", label: "Status" },
      ];
    }
    return [
      { key: "date", label: "Date", render: (v) => fmtDate(v) },
      { key: "account", label: "Account" },
      { key: "description", label: "Description" },
      { key: "debit", label: "Debit (PKR)", render: (v) => fmt(v) },
      { key: "credit", label: "Credit (PKR)", render: (v) => fmt(v) },
      { key: "balance", label: "Balance (PKR)", render: (v) => fmt(v) },
    ];
  }, [activeTab]);

  const title = REPORT_TABS.find((t) => t.key === activeTab)?.label || "Report";

  const applyTemplate = (templateId) => {
    const t = filterTemplates.find((x) => String(x._id) === String(templateId));
    if (!t) return;
    const f = t.filters || {};
    if (f.companyId != null) setAccCompanyId(String(f.companyId || ""));
    if (Array.isArray(f.voucherTypes)) setAccVoucherTypes(f.voucherTypes);
    if (Array.isArray(f.accountIds)) setAccAccountIds(f.accountIds);
    if (Array.isArray(f.partyIds)) setAccPartyIds(f.partyIds);
    if (Array.isArray(f.productIds)) setAccProductIds(f.productIds);
    if (f.range) setRange(f.range);
    if (f.particularDate) setParticularDate(f.particularDate);
    if (f.startDate) setStartDate(f.startDate);
    if (f.endDate) setEndDate(f.endDate);
  };

  const saveTemplate = async () => {
    const name = window.prompt("Template name:");
    const trimmed = String(name || "").trim();
    if (!trimmed) return;
    try {
      await api.post("/accounting/templates", {
        name: trimmed,
        reportKey: activeTab,
        companyId: accCompanyId || "",
        filters: {
          companyId: accCompanyId || "",
          voucherTypes: accVoucherTypes,
          accountIds: accAccountIds,
          partyIds: accPartyIds,
          productIds: accProductIds,
          range,
          particularDate,
          startDate,
          endDate,
        },
      });
      toast.success("Template saved.");
      const res = await api.get("/accounting/templates", {
        params: { reportKey: activeTab, companyId: accCompanyId || "" },
      });
      setFilterTemplates(res.data?.data || []);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save template.");
    }
  };

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

        {["trial", "pl", "balance", "receivables", "payables", "daybook", "ledger"].includes(activeTab) && (
          <>
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Company</span>
              <select
                value={accCompanyId}
                onChange={(e) => setAccCompanyId(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm min-w-[200px]"
              >
                <option value="">All</option>
                {(accCompanies || []).map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Templates</span>
              <div className="flex gap-2">
                <select
                  value={selectedTemplateId}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSelectedTemplateId(v);
                    applyTemplate(v);
                  }}
                  className="border border-gray-300 rounded px-3 py-2 text-sm min-w-[220px]"
                >
                  <option value="">Select template</option>
                  {(filterTemplates || []).map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={saveTemplate}
                  className="px-3 py-2 rounded border border-emerald-200 text-emerald-800 text-sm hover:bg-emerald-50"
                >
                  Save Template
                </button>
              </div>
            </label>

            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Voucher Types</span>
              <select
                multiple
                value={accVoucherTypes}
                onChange={(e) => setAccVoucherTypes(Array.from(e.target.selectedOptions).map((o) => o.value))}
                className="border border-gray-300 rounded px-3 py-2 text-sm min-w-[200px] h-[42px]"
              >
                {["JOURNAL", "PAYMENT", "RECEIPT"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Accounts</span>
              <select
                multiple
                value={accAccountIds}
                onChange={(e) => setAccAccountIds(Array.from(e.target.selectedOptions).map((o) => o.value))}
                className="border border-gray-300 rounded px-3 py-2 text-sm min-w-[260px] h-[42px]"
              >
                {(accAccounts || []).filter((a) => a.isActive !== false).map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.code} - {a.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Parties</span>
              <select
                multiple
                value={accPartyIds}
                onChange={(e) => setAccPartyIds(Array.from(e.target.selectedOptions).map((o) => o.value))}
                className="border border-gray-300 rounded px-3 py-2 text-sm min-w-[220px] h-[42px]"
              >
                {(accParties || []).filter((p) => p.isActive !== false).map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Products</span>
              <select
                multiple
                value={accProductIds}
                onChange={(e) => setAccProductIds(Array.from(e.target.selectedOptions).map((o) => o.value))}
                className="border border-gray-300 rounded px-3 py-2 text-sm min-w-[220px] h-[42px]"
              >
                {(accProducts || []).filter((p) => p.isActive !== false).map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        {activeTab === "brands" ? (
          <ProductManager tableOnly editInModal />
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
