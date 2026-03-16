import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Plus,
  RotateCcw,
  BookOpen,
  BookCopy,
  FileText,
  Scale,
  TrendingUp,
  Landmark,
  HandCoins,
  ListTree,
  Receipt,
} from "lucide-react";
import api from "../services/api";
import DataTable from "../components/ui/DataTable";

const TABS = [
  { key: "daybook", label: "Day Book", icon: <BookOpen size={16} /> },
  { key: "ledger", label: "Ledger", icon: <BookCopy size={16} /> },
  { key: "journal", label: "Journal", icon: <FileText size={16} /> },
  { key: "trial", label: "Trial Balance", icon: <Scale size={16} /> },
  { key: "pl", label: "Profit & Loss", icon: <TrendingUp size={16} /> },
  { key: "balance", label: "Balance Sheet", icon: <Landmark size={16} /> },
  { key: "receivables", label: "Outstanding Receivables", icon: <HandCoins size={16} /> },
  { key: "payables", label: "Outstanding Payables", icon: <HandCoins size={16} /> },
  { key: "accounts", label: "Accounts", icon: <ListTree size={16} /> },
  { key: "expenses", label: "Expenses", icon: <Receipt size={16} /> },
];

const RANGE_OPTIONS = [
  { value: "day", label: "Day (Today)" },
  { value: "particular", label: "Particular Date" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
  { value: "custom", label: "Custom Range" },
];

const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE", "COGS"];

const toInt = (v) => Math.round(Number(v || 0));
const money = (v) => `Rs ${toInt(v)}`;
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString() : "-");

