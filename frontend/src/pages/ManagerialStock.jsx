import React, { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { Filter, X, Info, Download, FileText, Printer } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
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

export function ManagerialStockView({ lastClearedAt }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [settings, setSettings] = useState({
    additionalStockSettingsEnabled: false,
    adminPin: "0000",
  });

  const [itemFilter, setItemFilter] = useState("ALL");
  const [dateMode, setDateMode] = useState("RANGE"); // RANGE | TODAY
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sourceModalRow, setSourceModalRow] = useState(null);
  const [useDialog, setUseDialog] = useState({ open: false, itemName: "", available: 0, qty: "", remarks: "" });
  const [using, setUsing] = useState(false);

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

  function statusOf(r) {
    const available = Number(r.balanceQty || 0);
    const ordered = Number(r.orderedQty || 0);
    if (available > 0) return "RECEIVED";
    if (ordered > 0) return "ORDERED";
    return "OUT";
  }

  function rowColor(status) {
    if (status === "OUT") return "bg-red-50";
    if (status === "ORDERED") return "bg-amber-50";
    return "bg-emerald-50";
  }

  function statusBadge(status) {
    if (status === "OUT")
      return <span className="text-gray-600 font-semibold">Out</span>;
    if (status === "ORDERED")
      return <span className="text-amber-700 font-semibold">Ordered</span>;
    return <span className="text-emerald-700 font-semibold">Received</span>;
  }

  // Managerial stock status is order/received/out (no thresholds).

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
        key: "lastUpdated",
        label: "Updated",
        render: (_value, row) =>
          row.lastUpdated ? new Date(row.lastUpdated).toLocaleString() : "-",
      },
      {
        key: "__use",
        label: "Use",
        skipExport: true,
        render: (_value, row) => (
          <button
            type="button"
            className="px-2 py-1 rounded border border-gray-200 text-xs text-gray-700 hover:bg-gray-50"
            onClick={() =>
              setUseDialog({
                open: true,
                itemName: row.itemName,
                available: Number(row.balanceQty || 0),
                qty: "",
                remarks: "",
              })
            }
            disabled={Number(row.balanceQty || 0) <= 0}
            title={Number(row.balanceQty || 0) <= 0 ? "No stock available" : "Mark used/consume"}
          >
            Use
          </button>
        ),
      },
    ],
    [statusBadge, statusOf],
  );

  const exportManagerialRows = useMemo(
    () =>
      managerialTableData.map((r) => ({
        Item: r.itemName || "-",
        Qty: Number(r.balanceQty || 0).toFixed(2),
        Updated: r.lastUpdated ? new Date(r.lastUpdated).toLocaleString() : "-",
      })),
    [managerialTableData],
  );

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(exportManagerialRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ManagerialStock");
    XLSX.writeFile(
      wb,
      `managerial_stock_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  const handleExportPdf = () => {
    const doc = new jsPDF();
    const body = exportManagerialRows.map((r) => [
      r.Item,
      r.Qty,
      r.Updated,
    ]);
    doc.text("Managerial Stock", 14, 12);
    autoTable(doc, {
      startY: 18,
      head: [["Item", "Qty", "Updated"]],
      body,
      styles: { fontSize: 8 },
    });
    doc.save(`managerial_stock_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6 w-full">
      <Toaster />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-emerald-800">
            Managerial Stock Overview
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="p-2 rounded-lg hover:bg-gray-100"
            onClick={() => setShowFilters(true)}
            title="Filters"
          >
            <Filter size={18} className="text-gray-600" />
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
        </div>
      </div>


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
            showExport={false}
            showPrint={false}
            deleteAll={{
              description:
                "This will permanently delete ALL managerial stock ledger entries (IN/OUT/ORDER) from the database.",
              onConfirm: async (adminPin) => {
                const res = await api.post("/admin/purge", {
                  adminPin,
                  key: "managerialStockLedgers",
                });
                const deleted = res?.data?.data?.deletedCount ?? 0;
                toast.success(`Deleted ${deleted} managerial ledger entries`);
                loadData();
              },
            }}
          />

          {/* SOURCE DETAILS MODAL (MANAGERIAL) */}
          {sourceModalRow && (
            <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-4 w-full max-w-lg shadow-xl max-h-[80vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-emerald-800">
                    Stock source details â€” {sourceModalRow.itemName}
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

      {useDialog.open && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-emerald-800">Use Stock</h3>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setUseDialog({ open: false, itemName: "", available: 0, qty: "", remarks: "" })}
                disabled={using}
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              <div className="text-gray-700">
                <div className="text-xs text-gray-500">Item</div>
                <div className="font-semibold">{useDialog.itemName}</div>
              </div>
              <div className="text-xs text-gray-500">Available: {useDialog.available.toFixed(2)}</div>
              <div>
                <label className="text-xs text-gray-600">Used Quantity</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={useDialog.qty}
                  onChange={(e) => setUseDialog((d) => ({ ...d, qty: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">Remarks (optional)</label>
                <input
                  value={useDialog.remarks}
                  onChange={(e) => setUseDialog((d) => ({ ...d, remarks: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="Used in maintenance..."
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="px-3 py-2 rounded border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => setUseDialog({ open: false, itemName: "", available: 0, qty: "", remarks: "" })}
                disabled={using}
              >
                Cancel
              </button>
              <button
                className="px-3 py-2 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-60"
                disabled={using}
                onClick={async () => {
                  const q = Math.floor(Number(useDialog.qty || 0));
                  if (!q || q <= 0) {
                    toast.error("Enter used quantity");
                    return;
                  }
                  if (q > useDialog.available) {
                    toast.error(`Cannot use more than available (${useDialog.available.toFixed(2)})`);
                    return;
                  }
                  setUsing(true);
                  try {
                    const res = await api.post("/managerial-stock/consume", {
                      itemName: useDialog.itemName,
                      quantity: q,
                      remarks: useDialog.remarks,
                    });
                    if (res.data?.success === false) throw new Error(res.data?.message || "Failed");
                    toast.success("Stock updated");
                    setUseDialog({ open: false, itemName: "", available: 0, qty: "", remarks: "" });
                    loadData();
                  } catch (e) {
                    toast.error(e?.response?.data?.message || e?.message || "Failed to update");
                  } finally {
                    setUsing(false);
                  }
                }}
              >
                {using ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ManagerialStock() {
  return <ManagerialStockView />;
}
