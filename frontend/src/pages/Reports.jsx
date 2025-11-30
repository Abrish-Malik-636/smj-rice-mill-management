// frontend/src/pages/Reports.jsx
import { useEffect, useMemo, useState } from "react";
import { BarChart3, Filter, RefreshCcw } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import toast from "react-hot-toast";
import api from "../services/api";

const DATE_RANGES = [
  { id: "today", label: "Today" },
  { id: "this_week", label: "This Week" },
  { id: "this_month", label: "This Month" },
  { id: "custom", label: "Custom" },
];

const TYPE_OPTIONS = [
  { id: "ALL", label: "All Types" },
  { id: "SALE", label: "Sales" },
  { id: "PURCHASE", label: "Purchases" },
];

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfWeek() {
  const d = new Date();
  const day = d.getDay(); // 0-6
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateInputValue(date) {
  return date.toISOString().slice(0, 10);
}

function formatDateLabel(dateString) {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString();
}

export default function Reports() {
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [filters, setFilters] = useState({
    dateRange: "today",
    customFrom: "",
    customTo: "",
    type: "ALL",
    companyId: "ALL",
  });

  // Load companies once (for filter dropdown)
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await api.get("/companies");
        setCompanies(res.data?.data || res.data || []);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load companies for filters.");
      }
    };
    fetchCompanies();
  }, []);

  // Build query params based on filters
  const buildQueryParams = () => {
    const params = {};

    // type filter
    if (filters.type !== "ALL") {
      params.type = filters.type;
    }

    // company filter
    if (filters.companyId !== "ALL") {
      params.companyId = filters.companyId;
    }

    // date filters
    if (filters.dateRange === "today") {
      const s = toDateInputValue(startOfToday());
      const e = toDateInputValue(endOfToday());
      params.startDate = s;
      params.endDate = e;
    } else if (filters.dateRange === "this_week") {
      const s = toDateInputValue(startOfWeek());
      const e = toDateInputValue(endOfToday());
      params.startDate = s;
      params.endDate = e;
    } else if (filters.dateRange === "this_month") {
      const s = toDateInputValue(startOfMonth());
      const e = toDateInputValue(endOfToday());
      params.startDate = s;
      params.endDate = e;
    } else if (
      filters.dateRange === "custom" &&
      filters.customFrom &&
      filters.customTo
    ) {
      params.startDate = filters.customFrom;
      params.endDate = filters.customTo;
    }

    return params;
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = buildQueryParams();
      const res = await api.get("/transactions", { params });
      setTransactions(res.data?.data || res.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load report data.");
    } finally {
      setLoading(false);
    }
  };

  // Load on mount + whenever filters change
  useEffect(() => {
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.dateRange,
    filters.customFrom,
    filters.customTo,
    filters.type,
    filters.companyId,
  ]);

  const { totals, chartData } = useMemo(() => {
    const totals = {
      sales: 0,
      purchases: 0,
    };

    const byDateMap = new Map();

    for (const t of transactions || []) {
      const amount = Number(t.totalAmount || 0);
      if (t.type === "SALE") totals.sales += amount;
      if (t.type === "PURCHASE") totals.purchases += amount;

      const dateKey = (t.date || "").slice(0, 10);
      const existing = byDateMap.get(dateKey) || {
        date: dateKey,
        label: formatDateLabel(t.date),
        sales: 0,
        purchases: 0,
      };
      if (t.type === "SALE") existing.sales += amount;
      if (t.type === "PURCHASE") existing.purchases += amount;
      byDateMap.set(dateKey, existing);
    }

    const chartData = Array.from(byDateMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    return { totals, chartData };
  }, [transactions]);

  const net = totals.sales - totals.purchases;

  const handleResetFilters = () => {
    setFilters({
      dateRange: "today",
      customFrom: "",
      customTo: "",
      type: "ALL",
      companyId: "ALL",
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-50">
            <BarChart3 className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-gray-800">
              Reports &amp; Analytics
            </h1>
            <p className="text-sm text-gray-500">
              Transaction summary by date, type and company.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchTransactions}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white hover:bg-gray-50 shadow-sm"
        >
          <RefreshCcw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Filter className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-medium text-gray-700">Filters</h2>
        </div>

        <div className="flex flex-col md:flex-row md:items-end gap-4">
          {/* Date range */}
          <div className="flex-1 space-y-2">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
              Date Range
            </label>
            <div className="flex flex-wrap gap-2">
              {DATE_RANGES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() =>
                    setFilters((prev) => ({ ...prev, dateRange: r.id }))
                  }
                  className={`px-3 py-1.5 text-xs rounded-full border ${
                    filters.dateRange === r.id
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {filters.dateRange === "custom" && (
              <div className="mt-2 flex flex-wrap gap-3">
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 mb-1">From</span>
                  <input
                    type="date"
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    value={filters.customFrom}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        customFrom: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 mb-1">To</span>
                  <input
                    type="date"
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    value={filters.customTo}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        customTo: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            )}
          </div>

          {/* Type */}
          <div className="w-full md:w-52 space-y-2">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
              Transaction Type
            </label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              value={filters.type}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, type: e.target.value }))
              }
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Company */}
          <div className="w-full md:w-64 space-y-2">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
              Company
            </label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              value={filters.companyId}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, companyId: e.target.value }))
              }
            >
              <option value="ALL">All Companies</option>
              {companies.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Reset */}
          <div className="flex md:block">
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-2 md:mt-0 inline-flex items-center justify-center px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Summary cards */}
        <div className="xl:col-span-1 space-y-3">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Summary
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Sales</span>
                <span className="text-base font-semibold text-emerald-600">
                  {totals.sales.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Purchases</span>
                <span className="text-base font-semibold text-blue-600">
                  {totals.purchases.toFixed(2)}
                </span>
              </div>
              <div className="border-t border-gray-100 pt-3 mt-1 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  Net (Sales – Purchases)
                </span>
                <span
                  className={`text-base font-semibold ${
                    net >= 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {net.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-sm text-gray-600">
            <p className="mb-1">
              <span className="font-medium">Hint:</span> Use this report to
              review period-wise performance of sales and purchases, and to
              quickly drill down by company.
            </p>
          </div>
        </div>

        {/* Chart + table */}
        <div className="xl:col-span-2 space-y-4">
          {/* Chart */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 h-72">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">
                Sales vs Purchases (by Date)
              </h3>
              {loading && (
                <span className="text-xs text-gray-400">Loading...</span>
              )}
            </div>

            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-gray-400">
                No data for the selected filters.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 8, right: 16, bottom: 4, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="sales" name="Sales" />
                  <Bar dataKey="purchases" name="Purchases" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">
                Transactions ({transactions.length})
              </h3>
              {loading && (
                <span className="text-xs text-gray-400">Loading...</span>
              )}
            </div>

            {transactions.length === 0 && !loading ? (
              <div className="p-4 text-sm text-gray-400">
                No transactions found for the selected filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">
                        Date
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">
                        Invoice #
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">
                        Company
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">
                        Type
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">
                        Amount
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">
                        Payment
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t) => (
                      <tr
                        key={t._id}
                        className="border-t border-gray-50 hover:bg-gray-50/60"
                      >
                        <td className="px-4 py-2 whitespace-nowrap text-gray-700">
                          {formatDateLabel(t.date)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap font-mono text-xs text-gray-700">
                          {t.invoiceNo}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-gray-700">
                          {t.companyName}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              t.type === "SALE"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-blue-50 text-blue-700"
                            }`}
                          >
                            {t.type}
                          </span>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-right text-gray-800">
                          {Number(t.totalAmount || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-gray-700">
                          <span className="text-xs font-medium">
                            {t.paymentStatus}
                          </span>
                          {t.paymentMethod && (
                            <span className="ml-1 text-xs text-gray-400">
                              • {t.paymentMethod}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