export default function AccountingFinance() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("daybook");
  const [range, setRange] = useState("month");
  const [particularDate, setParticularDate] = useState(new Date().toISOString().slice(0, 10));
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);

  const [daybook, setDaybook] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [journal, setJournal] = useState([]);
  const [trial, setTrial] = useState([]);
  const [pl, setPl] = useState({});
  const [balance, setBalance] = useState({});
  const [receivables, setReceivables] = useState([]);
  const [payables, setPayables] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const [newAccount, setNewAccount] = useState({
    code: "",
    name: "",
    type: "ASSET",
    subType: "",
  });

  const [expenseForm, setExpenseForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    categoryName: "",
    amount: "",
    paymentMethod: "CASH",
    remarks: "",
  });

  const [manualJV, setManualJV] = useState({
    date: new Date().toISOString().slice(0, 10),
    narration: "",
    debitAccountId: "",
    debitAmount: "",
    creditAccountId: "",
    creditAmount: "",
  });

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && TABS.some((t) => t.key === tab)) setActiveTab(tab);
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

  const loadShared = async () => {
    const [accountsRes] = await Promise.all([api.get("/accounting/accounts")]);
    setAccounts(accountsRes.data?.data || []);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      await loadShared();
      if (activeTab === "daybook") {
        const r = await api.get("/accounting/daybook", params);
        setDaybook(r.data?.data || []);
      } else if (activeTab === "ledger") {
        const r = await api.get("/accounting/ledger", params);
        setLedger(r.data?.data || []);
      } else if (activeTab === "journal") {
        const r = await api.get("/accounting/journal", params);
        setJournal(r.data?.data || []);
      } else if (activeTab === "trial") {
        const r = await api.get("/accounting/trial-balance", params);
        setTrial(r.data?.data || []);
      } else if (activeTab === "pl") {
        const r = await api.get("/accounting/pl", params);
        setPl(r.data?.data || {});
      } else if (activeTab === "balance") {
        const r = await api.get("/accounting/balance", params);
        setBalance(r.data?.data || {});
      } else if (activeTab === "receivables") {
        const r = await api.get("/accounting/outstanding/receivables", params);
        setReceivables(r.data?.data || []);
      } else if (activeTab === "payables") {
        const r = await api.get("/accounting/outstanding/payables", params);
        setPayables(r.data?.data || []);
      } else if (activeTab === "expenses") {
        const r = await api.get("/accounting/expenses", params);
        setExpenses(r.data?.data || []);
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load accounting data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, params]);

  const saveAccount = async (e) => {
    e.preventDefault();
    try {
      await api.post("/accounting/accounts", {
        ...newAccount,
        code: String(newAccount.code || "").trim(),
        name: String(newAccount.name || "").trim(),
        subType: String(newAccount.subType || "").trim(),
      });
      toast.success("Account created.");
      setNewAccount({ code: "", name: "", type: "ASSET", subType: "" });
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to create account.");
    }
  };

  const postManualJournal = async (e) => {
    e.preventDefault();
    const debit = toInt(manualJV.debitAmount);
    const credit = toInt(manualJV.creditAmount);
    if (!debit || !credit || debit !== credit) {
      toast.error("Debit and credit must be equal.");
      return;
    }
    try {
      await api.post("/accounting/journal/post", {
        date: manualJV.date,
        narration: manualJV.narration,
        lines: [
          { accountId: manualJV.debitAccountId, debit, credit: 0 },
          { accountId: manualJV.creditAccountId, debit: 0, credit },
        ],
      });
      toast.success("Journal posted.");
      setManualJV((p) => ({
        ...p,
        narration: "",
        debitAccountId: "",
        debitAmount: "",
        creditAccountId: "",
        creditAmount: "",
      }));
      setActiveTab("journal");
      setSearchParams({ tab: "journal" });
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to post journal.");
    }
  };

  const reverseJournal = async (id) => {
    try {
      await api.post(`/accounting/journal/${id}/reverse`);
      toast.success("Journal reversed.");
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to reverse journal.");
    }
  };

  const runBackfill = async () => {
    try {
      await api.post("/accounting/backfill", { version: 1 });
      toast.success("Backfill completed.");
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Backfill failed.");
    }
  };

  const saveExpense = async (e) => {
    e.preventDefault();
    try {
      await api.post("/accounting/expenses", {
        ...expenseForm,
        amount: toInt(expenseForm.amount),
      });
      toast.success("Expense saved.");
      setExpenseForm((p) => ({ ...p, categoryName: "", amount: "", remarks: "" }));
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save expense.");
    }
  };

  const deleteExpense = async (id) => {
    try {
      await api.delete(`/accounting/expenses/${id}`);
      toast.success("Expense deleted.");
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete expense.");
    }
  };

  const tabs = (
    <div className="border-b border-emerald-200">
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
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
  );

  const filters = (
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

      <button
        type="button"
        onClick={runBackfill}
        className="ml-auto px-3 py-2 rounded border border-emerald-600 text-emerald-700 text-sm hover:bg-emerald-50"
      >
        Run Backfill
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      {tabs}
      {filters}

      {loading && <div className="text-sm text-gray-500">Loading...</div>}

      {activeTab === "daybook" && !loading && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <DataTable
            title="Day Book"
            columns={[
              { key: "date", label: "Date", render: (v) => fmtDate(v) },
              { key: "type", label: "Type" },
              { key: "party", label: "Party" },
              { key: "description", label: "Description" },
              { key: "inflow", label: "Inflow", render: (v) => money(v) },
              { key: "outflow", label: "Outflow", render: (v) => money(v) },
            ]}
            data={daybook}
          />
        </div>
      )}

      {activeTab === "ledger" && !loading && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <DataTable
            title="Ledger"
            columns={[
              { key: "date", label: "Date", render: (v) => fmtDate(v) },
              { key: "account", label: "Account" },
              { key: "description", label: "Description" },
              { key: "debit", label: "Debit", render: (v) => money(v) },
              { key: "credit", label: "Credit", render: (v) => money(v) },
              { key: "balance", label: "Balance", render: (v) => money(v) },
            ]}
            data={ledger}
          />
        </div>
      )}

      {activeTab === "journal" && !loading && (
        <div className="space-y-4">
          <form onSubmit={postManualJournal} className="bg-white rounded-lg border border-gray-200 p-4 grid md:grid-cols-3 gap-3">
            <div className="md:col-span-3 text-sm font-semibold text-emerald-800">Post Manual Journal Voucher</div>
            <input
              type="date"
              value={manualJV.date}
              onChange={(e) => setManualJV((p) => ({ ...p, date: e.target.value }))}
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            />
            <input
              value={manualJV.narration}
              onChange={(e) => setManualJV((p) => ({ ...p, narration: e.target.value }))}
              placeholder="Narration"
              className="border border-gray-300 rounded px-3 py-2 text-sm md:col-span-2"
            />
            <select
              value={manualJV.debitAccountId}
              onChange={(e) => setManualJV((p) => ({ ...p, debitAccountId: e.target.value }))}
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="">Debit Account</option>
              {accounts.map((a) => (
                <option key={a._id} value={a._id}>{a.code} - {a.name}</option>
              ))}
            </select>
            <input
              value={manualJV.debitAmount}
              onChange={(e) => setManualJV((p) => ({ ...p, debitAmount: String(e.target.value).replace(/\D/g, "") }))}
              placeholder="Debit Amount"
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            />
            <div />
            <select
              value={manualJV.creditAccountId}
              onChange={(e) => setManualJV((p) => ({ ...p, creditAccountId: e.target.value }))}
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="">Credit Account</option>
              {accounts.map((a) => (
                <option key={a._id} value={a._id}>{a.code} - {a.name}</option>
              ))}
            </select>
            <input
              value={manualJV.creditAmount}
              onChange={(e) => setManualJV((p) => ({ ...p, creditAmount: String(e.target.value).replace(/\D/g, "") }))}
              placeholder="Credit Amount"
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            />
            <div className="flex justify-end md:col-span-3">
              <button className="px-3 py-2 rounded bg-emerald-600 text-white text-sm">Post Journal</button>
            </div>
          </form>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <DataTable
              title="Journal Entries"
              columns={[
                { key: "date", label: "Date", render: (v) => fmtDate(v) },
                { key: "voucherNo", label: "Voucher #" },
                { key: "sourceModule", label: "Source" },
                { key: "narration", label: "Narration" },
                { key: "status", label: "Status" },
                {
                  key: "action",
                  label: "Action",
                  skipExport: true,
                  render: (_v, row) => (
                    <button
                      type="button"
                      disabled={row.status !== "POSTED"}
                      onClick={() => reverseJournal(row._id)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-300 text-xs disabled:opacity-50"
                    >
                      <RotateCcw size={13} /> Reverse
                    </button>
                  ),
                },
              ]}
              data={journal}
            />
          </div>
        </div>
      )}

      {activeTab === "trial" && !loading && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <DataTable
            title="Trial Balance"
            columns={[
              { key: "code", label: "Code" },
              { key: "account", label: "Account" },
              { key: "debit", label: "Debit", render: (v) => money(v) },
              { key: "credit", label: "Credit", render: (v) => money(v) },
            ]}
            data={trial}
          />
        </div>
      )}

      {activeTab === "pl" && !loading && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <DataTable
            title="Profit & Loss"
            columns={[
              { key: "line", label: "Particular" },
              { key: "amount", label: "Amount", render: (v) => money(v) },
            ]}
            data={[
              { id: 1, line: "Sales Revenue", amount: toInt(pl.salesTotal) },
              { id: 2, line: "Cost of Goods Sold", amount: -toInt(pl.cogsTotal) },
              { id: 3, line: "Purchases Expense", amount: -toInt(pl.purchasesTotal) },
              { id: 4, line: "Operating Expense", amount: -toInt(pl.expenseTotal) },
              { id: 5, line: "Payroll Expense", amount: -toInt(pl.payrollTotal) },
              { id: 6, line: "Net Profit / (Loss)", amount: toInt(pl.profit) },
            ]}
            idKey="id"
          />
        </div>
      )}

      {activeTab === "balance" && !loading && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <DataTable
            title="Balance Sheet"
            columns={[
              { key: "section", label: "Section" },
              { key: "line", label: "Particular" },
              { key: "amount", label: "Amount", render: (v) => money(v) },
            ]}
            data={[
              { id: 1, section: "Assets", line: "Cash & Bank", amount: toInt(balance.assets?.cash) },
              { id: 2, section: "Assets", line: "Accounts Receivable", amount: toInt(balance.assets?.receivables) },
              { id: 3, section: "Assets", line: "Inventory", amount: toInt(balance.assets?.inventory) },
              { id: 4, section: "Assets", line: "Fixed Assets", amount: toInt(balance.assets?.fixedAssets) },
              { id: 5, section: "Liabilities", line: "Accounts Payable", amount: toInt(balance.liabilities?.payables) },
              { id: 6, section: "Liabilities", line: "Long-term Liabilities", amount: toInt(balance.liabilities?.longTerm) },
              { id: 7, section: "Equity", line: "Owner Equity", amount: toInt(balance.equity) },
            ]}
            idKey="id"
          />
        </div>
      )}

      {activeTab === "receivables" && !loading && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <DataTable
            title="Outstanding Receivables"
            columns={[
              { key: "date", label: "Date", render: (v) => fmtDate(v) },
              { key: "invoiceNo", label: "Invoice #" },
              { key: "party", label: "Customer" },
              { key: "totalAmount", label: "Total", render: (v) => money(v) },
              { key: "paid", label: "Paid", render: (v) => money(v) },
              { key: "outstanding", label: "Outstanding", render: (v) => money(v) },
              { key: "dueDate", label: "Due", render: (v) => fmtDate(v) },
            ]}
            data={receivables}
          />
        </div>
      )}

      {activeTab === "payables" && !loading && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <DataTable
            title="Outstanding Payables"
            columns={[
              { key: "date", label: "Date", render: (v) => fmtDate(v) },
              { key: "invoiceNo", label: "Invoice #" },
              { key: "party", label: "Supplier" },
              { key: "totalAmount", label: "Total", render: (v) => money(v) },
              { key: "paid", label: "Paid", render: (v) => money(v) },
              { key: "outstanding", label: "Outstanding", render: (v) => money(v) },
              { key: "dueDate", label: "Due", render: (v) => fmtDate(v) },
            ]}
            data={payables}
          />
        </div>
      )}

      {activeTab === "accounts" && !loading && (
        <div className="grid lg:grid-cols-3 gap-4">
          <form onSubmit={saveAccount} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
            <div className="text-sm font-semibold text-emerald-800 inline-flex items-center gap-1">
              <Plus size={14} /> Add Account
            </div>
            <input
              value={newAccount.code}
              onChange={(e) => setNewAccount((p) => ({ ...p, code: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
              placeholder="Code (e.g. 4100)"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              required
            />
            <input
              value={newAccount.name}
              onChange={(e) => setNewAccount((p) => ({ ...p, name: e.target.value }))}
              placeholder="Account Name"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              required
            />
            <select
              value={newAccount.type}
              onChange={(e) => setNewAccount((p) => ({ ...p, type: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input
              value={newAccount.subType}
              onChange={(e) => setNewAccount((p) => ({ ...p, subType: e.target.value }))}
              placeholder="Sub type"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
            <div className="flex justify-end">
              <button className="px-3 py-2 rounded bg-emerald-600 text-white text-sm">Save Account</button>
            </div>
          </form>

          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm p-4">
            <DataTable
              title="Chart of Accounts"
              columns={[
                { key: "code", label: "Code" },
                { key: "name", label: "Name" },
                { key: "type", label: "Type" },
                { key: "subType", label: "Sub Type" },
                { key: "isActive", label: "Active", render: (v) => (v ? "Yes" : "No") },
              ]}
              data={accounts}
            />
          </div>
        </div>
      )}

      {activeTab === "expenses" && !loading && (
        <div className="grid lg:grid-cols-3 gap-4">
          <form onSubmit={saveExpense} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
            <div className="text-sm font-semibold text-emerald-800">Add Expense</div>
            <input
              type="date"
              value={expenseForm.date}
              onChange={(e) => setExpenseForm((p) => ({ ...p, date: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
            <input
              value={expenseForm.categoryName}
              onChange={(e) => setExpenseForm((p) => ({ ...p, categoryName: e.target.value }))}
              placeholder="Category"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              required
            />
            <input
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm((p) => ({ ...p, amount: String(e.target.value).replace(/\D/g, "").slice(0, 10) }))}
              placeholder="Amount"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              required
            />
            <select
              value={expenseForm.paymentMethod}
              onChange={(e) => setExpenseForm((p) => ({ ...p, paymentMethod: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="CASH">Cash</option>
              <option value="BANK">Bank</option>
              <option value="ONLINE_TRANSFER">Online Transfer</option>
            </select>
            <input
              value={expenseForm.remarks}
              onChange={(e) => setExpenseForm((p) => ({ ...p, remarks: e.target.value }))}
              placeholder="Remarks"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
            <div className="flex justify-end">
              <button className="px-3 py-2 rounded bg-emerald-600 text-white text-sm">Save Expense</button>
            </div>
          </form>

          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm p-4">
            <DataTable
              title="Expenses"
              columns={[
                { key: "date", label: "Date", render: (v) => fmtDate(v) },
                { key: "categoryName", label: "Category" },
                { key: "amount", label: "Amount", render: (v) => money(v) },
                { key: "paymentMethod", label: "Payment" },
                { key: "remarks", label: "Remarks" },
                {
                  key: "action",
                  label: "Action",
                  skipExport: true,
                  render: (_v, row) => (
                    <button
                      type="button"
                      onClick={() => deleteExpense(row._id)}
                      className="px-2 py-1 rounded border border-red-200 text-red-600 text-xs"
                    >
                      Delete
                    </button>
                  ),
                },
              ]}
              data={expenses}
            />
          </div>
        </div>
      )}
    </div>
  );
}
