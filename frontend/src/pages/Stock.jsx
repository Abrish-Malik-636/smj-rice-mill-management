// src/pages/Stock.jsx
import React, { useEffect, useState, useMemo } from "react";
import api from "../services/api";
import { Filter, X } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const COLORS = [
  "#0EA5E9",
  "#22C55E",
  "#A855F7",
  "#F97316",
  "#EC4899",
  "#6366F1",
  "#14B8A6",
  "#10B981",
];

const LOW_STOCK_THRESHOLD = 500;
const EXTREME_LOW_THRESHOLD = 300;

export default function Stock() {
  const [stockRows, setStockRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [companyFilter, setCompanyFilter] = useState("ALL");
  const [productFilter, setProductFilter] = useState("ALL");

  const [dateMode, setDateMode] = useState("RANGE"); // RANGE | TODAY
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [showFilters, setShowFilters] = useState(false);

  // --------------------------------------------------------------------
  // LOAD DATA
  // --------------------------------------------------------------------
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const stockRes = await api.get("/stock/current");
      setStockRows(stockRes.data.data || []);
    } catch (err) {
      toast.error("Failed to load stock data");
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------------------------------
  // ALL OPTIONS
  // --------------------------------------------------------------------
  const allCompanies = useMemo(() => {
    const s = new Set();
    stockRows.forEach((r) => r.companyName && s.add(r.companyName));
    return Array.from(s);
  }, [stockRows]);

  const allProducts = useMemo(() => {
    const s = new Set();
    stockRows.forEach((r) => r.productTypeName && s.add(r.productTypeName));
    return Array.from(s);
  }, [stockRows]);

  // --------------------------------------------------------------------
  // DEPENDENT PRODUCT LIST
  // --------------------------------------------------------------------
  const filteredProducts = useMemo(() => {
    if (companyFilter === "ALL") return allProducts;

    const s = new Set();
    stockRows.forEach((r) => {
      if (r.companyName === companyFilter) s.add(r.productTypeName);
    });

    return Array.from(s);
  }, [companyFilter, stockRows, allProducts]);

  useEffect(() => {
    if (productFilter !== "ALL" && !filteredProducts.includes(productFilter)) {
      setProductFilter("ALL");
    }
  }, [filteredProducts]);

  // --------------------------------------------------------------------
  // DEPENDENT COMPANY LIST
  // --------------------------------------------------------------------
  const filteredCompanies = useMemo(() => {
    if (productFilter === "ALL") return allCompanies;

    const s = new Set();
    stockRows.forEach((r) => {
      if (r.productTypeName === productFilter) s.add(r.companyName);
    });

    return Array.from(s);
  }, [productFilter, stockRows, allCompanies]);

  useEffect(() => {
    if (companyFilter !== "ALL" && !filteredCompanies.includes(companyFilter)) {
      setCompanyFilter("ALL");
    }
  }, [filteredCompanies]);

  // --------------------------------------------------------------------
  // DATE FILTER LOGIC
  // applies on BOTH createdAt OR lastUpdated
  // --------------------------------------------------------------------
  function recordMatchesDate(row) {
    const created = row.createdAt ? new Date(row.createdAt) : null;
    const updated = row.lastUpdated ? new Date(row.lastUpdated) : null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dateMode === "TODAY") {
      if ((created && created >= today) || (updated && updated >= today)) {
        return true;
      }
      return false;
    }

    // RANGE MODE
    if (!dateFrom || !dateTo) return true;

    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);

    const createdMatch = created && created >= from && created <= to;
    const updatedMatch = updated && updated >= from && updated <= to;

    return createdMatch || updatedMatch;
  }

  // --------------------------------------------------------------------
  // APPLY FILTERS (auto, no button)
  // --------------------------------------------------------------------
  const filteredRows = useMemo(() => {
    return stockRows.filter((r) => {
      const matchCompany =
        companyFilter === "ALL" || r.companyName === companyFilter;
      const matchProduct =
        productFilter === "ALL" || r.productTypeName === productFilter;

      const matchDate = recordMatchesDate(r);

      return matchCompany && matchProduct && matchDate;
    });
  }, [stockRows, companyFilter, productFilter, dateMode, dateFrom, dateTo]);

  // --------------------------------------------------------------------
  // DONUT LOGIC (auto adapt by filter)
  // --------------------------------------------------------------------
  const donutData = useMemo(() => {
    const map = new Map();

    if (companyFilter !== "ALL") {
      filteredRows.forEach((r) => {
        const key = r.productTypeName;
        map.set(key, (map.get(key) || 0) + (r.balanceKg || 0));
      });
    } else if (productFilter !== "ALL") {
      filteredRows.forEach((r) => {
        const key = r.companyName;
        map.set(key, (map.get(key) || 0) + (r.balanceKg || 0));
      });
    } else {
      filteredRows.forEach((r) => {
        const key = r.productTypeName;
        map.set(key, (map.get(key) || 0) + (r.balanceKg || 0));
      });
    }

    return Array.from(map.entries()).map(([name, value]) => ({
      name,
      value: +value.toFixed(2),
    }));
  }, [filteredRows, companyFilter, productFilter]);

  // --------------------------------------------------------------------
  // STATUS LOGIC
  // --------------------------------------------------------------------
  function statusOf(r) {
    const w = r.balanceKg || 0;
    if (w <= 0) return "OUT";
    if (w <= EXTREME_LOW_THRESHOLD) return "EXTREME_LOW";
    if (w <= LOW_STOCK_THRESHOLD) return "LOW";
    return "OK";
  }

  function rowColor(status) {
    if (status === "OUT") return "bg-red-50";
    if (status === "EXTREME_LOW") return "bg-red-100";
    if (status === "LOW") return "bg-yellow-50";
    return "bg-green-50";
  }

  function statusBadge(status) {
    if (status === "OUT")
      return <span className="text-red-700 font-semibold">Out of Stock</span>;

    if (status === "EXTREME_LOW")
      return <span className="text-red-600 font-semibold">Extreme Low</span>;

    if (status === "LOW")
      return <span className="text-yellow-600 font-semibold">Low Stock</span>;

    return <span className="text-green-600 font-semibold">Available</span>;
  }

  // --------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------
  return (
    <div className="space-y-6 w-full">
      <Toaster />

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-emerald-800">
          Stock Overview
        </h2>

        <button
          className="p-2 rounded-lg hover:bg-gray-100"
          onClick={() => setShowFilters(true)}
        >
          <Filter size={18} className="text-gray-600" />
        </button>
      </div>

      {/* FILTER POPUP */}
      {showFilters && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 w-80 shadow-xl relative">
            <button
              className="absolute top-2 right-2 text-gray-500"
              onClick={() => setShowFilters(false)}
            >
              <X size={18} />
            </button>

            <h3 className="text-sm font-semibold text-emerald-800 mb-3">
              Filters
            </h3>

            {/* COMPANY */}
            <label className="text-xs text-gray-600">Company</label>
            <select
              className="w-full border p-2 rounded text-sm mb-3"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
            >
              <option value="ALL">All Companies</option>
              {filteredCompanies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* PRODUCT */}
            <label className="text-xs text-gray-600">Product</label>
            <select
              className="w-full border p-2 rounded text-sm mb-4"
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
            >
              <option value="ALL">All Products</option>
              {filteredProducts.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            {/* DATE FILTER */}
            <label className="text-xs text-gray-600 mb-1 block">
              Date Filter
            </label>

            <div className="flex items-center gap-3 mb-3 text-sm">
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="dateMode"
                  value="RANGE"
                  checked={dateMode === "RANGE"}
                  onChange={() => setDateMode("RANGE")}
                />
                Range
              </label>

              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="dateMode"
                  value="TODAY"
                  checked={dateMode === "TODAY"}
                  onChange={() => setDateMode("TODAY")}
                />
                Today
              </label>
            </div>

            {dateMode === "RANGE" && (
              <div className="space-y-2 mb-4">
                <div>
                  <label className="text-xs text-gray-600">From</label>
                  <input
                    type="date"
                    className="w-full border p-2 rounded text-sm"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-600">To</label>
                  <input
                    type="date"
                    className="w-full border p-2 rounded text-sm"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MAIN GRID (TABLE LEFT, DONUT RIGHT) */}
      <div className="grid grid-cols-12 gap-4">
        {/* LEFT: TABLE */}
        <div className="col-span-8 bg-white rounded-lg shadow p-4">
          <div className="text-sm font-semibold text-emerald-800 mb-2">
            Stock Items
          </div>

          <table className="w-full text-xs border rounded">
            <thead className="bg-emerald-50 text-emerald-800">
              <tr>
                <th className="p-2 text-left">Product</th>
                <th className="p-2 text-left">Company</th>
                <th className="p-2 text-right">Stock (kg)</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Updated</th>
              </tr>
            </thead>

            <tbody>
              {!loading &&
                filteredRows.map((r, idx) => {
                  const status = statusOf(r);
                  return (
                    <tr key={idx} className={rowColor(status)}>
                      <td className="p-2">{r.productTypeName}</td>
                      <td className="p-2">{r.companyName}</td>
                      <td className="p-2 text-right">
                        {r.balanceKg.toFixed(2)}
                      </td>
                      <td className="p-2">{statusBadge(status)}</td>
                      <td className="p-2 text-[10px] text-gray-500">
                        {r.lastUpdated
                          ? new Date(r.lastUpdated).toLocaleString()
                          : "-"}
                      </td>
                    </tr>
                  );
                })}

              {!loading && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-gray-400">
                    No stock records found.
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-gray-400">
                    Loading...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* RIGHT: DONUT */}
        <div className="col-span-4 bg-white rounded-lg shadow p-4">
          <div className="text-sm font-semibold text-emerald-800 mb-2">
            Stock Distribution
          </div>

          <div className="h-64">
            {donutData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={40}
                    outerRadius={80}
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: "10px" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                No data to display
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
