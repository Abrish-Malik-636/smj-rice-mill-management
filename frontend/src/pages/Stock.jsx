// src/pages/Stock.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../services/api";
import {
  Filter,
  X,
  Info,
  Trash2,
  Lock,
  Settings,
  Download,
  FileText,
  Printer,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Pin4Input from "../components/Pin4Input";
import { ManagerialStockView } from "./ManagerialStock";
import DataTable from "../components/ui/DataTable";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

export default function Stock({ initialTab = "production" }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [stockRows, setStockRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(
    initialTab === "managerial" ? "managerial" : "production",
  );

  const [companyFilter, setCompanyFilter] = useState("ALL");
  const [productFilter, setProductFilter] = useState("ALL");

  const [dateMode, setDateMode] = useState("RANGE"); // RANGE | TODAY
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [showFilters, setShowFilters] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState("");
  const [clearPin, setClearPin] = useState("");
  const [clearing, setClearing] = useState(false);
  const [lastClearedAt, setLastClearedAt] = useState(null);
  const [sourceModalRow, setSourceModalRow] = useState(null);
  const [settings, setSettings] = useState({
    additionalStockSettingsEnabled: false,
    stockStatusExtremeLowKg: 300,
    stockStatusLowKg: 500,
  });
  const [stockThresholdsUnlocked, setStockThresholdsUnlocked] = useState(false);
  const [stockThresholdPinDialog, setStockThresholdPinDialog] = useState({
    open: false,
    pin: "",
    pinError: "",
  });
  const [stockThresholdForm, setStockThresholdForm] = useState({
    extremeLowKg: "300",
    lowKg: "500",
  });
  const [savingThresholds, setSavingThresholds] = useState(false);
  const [saveThresholdPinDialog, setSaveThresholdPinDialog] = useState({
    open: false,
    pin: "",
    pinError: "",
  });

  // --------------------------------------------------------------------
  // LOAD DATA
  // --------------------------------------------------------------------
  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await api.get("/settings");
        if (res.data?.data) setSettings(res.data.data);
      } catch {}
    };
    loadSettings();
  }, []);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await api.get("/product-types");
        setProducts(res.data?.data || []);
      } catch {}
    };
    loadProducts();
  }, []);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "production" || tab === "managerial") {
      setActiveTab(tab);
      return;
    }
    setActiveTab(initialTab === "managerial" ? "managerial" : "production");
  }, [initialTab, searchParams]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (!tab) {
      setSearchParams(
        {
          tab: initialTab === "managerial" ? "managerial" : "production",
        },
        { replace: true },
      );
    }
  }, [initialTab, searchParams, setSearchParams]);

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

  async function handleSaveStockThresholds(pinToSave) {
    const extreme = Math.max(
      0,
      Math.floor(Number(stockThresholdForm.extremeLowKg) || 0),
    );
    const low = Math.max(0, Math.floor(Number(stockThresholdForm.lowKg) || 0));
    if (extreme > low) {
      toast.error("Extreme low (kg) must be ≤ Low (kg)");
      return;
    }
    setSavingThresholds(true);
    try {
      const res = await api.put("/settings", {
        stockStatusExtremeLowKg: extreme,
        stockStatusLowKg: low,
        adminPin: pinToSave,
      });
      if (res.data?.success) {
        setSettings((s) => ({ ...s, ...res.data.data }));
        setStockThresholdForm({
          extremeLowKg: String(extreme),
          lowKg: String(low),
        });
        setSaveThresholdPinDialog({ open: false, pin: "", pinError: "" });
        toast.success("Stock status thresholds saved.");
      } else {
        setSaveThresholdPinDialog((d) => ({
          ...d,
          pinError: res.data?.message || "Failed to save.",
        }));
      }
    } catch (err) {
      setSaveThresholdPinDialog((d) => ({
        ...d,
        pinError:
          err.response?.data?.message || err.message || "Failed to save.",
      }));
    } finally {
      setSavingThresholds(false);
    }
  }

  async function handleClearAllStock() {
    if (clearConfirmText !== "REMOVE ALL STOCK") {
      toast.error('Type "REMOVE ALL STOCK" to confirm');
      return;
    }
    if (clearPin.length !== 4) {
      toast.error("Enter 4-digit admin PIN");
      return;
    }
    try {
      setClearing(true);
      await api.post("/stock/clear-ledgers", { adminPin: clearPin.trim() });
      toast.success("All previous stock has been removed.");
      setShowClearConfirm(false);
      setClearConfirmText("");
      setClearPin("");
      setLastClearedAt(Date.now());
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to clear stock");
    } finally {
      setClearing(false);
    }
  }

  // --------------------------------------------------------------------
  // ALL OPTIONS
  // --------------------------------------------------------------------
  const brandById = useMemo(() => {
    const map = new Map();
    products.forEach((p) => {
      if (p && p._id) map.set(String(p._id), p.brand || "");
    });
    return map;
  }, [products]);

  const brandByName = useMemo(() => {
    const map = new Map();
    products.forEach((p) => {
      if (p && p.name) map.set(String(p.name), p.brand || "");
    });
    return map;
  }, [products]);

  const getBrand = (row) => {
    const explicitBrand = String(row.brandName || row.companyName || "").trim();
    if (explicitBrand && explicitBrand.toLowerCase() !== "mill own stock") {
      return explicitBrand;
    }
    const byId =
      row.productTypeId != null
        ? brandById.get(String(row.productTypeId))
        : "";
    const byName = row.productTypeName
      ? brandByName.get(String(row.productTypeName))
      : "";
    return byId || byName || "Unbranded";
  };

  const allCompanies = useMemo(() => {
    const s = new Set();
    stockRows.forEach((r) => {
      const brand = getBrand(r);
      if (brand) s.add(brand);
    });
    return Array.from(s);
  }, [stockRows, brandById, brandByName]);

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
      if (getBrand(r) === companyFilter) s.add(r.productTypeName);
    });

    return Array.from(s);
  }, [companyFilter, stockRows, allProducts, brandById, brandByName]);

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
      if (r.productTypeName === productFilter) s.add(getBrand(r));
    });

    return Array.from(s);
  }, [productFilter, stockRows, allCompanies, brandById, brandByName]);

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
        companyFilter === "ALL" || getBrand(r) === companyFilter;
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
    const donutRows = filteredRows.filter((r) => {
      const name = String(r.productTypeName || "").toLowerCase();
      return !name.includes("paddy") && !name.includes("unprocess");
    });
    const map = new Map();

    if (companyFilter !== "ALL") {
      donutRows.forEach((r) => {
        const key = r.productTypeName;
        map.set(key, (map.get(key) || 0) + (r.balanceKg || 0));
      });
    } else if (productFilter !== "ALL") {
      donutRows.forEach((r) => {
        const key = getBrand(r);
        map.set(key, (map.get(key) || 0) + (r.balanceKg || 0));
      });
    } else {
      donutRows.forEach((r) => {
        const key = r.productTypeName;
        map.set(key, (map.get(key) || 0) + (r.balanceKg || 0));
      });
    }

    return Array.from(map.entries()).map(([name, value]) => ({
      name,
      value: Math.round(Number(value || 0)),
    }));
  }, [filteredRows, companyFilter, productFilter]);

  // --------------------------------------------------------------------
  // STATUS LOGIC (uses settings thresholds; 0 = out of stock)
  // --------------------------------------------------------------------
  const extremeLowKg = Number(settings.stockStatusExtremeLowKg) || 300;
  const lowKg = Number(settings.stockStatusLowKg) || 500;
  function statusOf(r) {
    const w = r.balanceKg || 0;
    if (w <= 0) return "OUT";
    if (w <= extremeLowKg) return "EXTREME_LOW";
    if (w <= lowKg) return "LOW";
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

  const stockTableData = useMemo(() => {
    const grouped = new Map();
    filteredRows.forEach((row) => {
      const brand = getBrand(row);
      const key = brand || "Unbranded";
      const existing = grouped.get(key) || {
        __rowId: key,
        companyName: key,
        balanceKg: 0,
        lastUpdated: null,
        products: [],
        sources: [],
      };
      const kg = Number(row.balanceKg || 0);
      existing.balanceKg += kg;
      existing.products.push({
        name: row.productTypeName || "Product",
        kg,
      });
      if (Array.isArray(row.sources)) {
        existing.sources.push(...row.sources);
      }
      const updated = row.lastUpdated ? new Date(row.lastUpdated) : null;
      if (updated && (!existing.lastUpdated || updated > new Date(existing.lastUpdated))) {
        existing.lastUpdated = updated.toISOString();
      }
      grouped.set(key, existing);
    });
    return Array.from(grouped.values()).map((r) => ({
      ...r,
      productsText: r.products
        .map((p) => `${p.name} (${Math.round(Number(p.kg || 0))} kg)`)
        .join(", "),
    }));
  }, [filteredRows, brandById, brandByName]);

  const stockColumns = useMemo(
    () => [
      {
        key: "__info",
        label: "",
        skipExport: true,
        render: (_value, row) => (
          <button
            type="button"
            className="p-1 rounded hover:bg-emerald-100 text-emerald-600"
            onClick={() => setSourceModalRow(row)}
            title="View source details"
          >
            <Info size={14} />
          </button>
        ),
      },
      {
        key: "companyName",
        label: "Brand",
        render: (_value, row) => getBrand(row),
      },
      {
        key: "productsText",
        label: "Products",
        render: (_value, row) => row.productsText || "-",
      },
      {
        key: "balanceKg",
        label: "Stock (kg)",
        render: (_value, row) => (
          <span className="block text-center">
            {Math.round(Number(row.balanceKg ?? 0))}
          </span>
        ),
      },
      {
        key: "__status",
        label: "Status",
        render: (_value, row) => statusBadge(statusOf(row)),
      },
      {
        key: "lastUpdated",
        label: "Updated",
        render: (_value, row) =>
          row.lastUpdated ? new Date(row.lastUpdated).toLocaleString() : "-",
      },
    ],
    [statusBadge, statusOf, brandById, brandByName],
  );

  const exportRows = useMemo(
    () =>
      stockTableData.map((r) => ({
        Brand: getBrand(r) || "-",
        Products: r.productsText || "-",
        "Stock (kg)": Math.round(Number(r.balanceKg || 0)),
        Status:
          statusOf(r) === "OUT"
            ? "Out of Stock"
            : statusOf(r) === "EXTREME_LOW"
              ? "Extreme Low"
              : statusOf(r) === "LOW"
                ? "Low Stock"
                : "Available",
        Updated: r.lastUpdated ? new Date(r.lastUpdated).toLocaleString() : "-",
      })),
    [stockTableData, statusOf, brandById, brandByName],
  );

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ProductionStock");
    XLSX.writeFile(
      wb,
      `production_stock_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  const handleExportPdf = () => {
    const doc = new jsPDF();
    const body = exportRows.map((r) => [
      r.Brand,
      r.Products,
      r["Stock (kg)"],
      r.Status,
      r.Updated,
    ]);
    doc.text("Production Stock", 14, 12);
    autoTable(doc, {
      startY: 18,
      head: [["Brand", "Products", "Stock (kg)", "Status", "Updated"]],
      body,
      styles: { fontSize: 8 },
    });
    doc.save(`production_stock_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handlePrint = () => window.print();

  // --------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------
  return (
    <div className="space-y-6 w-full">
      <Toaster />

      <div className="border-b border-emerald-200">
        <div className="flex gap-4">
          {[
            { label: "Production Stock", value: "production" },
            { label: "Managerial Stock", value: "managerial" },
          ].map((t) => {
            const isActive = activeTab === t.value;
            return (
              <button
                key={t.value}
                onClick={() => {
                  setActiveTab(t.value);
                  setSearchParams({ tab: t.value });
                }}
                className={`flex items-center gap-2 px-4 py-2 text-sm rounded-t-lg border-b-2 transition
                  ${
                    isActive
                      ? "bg-emerald-50 text-emerald-700 font-semibold border-emerald-600"
                      : "text-gray-500 border-transparent hover:text-emerald-600 hover:bg-emerald-50"
                  }`}
              >
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "managerial" ? (
        <ManagerialStockView lastClearedAt={lastClearedAt} />
      ) : (
        <>
          {/* HEADER */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-emerald-800">
                Production Stock Overview
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                className="p-2 rounded-lg hover:bg-gray-100"
                onClick={() => setShowFilters(true)}
                title="Filters"
              >
                <Filter size={16} />
              </button>
              <button
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
                onClick={handleExportExcel}
              >
                <Download size={15} /> Export Excel
              </button>
              <button
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
                onClick={handleExportPdf}
              >
                <FileText size={15} /> Export PDF
              </button>
              <button
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
                onClick={handlePrint}
              >
                <Printer size={15} /> Print
              </button>
              {settings.additionalStockSettingsEnabled && (
                <button
                  className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                  onClick={() => setShowClearConfirm(true)}
                >
                  <Trash2 size={16} />
                  Remove all previous stock
                </button>
              )}
            </div>
            </div>

          {/* Stock status thresholds placeholder (visible only when enabled in settings) */}
          {settings.additionalStockSettingsEnabled && (
          <div className="bg-white rounded-lg shadow p-4 mb-4 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                <Settings size={18} />
                Stock status thresholds
              </div>
              {!stockThresholdsUnlocked && (
                <button
                  type="button"
                  onClick={() => {
                    setStockThresholdPinDialog({
                      open: true,
                      pin: "",
                      pinError: "",
                    });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-amber-500 text-amber-700 hover:bg-amber-50"
                >
                  <Lock size={14} />
                  Unlock with PIN
                </button>
              )}
            </div>
            {!stockThresholdsUnlocked ? null : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs items-end">
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">
                    Extreme low (kg)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={stockThresholdForm.extremeLowKg}
                    onChange={(e) =>
                      setStockThresholdForm((f) => ({
                        ...f,
                        extremeLowKg:
                          e.target.value.replace(/\D/g, "").slice(0, 8) || "",
                      }))
                    }
                    placeholder="e.g. 300"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Below this = Extreme low
                  </p>
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">
                    Low (kg)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={stockThresholdForm.lowKg}
                    onChange={(e) =>
                      setStockThresholdForm((f) => ({
                        ...f,
                        lowKg:
                          e.target.value.replace(/\D/g, "").slice(0, 8) || "",
                      }))
                    }
                    placeholder="e.g. 500"
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Below this = Low; above = Okay
                  </p>
                </div>
                <div className="sm:col-span-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSaveThresholdPinDialog({
                        open: true,
                        pin: "",
                        pinError: "",
                      })
                    }
                    disabled={savingThresholds}
                    className="px-3 py-1.5 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {savingThresholds ? "Saving…" : "Save thresholds"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockThresholdsUnlocked(false)}
                    className="px-3 py-1.5 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Lock
                  </button>
                </div>
              </div>
            )}
          </div>
          )}

          {/* Unlock stock thresholds PIN dialog */}
          {settings.additionalStockSettingsEnabled && stockThresholdPinDialog.open && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Admin PIN
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Enter PIN to view and edit stock status thresholds.
                </p>
                <Pin4Input
                  value={stockThresholdPinDialog.pin}
                  onChange={(v) =>
                    setStockThresholdPinDialog((p) => ({
                      ...p,
                      pin: v.slice(0, 4),
                      pinError: "",
                    }))
                  }
                  onComplete={(entered) => {
                    const expected = settings.adminPin || "0000";
                    if (entered === expected) {
                      setStockThresholdsUnlocked(true);
                      setStockThresholdForm({
                        extremeLowKg: String(
                          settings.stockStatusExtremeLowKg ?? 300,
                        ),
                        lowKg: String(settings.stockStatusLowKg ?? 500),
                      });
                      setStockThresholdPinDialog({
                        open: false,
                        pin: "",
                        pinError: "",
                      });
                    } else {
                      setStockThresholdPinDialog((p) => ({
                        ...p,
                        pinError: "Incorrect PIN.",
                      }));
                    }
                  }}
                  error={!!stockThresholdPinDialog.pinError}
                  className="mb-3"
                />
                {stockThresholdPinDialog.pinError && (
                  <p className="text-xs text-red-600 mb-3">
                    {stockThresholdPinDialog.pinError}
                  </p>
                )}
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() =>
                      setStockThresholdPinDialog({
                        open: false,
                        pin: "",
                        pinError: "",
                      })
                    }
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const entered = stockThresholdPinDialog.pin;
                      const expected = settings.adminPin || "0000";
                      if (entered === expected) {
                        setStockThresholdsUnlocked(true);
                        setStockThresholdForm({
                          extremeLowKg: String(
                            settings.stockStatusExtremeLowKg ?? 300,
                          ),
                          lowKg: String(settings.stockStatusLowKg ?? 500),
                        });
                        setStockThresholdPinDialog({
                          open: false,
                          pin: "",
                          pinError: "",
                        });
                      } else {
                        setStockThresholdPinDialog((p) => ({
                          ...p,
                          pinError: "Incorrect PIN.",
                        }));
                      }
                    }}
                    disabled={stockThresholdPinDialog.pin.length !== 4}
                    className="px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 text-sm"
                  >
                    Unlock
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Save thresholds PIN dialog (confirm with PIN to save) */}
          {settings.additionalStockSettingsEnabled && saveThresholdPinDialog.open && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Confirm with PIN
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Enter admin PIN to save stock status thresholds.
                </p>
                <Pin4Input
                  value={saveThresholdPinDialog.pin}
                  onChange={(v) =>
                    setSaveThresholdPinDialog((p) => ({
                      ...p,
                      pin: v.slice(0, 4),
                      pinError: "",
                    }))
                  }
                  onComplete={(entered) => handleSaveStockThresholds(entered)}
                  error={!!saveThresholdPinDialog.pinError}
                  className="mb-3"
                />
                {saveThresholdPinDialog.pinError && (
                  <p className="text-xs text-red-600 mb-3">
                    {saveThresholdPinDialog.pinError}
                  </p>
                )}
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() =>
                      setSaveThresholdPinDialog({
                        open: false,
                        pin: "",
                        pinError: "",
                      })
                    }
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() =>
                      saveThresholdPinDialog.pin.length === 4 &&
                      handleSaveStockThresholds(saveThresholdPinDialog.pin)
                    }
                    disabled={
                      saveThresholdPinDialog.pin.length !== 4 ||
                      savingThresholds
                    }
                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 text-sm"
                  >
                    {savingThresholds ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* CLEAR ALL STOCK CONFIRMATION MODAL */}
          {showClearConfirm && (
            <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-4 w-full max-w-md shadow-xl">
                <h3 className="text-sm font-semibold text-red-800 mb-2">
                  Remove all previous stock
                </h3>
                <p className="text-xs text-gray-600 mb-3">
                  This will permanently remove all stock ledgers, production
                  batches, and transactions. This action cannot be undone.
                </p>
                <p className="text-xs text-gray-700 mb-2">
                  Type <strong>REMOVE ALL STOCK</strong> to confirm:
                </p>
                <input
                  type="text"
                  className="w-full border border-gray-300 p-2 rounded text-sm mb-3"
                  value={clearConfirmText}
                  onChange={(e) => setClearConfirmText(e.target.value)}
                  placeholder="REMOVE ALL STOCK"
                />
                <p className="text-xs text-gray-600 mb-2">Admin PIN:</p>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength="8"
                  className="w-full border border-gray-300 p-2 rounded text-sm mb-4"
                  value={clearPin}
                  onChange={(e) =>
                    setClearPin(e.target.value.replace(/\D/g, "").slice(0, 8))
                  }
                  placeholder="PIN"
                />
                <div className="flex justify-end gap-2">
                  <button
                    className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-100"
                    onClick={() => {
                      setShowClearConfirm(false);
                      setClearConfirmText("");
                      setClearPin("");
                    }}
                    disabled={clearing}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-3 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    onClick={handleClearAllStock}
                    disabled={
                      clearing ||
                      clearConfirmText !== "REMOVE ALL STOCK" ||
                      clearPin.length !== 4
                    }
                  >
                    {clearing ? "Removing…" : "Remove all stock"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SOURCE DETAILS MODAL (PRODUCTION) */}
          {sourceModalRow && (
            <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-4 w-full max-w-lg shadow-xl max-h-[80vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-emerald-800">
                    Stock source details — {sourceModalRow.productsText || "Products"}
                    {sourceModalRow.companyName
                      ? ` (${sourceModalRow.companyName})`
                      : ""}
                  </h3>
                  <button
                    className="text-gray-500 hover:text-gray-700"
                    onClick={() => setSourceModalRow(null)}
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="overflow-auto flex-1 text-xs">
                  {(sourceModalRow.sources || []).length === 0 ? (
                    <p className="text-gray-500">
                      No source details available.
                    </p>
                  ) : (
                    <table className="w-full border rounded">
                      <thead className="bg-emerald-50 text-emerald-800 sticky top-0">
                        <tr>
                          <th className="p-2 text-left">Source</th>
                          <th className="p-2 text-left">Ref No</th>
                          <th className="p-2 text-left">Date/Time</th>
                          <th className="p-2 text-right">Qty (kg)</th>
                          <th className="p-2 text-left">Direction</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(sourceModalRow.sources || []).map((s, i) => (
                          <tr key={i} className="border-t">
                            <td className="p-2">{s.sourceType}</td>
                            <td className="p-2">{s.refNo}</td>
                            <td className="p-2">
                              {s.dateTime
                                ? new Date(s.dateTime).toLocaleString()
                                : "-"}
                            </td>
                            <td className="p-2 text-right">
                              {Math.round(Number(s.qtyKg ?? 0))}
                            </td>
                            <td className="p-2">{s.direction || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

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
                <label className="text-xs text-gray-600">Brand</label>
                <select
                  className="w-full border p-2 rounded text-sm mb-3"
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                >
                  <option value="ALL">All Brands</option>
                  {filteredCompanies.map((c, idx) => (
                    <option key={`${c}-${idx}`} value={c}>
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
                  {filteredProducts.map((p, idx) => (
                    <option key={`${p}-${idx}`} value={p}>
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* LEFT: TABLE */}
            <div className="lg:col-span-8 bg-white rounded-lg shadow p-4">
              <div className="text-sm font-semibold text-emerald-800 mb-2">
                Stock Items
              </div>
              <DataTable
                title="Production Stock"
                columns={stockColumns}
                data={loading ? [] : stockTableData}
                idKey="__rowId"
                emptyMessage={loading ? "Loading..." : "No stock records found."}
                pageSize={10}
                rowClassName={(row) => rowColor(statusOf(row))}
                showSearch={false}
                showFilters={false}
                showClearFilters={false}
                showExport={false}
                showPrint={false}
              />
            </div>

            {/* RIGHT: DONUT */}
            <div className="lg:col-span-4 bg-white rounded-lg shadow p-4">
              <div className="text-sm font-semibold text-emerald-800 mb-2">
                Stock Distribution
              </div>

              <div className="h-64 min-h-[240px] min-w-[200px]">
                {donutData.length > 0 ? (
                  <ResponsiveContainer
                    width="100%"
                    height={256}
                    minHeight={200}
                  >
                    <PieChart>
                      <Pie
                        data={donutData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={40}
                        outerRadius={80}
                      >
                        {donutData.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `${Math.round(Number(value) || 0)} kg`} />
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
        </>
      )}
    </div>
  );
}
