// src/pages/Stock.jsx
import React, { useEffect, useState, useMemo } from "react";
import api from "../services/api";
import {
  Package,
  Layers,
  AlertTriangle,
  CircleDot,
  RefreshCcw,
  Filter,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const CHART_COLORS = [
  "#0EA5E9",
  "#22C55E",
  "#A855F7",
  "#F97316",
  "#EC4899",
  "#6366F1",
  "#14B8A6",
];

const LOW_STOCK_THRESHOLD_KG = 500;

export default function Stock() {
  return (
    <div className="space-y-6 w-full">
      <Toaster />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-emerald-800 flex items-center gap-2">
            <Package size={20} />
            Stock Management
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Live overview of paddy in process and finished stock with product
            and company-wise filters.
          </p>
        </div>
      </div>

      <StockOverview />
    </div>
  );
}

function StockOverview() {
  const [stockRows, setStockRows] = useState([]);
  const [inProcessBatches, setInProcessBatches] = useState([]);
  const [loading, setLoading] = useState(false);

  const [productFilter, setProductFilter] = useState("ALL");
  const [companyFilter, setCompanyFilter] = useState("ALL");
  const [chartMode, setChartMode] = useState("PRODUCT"); // PRODUCT | COMPANY

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [stockRes, processRes] = await Promise.all([
        api.get("/stock/current"),
        api.get("/production/batches", {
          params: { status: "IN_PROCESS", limit: 200 },
        }),
      ]);

      setStockRows(stockRes.data.data || []);
      setInProcessBatches(processRes.data.data || []);
    } catch (err) {
      toast.error("Failed to load stock data");
    } finally {
      setLoading(false);
    }
  }

  // In-process paddy = sum of paddyWeightKg for IN_PROCESS batches
  const inProcessPaddyKg = useMemo(() => {
    return (inProcessBatches || []).reduce(
      (sum, b) => sum + (b.paddyWeightKg || 0),
      0
    );
  }, [inProcessBatches]);

  // Combined rows from backend
  const combinedRows = useMemo(() => {
    return (stockRows || []).map((r) => ({
      ...r,
      // 👇 THIS is the key fix: use balanceKg from backend
      stockWeight: r.balanceKg || 0,
    }));
  }, [stockRows]);

  // Filter options
  const productOptions = useMemo(() => {
    const set = new Set();
    combinedRows.forEach((r) => {
      if (r.productTypeName) set.add(r.productTypeName);
    });
    return Array.from(set).sort();
  }, [combinedRows]);

  const companyOptions = useMemo(() => {
    const set = new Set();
    combinedRows.forEach((r) => {
      if (r.companyName) set.add(r.companyName);
    });
    return Array.from(set).sort();
  }, [combinedRows]);

  // Apply filters
  const filteredRows = useMemo(() => {
    return combinedRows.filter((r) => {
      const matchProduct =
        productFilter === "ALL" || r.productTypeName === productFilter;
      const matchCompany =
        companyFilter === "ALL" || r.companyName === companyFilter;
      return matchProduct && matchCompany;
    });
  }, [combinedRows, productFilter, companyFilter]);

  // Global summary (cards always use ALL stock)
  const totalStockKg = combinedRows.reduce(
    (sum, r) => sum + (r.stockWeight || 0),
    0
  );

  const productTypesCount = new Set(
    combinedRows.map((r) => r.productTypeId || r.productTypeName)
  ).size;

  const lowItemsCount = combinedRows.filter((r) => {
    if (r.stockWeight <= 0) return true;
    if (r.stockWeight > 0 && r.stockWeight <= LOW_STOCK_THRESHOLD_KG)
      return true;
    return false;
  }).length;

  // Chart data depends on chart mode + FILTERED rows
  const chartData = useMemo(() => {
    const byKey = new Map();

    if (chartMode === "PRODUCT") {
      filteredRows.forEach((r) => {
        const key = r.productTypeName || "Unknown";
        const prev = byKey.get(key) || 0;
        byKey.set(key, prev + (r.stockWeight || 0));
      });
    } else {
      filteredRows.forEach((r) => {
        const key = r.companyName || "No Company";
        const prev = byKey.get(key) || 0;
        byKey.set(key, prev + (r.stockWeight || 0));
      });
    }

    const arr = Array.from(byKey.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const top5 = arr.slice(0, 5);
    const others = arr.slice(5).reduce((sum, x) => sum + x.value, 0);
    if (others > 0) {
      top5.push({ name: "Others", value: others });
    }
    return top5;
  }, [filteredRows, chartMode]);

  function getStatus(row) {
    if (row.stockWeight <= 0) return "OUT";
    if (row.stockWeight > 0 && row.stockWeight <= LOW_STOCK_THRESHOLD_KG)
      return "LOW";
    return "OK";
  }

  function statusClass(status) {
    if (status === "OUT") return "text-rose-600";
    if (status === "LOW") return "text-amber-500";
    return "text-emerald-600";
  }

  function statusDotClass(status) {
    if (status === "OUT") return "bg-rose-500 animate-pulse";
    if (status === "LOW") return "bg-amber-400 animate-pulse";
    return "bg-emerald-500";
  }

  const filtersActive = productFilter !== "ALL" || companyFilter !== "ALL";

  return (
    <div className="space-y-5">
      {/* Cards (overall summary) */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow border-l-4 border-emerald-400 p-4">
          <div className="flex justify-between">
            <div>
              <div className="text-xs text-gray-500">Total Stock</div>
              <div className="text-2xl font-bold text-emerald-800">
                {totalStockKg.toFixed(2)} kg
              </div>
            </div>
            <div className="bg-emerald-100 p-2 rounded-full">
              <Package className="text-emerald-700" size={20} />
            </div>
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            Finished & raw stock currently in system (all products & companies)
          </div>
        </div>

        <div className="bg-white rounded-xl shadow border-l-4 border-sky-300 p-4">
          <div className="flex justify-between">
            <div>
              <div className="text-xs text-gray-500">Paddy In Process</div>
              <div className="text-2xl font-bold text-sky-800">
                {inProcessPaddyKg.toFixed(2)} kg
              </div>
            </div>
            <div className="bg-sky-100 p-2 rounded-full">
              <Layers className="text-sky-700" size={20} />
            </div>
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            Total paddy assigned to running production batches
          </div>
        </div>

        <div className="bg-white rounded-xl shadow border-l-4 border-amber-300 p-4">
          <div className="flex justify-between">
            <div>
              <div className="text-xs text-gray-500">Low / Empty Items</div>
              <div className="text-2xl font-bold text-amber-600">
                {lowItemsCount}
              </div>
            </div>
            <div className="bg-amber-50 p-2 rounded-full">
              <AlertTriangle className="text-amber-500" size={20} />
            </div>
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            Items at or below {LOW_STOCK_THRESHOLD_KG} kg (per product/company)
          </div>
        </div>

        <div className="bg-white rounded-xl shadow border-l-4 border-violet-200 p-4">
          <div className="flex justify-between">
            <div>
              <div className="text-xs text-gray-500">Product Types</div>
              <div className="text-2xl font-bold text-violet-800">
                {productTypesCount}
              </div>
            </div>
            <div className="bg-violet-100 p-2 rounded-full">
              <CircleDot className="text-violet-700" size={20} />
            </div>
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            Distinct products currently present in stock
          </div>
        </div>
      </div>

      {/* Filters + Refresh */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1 text-gray-600">
            <Filter size={14} />
            <span className="font-semibold">Filters:</span>
          </div>

          {/* Product filter */}
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="border rounded px-2 py-1 bg-white"
          >
            <option value="ALL">All Products</option>
            {productOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          {/* Company filter */}
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="border rounded px-2 py-1 bg-white"
          >
            <option value="ALL">All Companies</option>
            {companyOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {filtersActive && (
            <button
              onClick={() => {
                setProductFilter("ALL");
                setCompanyFilter("ALL");
              }}
              className="text-[11px] px-2 py-1 border rounded bg-gray-50 hover:bg-gray-100"
            >
              Clear Filters
            </button>
          )}

          {filtersActive && (
            <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              Showing filtered stock view
            </span>
          )}
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-1 text-xs px-3 py-1 border rounded-lg text-emerald-700 hover:bg-emerald-50"
        >
          <RefreshCcw size={14} />
          Refresh
        </button>
      </div>

      {/* Table (left) + Chart (right) */}
      <div className="grid grid-cols-12 gap-4">
        {/* Stock table LEFT */}
        <div className="col-span-8 bg-white rounded-xl shadow border overflow-hidden">
          <div className="p-3 border-b flex items-center justify-between">
            <div className="text-sm font-semibold text-emerald-800">
              Stock Details
            </div>
            <div className="text-[11px] text-gray-400">
              Product & company-wise stock levels{" "}
              {filtersActive && <span>(filtered)</span>}
            </div>
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#E6F9F0] text-emerald-800 sticky top-0 z-10">
                <tr>
                  <th className="p-2 text-left">Product</th>
                  <th className="p-2 text-left">Company</th>
                  <th className="p-2 text-right">Stock (kg)</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {!loading &&
                  filteredRows.map((r, idx) => {
                    const status = getStatus(r);
                    return (
                      <tr
                        key={`${r.productTypeId || r.productTypeName}__${
                          r.companyId || r.companyName || idx
                        }`}
                        className={idx % 2 ? "bg-white" : "bg-gray-50"}
                      >
                        <td className="p-2">{r.productTypeName || "-"}</td>
                        <td className="p-2">{r.companyName || "-"}</td>
                        <td className="p-2 text-right">
                          {r.stockWeight.toFixed(2)}
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <span
                              className={`w-2 h-2 rounded-full ${statusDotClass(
                                status
                              )}`}
                            ></span>
                            <span
                              className={`font-semibold ${statusClass(status)}`}
                            >
                              {status === "OK"
                                ? "In Stock"
                                : status === "LOW"
                                ? "Low Stock"
                                : "Out of Stock"}
                            </span>
                          </div>
                        </td>
                        <td className="p-2 text-[11px] text-gray-500">
                          {r.lastUpdated
                            ? new Date(r.lastUpdated).toLocaleString()
                            : "-"}
                        </td>
                      </tr>
                    );
                  })}

                {!loading && filteredRows.length === 0 && (
                  <tr>
                    <td className="p-4 text-center text-gray-400" colSpan={5}>
                      {filtersActive
                        ? "No stock matches the selected filters."
                        : "No stock records found."}
                    </td>
                  </tr>
                )}

                {loading && (
                  <tr>
                    <td className="p-4 text-center text-gray-400" colSpan={5}>
                      Loading stock...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Chart RIGHT */}
        <div className="col-span-4 bg-white rounded-xl shadow border p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-sm font-semibold text-emerald-800">
                {chartMode === "PRODUCT"
                  ? "Stock Distribution by Product"
                  : "Stock Distribution by Company"}
              </div>
              <div className="text-[11px] text-gray-400">
                Donut chart reflects current filters
              </div>
            </div>

            <div className="flex text-[11px] bg-gray-100 rounded-full p-0.5">
              <button
                onClick={() => setChartMode("PRODUCT")}
                className={`px-2 py-0.5 rounded-full ${
                  chartMode === "PRODUCT"
                    ? "bg-white shadow text-emerald-700"
                    : "text-gray-500"
                }`}
              >
                Product
              </button>
              <button
                onClick={() => setChartMode("COMPANY")}
                className={`px-2 py-0.5 rounded-full ${
                  chartMode === "COMPANY"
                    ? "bg-white shadow text-emerald-700"
                    : "text-gray-500"
                }`}
              >
                Company
              </button>
            </div>
          </div>

          {/* Fixed-height chart area so it never collapses */}
          <div className="mt-2 h-64">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${entry.name}-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-xs">
                {filtersActive
                  ? "No data to display for current filters."
                  : "No stock data available for chart."}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
