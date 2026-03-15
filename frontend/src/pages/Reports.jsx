import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import DataTable from "../components/ui/DataTable";
import api from "../services/api";
import ProductManager from "../components/MasterData/ProductManager";

const REPORT_TABS = [
  { key: "stock", label: "Stock Report" },
  { key: "production", label: "Production Report" },
  { key: "sales", label: "Sales Report" },
  { key: "purchases", label: "Purchase Report" },
  { key: "pl", label: "Profit & Loss" },
  { key: "trial", label: "Trial Balance" },
  { key: "balance", label: "Balance Sheet" },
  { key: "receivables", label: "Outstanding Receivables" },
  { key: "payables", label: "Outstanding Payables" },
  { key: "daybook", label: "Day Book" },
  { key: "ledger", label: "Ledger" },
  { key: "customers", label: "Customer Report" },
  { key: "wholesellers", label: "Wholeseller Report" },
  { key: "brands", label: "Brand Report" },
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

export default function Reports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("stock");
  const [range, setRange] = useState("month");
  const [particularDate, setParticularDate] = useState(new Date().toISOString().slice(0, 10));
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
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

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap gap-2">
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setActiveTab(tab.key);
              setSearchParams({ tab: tab.key });
            }}
            className={`px-3 py-1.5 rounded-full text-sm border ${
              activeTab === tab.key
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
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
