import React, { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { Filter, X, Info, Settings, Lock } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Pin4Input from "../components/Pin4Input";
import DataTable from "../components/ui/DataTable";
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

export function ManagerialStockView({ lastClearedAt }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [settings, setSettings] = useState({
    managerialStockStatusExtremeLowQty: 2,
    managerialStockStatusLowQty: 5,
    adminPin: "0000",
  });
  const [stockThresholdsUnlocked, setStockThresholdsUnlocked] = useState(false);
  const [stockThresholdPinDialog, setStockThresholdPinDialog] = useState({
    open: false,
    pin: "",
    pinError: "",
  });
  const [stockThresholdForm, setStockThresholdForm] = useState({
    extremeLowKg: "2",
    lowKg: "5",
  });
  const [savingThresholds, setSavingThresholds] = useState(false);
  const [saveThresholdPinDialog, setSaveThresholdPinDialog] = useState({
    open: false,
    pin: "",
    pinError: "",
  });

  const [itemFilter, setItemFilter] = useState("ALL");
  const [dateMode, setDateMode] = useState("RANGE"); // RANGE | TODAY
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sourceModalRow, setSourceModalRow] = useState(null);

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
    if (lastClearedAt != null) loadData();
  }, [lastClearedAt]);

  async function loadData() {
    try {
      setLoading(true);
      const res = await api.get("/managerial-stock/overview");
      setRows(res.data.data || []);
    } catch (err) {
      toast.error("Failed to load managerial stock data");
    } finally {
      setLoading(false);
    }
  }

  const allItems = useMemo(() => {
    const s = new Set();
    rows.forEach((r) => r.itemName && s.add(r.itemName));
    return Array.from(s);
  }, [rows]);

  function recordMatchesDate(row) {
    const updated = row.lastUpdated ? new Date(row.lastUpdated) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dateMode === "TODAY") {
      if (updated && updated >= today) return true;
      return false;
    }

    if (!dateFrom || !dateTo) return true;
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    return updated && updated >= from && updated <= to;
  }

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const matchItem = itemFilter === "ALL" || r.itemName === itemFilter;
      const matchDate = recordMatchesDate(r);
      return matchItem && matchDate;
    });
  }, [rows, itemFilter, dateMode, dateFrom, dateTo]);

  const donutData = useMemo(() => {
    return filteredRows.map((r) => ({
      name: r.itemName,
      value: Number(r.balanceQty || 0),
    }));
  }, [filteredRows]);

  const extremeLowQty =
    Number(settings.managerialStockStatusExtremeLowQty) || 2;
  const lowQty = Number(settings.managerialStockStatusLowQty) || 5;
  function statusOf(r) {
    const q = r.balanceQty || 0;
    if (q <= 0) return "OUT";
    if (q <= extremeLowQty) return "EXTREME_LOW";
    if (q <= lowQty) return "LOW";
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

  async function handleSaveStockThresholds(pinToSave) {
    const extreme = Math.max(
      0,
      Math.floor(Number(stockThresholdForm.extremeLowKg) || 0),
    );
    const low = Math.max(0, Math.floor(Number(stockThresholdForm.lowKg) || 0));
    if (extreme > low) {
      toast.error("Extreme low must be less than or equal to Low.");
      return;
    }
    setSavingThresholds(true);
    try {
      const res = await api.put("/settings", {
        managerialStockStatusExtremeLowQty: extreme,
        managerialStockStatusLowQty: low,
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

  const managerialTableData = useMemo(
    () =>
      filteredRows.map((row, idx) => ({
        ...row,
        __rowId: row._id || row.id || `${row.itemName || "item"}-${idx}`,
      })),
    [filteredRows],
  );

  const managerialColumns = useMemo(
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
      { key: "itemName", label: "Item" },
      {
        key: "balanceQty",
        label: "Qty",
        render: (_value, row) => (
          <span className="block text-right">
            {Number(row.balanceQty || 0).toFixed(2)}
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
    [statusBadge, statusOf],
  );

  return (
    <div className="space-y-6 w-full">
      <Toaster />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-emerald-800">
            Managerial Stock Overview
          </h2>
        </div>

        <button
          className="p-2 rounded-lg hover:bg-gray-100"
          onClick={() => setShowFilters(true)}
        >
          <Filter size={18} className="text-gray-600" />
        </button>
      </div>

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
                Extreme low
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
                placeholder="e.g. 2"
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              />
              <p className="text-[10px] text-gray-400 mt-0.5">
                Below this = Extreme low
              </p>
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">
                Low
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
                placeholder="e.g. 5"
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
                {savingThresholds ? "Saving..." : "Save thresholds"}
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

      {stockThresholdPinDialog.open && (
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
                      settings.managerialStockStatusExtremeLowQty ?? 2,
                    ),
                    lowKg: String(settings.managerialStockStatusLowQty ?? 5),
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
                      settings.managerialStockStatusExtremeLowQty ?? 2,
                    ),
                    lowKg: String(settings.managerialStockStatusLowQty ?? 5),
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

      {saveThresholdPinDialog.open && (
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
                  saveThresholdPinDialog.pin.length !== 4 || savingThresholds
                }
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 text-sm"
              >
                {savingThresholds ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

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

            <label className="text-xs text-gray-600">Item</label>
            <select
              className="w-full border p-2 rounded text-sm mb-3"
              value={itemFilter}
              onChange={(e) => setItemFilter(e.target.value)}
            >
              <option value="ALL">All Items</option>
              {allItems.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>

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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 bg-white rounded-lg shadow p-4">
          <div className="text-sm font-semibold text-emerald-800 mb-2">
            Managerial Stock Items
          </div>

          <DataTable
            title="Managerial Stock"
            columns={managerialColumns}
            data={loading ? [] : managerialTableData}
            idKey="__rowId"
            emptyMessage={
              loading ? "Loading..." : "No managerial stock records found."
            }
            pageSize={10}
            rowClassName={(row) => rowColor(statusOf(row))}
            showSearch={false}
            showFilters={false}
            showClearFilters={false}
          />

          {/* SOURCE DETAILS MODAL (MANAGERIAL) */}
          {sourceModalRow && (
            <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-4 w-full max-w-lg shadow-xl max-h-[80vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-emerald-800">
                    Stock source details — {sourceModalRow.itemName}
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
                    <p className="text-gray-500">No source details available.</p>
                  ) : (
                    <table className="w-full border rounded">
                      <thead className="bg-emerald-50 text-emerald-800 sticky top-0">
                        <tr>
                          <th className="p-2 text-left">Source</th>
                          <th className="p-2 text-left">Ref No</th>
                          <th className="p-2 text-left">Date</th>
                          <th className="p-2 text-left">Date/Time</th>
                          <th className="p-2 text-right">Qty</th>
                          <th className="p-2 text-left">Direction</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(sourceModalRow.sources || []).map((s, i) => (
                          <tr key={i} className="border-t">
                            <td className="p-2">{s.sourceType}</td>
                            <td className="p-2">{s.refNo}</td>
                            <td className="p-2">
                              {s.date ? new Date(s.date).toLocaleDateString() : "-"}
                            </td>
                            <td className="p-2">
                              {s.dateTime ? new Date(s.dateTime).toLocaleString() : "-"}
                            </td>
                            <td className="p-2 text-right">{Number(s.qty ?? 0).toFixed(2)}</td>
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
        </div>

        <div className="lg:col-span-4 bg-white rounded-lg shadow p-4">
          <div className="text-sm font-semibold text-emerald-800 mb-2">
            Stock Distribution
          </div>

          <div className="h-64 min-h-[240px] min-w-[200px]">
            {donutData.length > 0 ? (
              <ResponsiveContainer width="100%" height={256} minHeight={200}>
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

export default function ManagerialStock() {
  return <ManagerialStockView />;
}
