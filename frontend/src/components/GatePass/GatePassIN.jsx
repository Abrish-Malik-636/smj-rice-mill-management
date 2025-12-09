import React, { useEffect, useState } from "react";
import {
  Edit2,
  Trash2,
  Printer,
  Download,
  Funnel,
  ChevronDown,
} from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../services/api";

const PAGE_SIZE = 10;

function rowsToCsv(rows) {
  const cols = [
    "createdAt",
    "gatePassNo",
    "truckNo",
    "supplier",
    "itemType",
    "transporter",
    "driverName",
    "remarks",
  ];
  const header = cols.join(",");
  const lines = rows.map((r) =>
    cols
      .map((c) => {
        const v = r[c] == null ? "" : String(r[c]).replace(/"/g, '""');
        return `"${v}"`;
      })
      .join(",")
  );
  return [header, ...lines].join("\n");
}

export default function GatePassIN() {
  const [form, setForm] = useState({
    truckNo: "",
    supplier: "",
    itemType: "",
    transporter: "",
    driverName: "",
    remarks: "",
  });
  const [errors, setErrors] = useState({});
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [itemFilter, setItemFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [settings, setSettings] = useState(null);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // regex: names allow letters, spaces, dot, apostrophe (NO hyphen), per your request
  const nameRegex = /^[A-Za-z\s.']+$/;
  const truckRegex = /^[A-Z]{2,4}-\d{3,4}$/; // AB-123 or ABC-1234

  // helper: set/clear errors
  const setFieldError = (field, msg) =>
    setErrors((p) => ({ ...p, [field]: msg }));
  const clearFieldError = (field) =>
    setErrors((p) => {
      const c = { ...p };
      delete c[field];
      return c;
    });

  // Validation functions (same messages as backend)
  const validateTruckNo = (v) => {
    if (!v) return "Truck number is required.";
    if (v.length < 6) return "Truck number too short.";
    if (v.length > 12) return "Truck number too long.";
    if (!truckRegex.test(v))
      return "Format: ABC-123 or AB-1234 (caps letters, hyphen, digits).";
    return "";
  };
  const validateSupplier = (v) => {
    if (!v || v.trim() === "") return "Supplier is required for IN gate pass.";
    if (!nameRegex.test(v))
      return "Supplier name invalid. Use letters, spaces, dot or apostrophe only.";
    return "";
  };
  const validateItemType = (v) => (!v ? "Please select item type." : "");
  const validateDriver = (v) =>
    !v
      ? ""
      : nameRegex.test(v)
      ? ""
      : "Driver name invalid. No numbers or special characters.";

  const validateField = (name, value) => {
    let msg = "";
    if (name === "truckNo") msg = validateTruckNo(value);
    if (name === "supplier") msg = validateSupplier(value);
    if (name === "itemType") msg = validateItemType(value);
    if (name === "driverName") msg = validateDriver(value);
    if (msg) setFieldError(name, msg);
    else clearFieldError(name);
  };

  const validateForm = () => {
    const e1 = validateTruckNo(form.truckNo);
    const e2 = validateSupplier(form.supplier);
    const e3 = validateItemType(form.itemType);
    const e4 = validateDriver(form.driverName);
    const newErr = {};
    if (e1) newErr.truckNo = e1;
    if (e2) newErr.supplier = e2;
    if (e3) newErr.itemType = e3;
    if (e4) newErr.driverName = e4;
    setErrors(newErr);
    return Object.keys(newErr).length === 0;
  };

  // format truck input: uppercase, keep letters then digits, insert hyphen automatically
  const formatTruckInput = (raw) => {
    let s = raw.toUpperCase();
    // remove any char not letter/digit
    s = s.replace(/[^A-Z0-9]/g, "");
    // split leading letters and trailing digits
    const letters = s.match(/^[A-Z]*/)[0] || "";
    const digits = s.slice(letters.length) || "";
    if (!digits) return letters;
    return `${letters}-${digits}`.slice(0, 12); // limit overall length
  };

  // load settings (optional)
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await api.get("/settings/general");
        if (res.data && res.data.success !== false) {
          setSettings(res.data.data || res.data);
        }
      } catch {
        // optional - ignore 404
      }
    };
    loadSettings();
  }, []);

  // fetch rows
  const fetchRows = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: PAGE_SIZE,
        type: "IN",
        search: searchQuery || "",
      };
      const res = await api.get("/gatepasses", { params });
      if (res.data && res.data.success === false)
        throw new Error(res.data.message || "Failed");
      let list = res.data.data || [];
      if (itemFilter) list = list.filter((r) => r.itemType === itemFilter);
      setRows(list);
      setTotal(res.data.total || list.length);
    } catch (err) {
      toast.error(err.message || "Unable to fetch gate passes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows(); /* eslint-disable-next-line */
  }, [page, itemFilter]);

  // supplier suggestions – show only if supplier field currently has error (per your request)
  const supplierSuggestions = errors.supplier
    ? Array.from(new Set(rows.map((r) => r.supplier).filter(Boolean))).slice(
        0,
        6
      )
    : [];

  // handlers
  const handleChange = (e) => {
    const { name, value } = e.target;
    let v = value;
    if (name === "truckNo") {
      v = formatTruckInput(value);
    }
    if (name === "supplier" || name === "driverName") {
      v = value.replace(/\s+/g, " ");
    }
    setForm((prev) => ({ ...prev, [name]: v }));
    validateField(name, v);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    const payload = { ...form, type: "IN" };
    try {
      const url = editingId ? `/gatepasses/${editingId}` : "/gatepasses";
      const method = editingId ? "put" : "post";
      const res = await api[method](url, payload);
      if (res.data && res.data.success === false)
        throw new Error(res.data.message || "Save failed");
      toast.success(editingId ? "Gate pass updated." : "Gate pass created.");
      setForm({
        truckNo: "",
        supplier: "",
        itemType: "",
        transporter: "",
        driverName: "",
        remarks: "",
      });
      setEditingId(null);
      setErrors({});
      fetchRows();
    } catch (err) {
      toast.error(err.message || "Unable to save.");
    }
  };

  // edit: populate and CLEAR previous errors (per your request)
  const handleEdit = (row) => {
    setForm({
      truckNo: row.truckNo || "",
      supplier: row.supplier || "",
      itemType: row.itemType || "",
      transporter: row.transporter || "",
      driverName: row.driverName || "",
      remarks: row.remarks || "",
    });
    setEditingId(row._id);
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete Gate Pass ${row.gatePassNo || ""}?`)) return;
    try {
      const res = await api.delete(`/gatepasses/${row._id}`);
      if (res.data && res.data.success === false)
        throw new Error(res.data.message || "Delete failed");
      toast.success("Gate pass deleted.");
      fetchRows();
    } catch (err) {
      toast.error(err.message || "Unable to delete");
    }
  };

  // open print window (PDF via browser print) — uses settings.logo if present
  const openPrintWindow = (row) => {
    const win = window.open("", "_blank", "width=700,height=900");
    if (!win) return;
    const millName = settings?.name || settings?.companyName || "Rice Mill";
    const millAddress = settings?.address || settings?.companyAddress || "";
    const logo = settings?.logoUrl || settings?.logo || ""; // adapt to your settings shape
    const gateTypeLabel = "INWARD";

    const logoHtml = logo
      ? `<img src="${logo}" style="height:40px;margin-right:10px;border-radius:6px" alt="logo" />`
      : `<div style="width:40px;height:40px;border-radius:6px;background:#ecfdf5;color:#047857;display:inline-flex;align-items:center;justify-content:center;font-weight:700;margin-right:10px">GP</div>`;

    const html = `
      <html><head><title>Gate Pass ${row.gatePassNo || ""}</title>
      <style>
        body{font-family:system-ui, -apple-system, "Segoe UI"; background:#f3f4f6; margin:0;}
        .card{max-width:520px;margin:28px auto;background:#fff;padding:20px;border-radius:12px;box-shadow:0 8px 20px rgba(0,0,0,0.08)}
        .header{display:flex;align-items:center}
        .title{font-weight:700;color:#047857;font-size:18px}
        .addr{font-size:12px;color:#6b7280}
        .tag{display:inline-block;margin-top:6px;padding:4px 10px;border-radius:999px;background:#d1fae5;color:#047857;font-weight:600;font-size:12px}
        .row{display:flex;justify-content:space-between;margin:8px 0;font-size:13px}
        hr{border:0;border-top:1px solid #e6e6e6;margin:12px 0}
      </style></head><body>
      <div class="card">
        <div class="header">${logoHtml}<div>
          <div class="title">${millName}</div>
          <div class="addr">${millAddress}</div>
          <div class="tag">${gateTypeLabel}</div>
        </div></div>
        <hr/>
        <div class="row"><div>Gate Pass No</div><div>${
          row.gatePassNo || "-"
        }</div></div>
        <div class="row"><div>Date</div><div>${
          row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"
        }</div></div>
        <div class="row"><div>Truck No</div><div>${
          row.truckNo || "-"
        }</div></div>
        <div class="row"><div>Supplier</div><div>${
          row.supplier || "-"
        }</div></div>
        <div class="row"><div>Item</div><div>${row.itemType || "-"}</div></div>
        <div class="row"><div>Transporter</div><div>${
          row.transporter || "-"
        }</div></div>
        <div class="row"><div>Driver</div><div>${
          row.driverName || "-"
        }</div></div>
        <hr/>
        <div style="color:#6b7280;font-size:12px">${row.remarks || ""}</div>
      </div>
      <script>window.print();</script>
      </body></html>
    `;
    win.document.write(html);
    win.document.close();
  };

  // CSV export (current filtered visible rows)
  const exportCsv = () => {
    if (!rows || rows.length === 0) {
      toast.error("No rows to export.");
      return;
    }
    const csv = rowsToCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GatePass_IN_page${page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download PDF via print: open print for whole filtered table (we can create a printable view of the table)
  const exportPdf = () => {
    // create printable HTML for current rows
    const millName = settings?.name || settings?.companyName || "Rice Mill";
    const millAddress = settings?.address || settings?.companyAddress || "";
    const logo = settings?.logoUrl || settings?.logo || "";

    let rowsHtml = rows
      .map(
        (r) => `
      <tr>
        <td>${
          r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "-"
        }</td>
        <td>${r.gatePassNo || ""}</td>
        <td>${r.truckNo || ""}</td>
        <td>${r.supplier || ""}</td>
        <td>${r.itemType || ""}</td>
        <td>${r.transporter || ""}</td>
        <td>${r.driverName || ""}</td>
      </tr>
    `
      )
      .join("");

    const html = `
      <html><head><title>Gate Passes</title>
      <style>
        body{font-family:system-ui;padding:20px}
        .hdr{display:flex;align-items:center;gap:10px}
        table{width:100%;border-collapse:collapse;margin-top:12px}
        th,td{border:1px solid #e5e7eb;padding:6px;text-align:left;font-size:12px}
        th{background:#f0fdf4;color:#065f46}
      </style></head><body>
      <div class="hdr">${
        logo
          ? `<img src="${logo}" style="height:36px"/>`
          : '<div style="width:36px;height:36px;background:#ecfdf5;color:#047857;display:inline-flex;align-items:center;justify-content:center;border-radius:6px">GP</div>'
      }<div><div style="font-weight:700">${millName}</div><div style="font-size:12px;color:#6b7280">${millAddress}</div></div></div>
      <table><thead><tr><th>Date</th><th>GatePassNo</th><th>Truck</th><th>Supplier</th><th>Item</th><th>Transporter</th><th>Driver</th></tr></thead><tbody>${rowsHtml}</tbody></table>
      <script>window.print();</script></body></html>
    `;
    const win = window.open("", "_blank", "width=900,height=700");
    win.document.write(html);
    win.document.close();
  };

  // filter apply helper
  const applyFilter = () => {
    setPage(1);
    setFilterOpen(false);
    fetchRows();
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow p-4 space-y-4"
      >
        <h2 className="text-lg font-semibold text-emerald-700">
          Inward Gate Pass
        </h2>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Truck No <span className="text-red-500">*</span>
            </label>
            <input
              name="truckNo"
              value={form.truckNo}
              onChange={handleChange}
              placeholder="ABC-1234"
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition ${
                errors.truckNo ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.truckNo && (
              <p className="text-xs text-red-500 mt-1">{errors.truckNo}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              Format: ABC-123 or AB-1234 (caps letters, hyphen, digits)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Supplier <span className="text-red-500">*</span>
            </label>
            <input
              name="supplier"
              value={form.supplier}
              onChange={handleChange}
              placeholder="Supplier name"
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                errors.supplier ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.supplier && (
              <p className="text-xs text-red-500 mt-1">{errors.supplier}</p>
            )}
            {/* suggestions only when there is an error */}
            {supplierSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                <span className="text-xs text-gray-400 mr-1">Suggestions:</span>
                {supplierSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setForm((f) => ({ ...f, supplier: s }));
                      clearFieldError("supplier");
                    }}
                    className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Item Type <span className="text-red-500">*</span>
            </label>
            <select
              name="itemType"
              value={form.itemType}
              onChange={handleChange}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                errors.itemType ? "border-red-500" : "border-gray-300"
              }`}
            >
              <option value="">Select item</option>
              <option value="Paddy">Paddy</option>
              <option value="Machinery">Machinery</option>
              <option value="Raw Material">Raw Material</option>
              <option value="Packaging">Packaging Material</option>
              <option value="Other">Other</option>
            </select>
            {errors.itemType && (
              <p className="text-xs text-red-500 mt-1">{errors.itemType}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Transporter
            </label>
            <input
              name="transporter"
              value={form.transporter}
              onChange={handleChange}
              placeholder="Optional"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none border-gray-300"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Driver Name
            </label>
            <input
              name="driverName"
              value={form.driverName}
              onChange={handleChange}
              placeholder="Driver name"
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                errors.driverName ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.driverName && (
              <p className="text-xs text-red-500 mt-1">{errors.driverName}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Remarks</label>
            <textarea
              name="remarks"
              value={form.remarks}
              onChange={handleChange}
              rows={2}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none border-gray-300"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm shadow hover:bg-emerald-700"
          >
            {editingId ? "Update Gate Pass" : "Save Gate Pass"}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm({
                  truckNo: "",
                  supplier: "",
                  itemType: "",
                  transporter: "",
                  driverName: "",
                  remarks: "",
                });
                setErrors({});
              }}
              className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-xs"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      {/* Filter overlay + download controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 relative">
          <button
            onClick={() => setFilterOpen((s) => !s)}
            className="p-2 rounded bg-emerald-50 hover:bg-emerald-100"
          >
            <Funnel className="w-4 h-4 text-emerald-700" />
          </button>

          {/* filter panel as overlay to avoid layout jump */}
          {filterOpen && (
            <div className="fixed top-24 right-6 z-40 bg-white border rounded p-3 shadow transition">
              <div className="flex gap-2 items-center">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="search truck/supplier/gp no"
                  className="rounded border px-2 py-1 text-sm outline-none"
                />
                <select
                  value={itemFilter}
                  onChange={(e) => setItemFilter(e.target.value)}
                  className="rounded border px-2 py-1 text-sm outline-none"
                >
                  <option value="">All item types</option>
                  <option value="Paddy">Paddy</option>
                  <option value="Machinery">Machinery</option>
                  <option value="Raw Material">Raw Material</option>
                  <option value="Packaging">Packaging</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={applyFilter}
                  className="px-2 py-1 bg-emerald-600 text-white rounded text-sm"
                >
                  Apply
                </button>
                <button
                  onClick={() => {
                    setFilterOpen(false);
                    setSearchQuery("");
                    setItemFilter("");
                    fetchRows();
                  }}
                  className="px-2 py-1 bg-gray-100 rounded text-sm"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setDownloadMenuOpen((s) => !s)}
            className="flex items-center gap-2 px-3 py-1 rounded bg-emerald-50 hover:bg-emerald-100"
          >
            <Download className="w-4 h-4 text-emerald-700" />
            <span className="text-sm text-emerald-700">Download</span>
            <ChevronDown className="w-4 h-4 text-emerald-700" />
          </button>

          {downloadMenuOpen && (
            <div className="absolute right-0 mt-2 bg-white border rounded shadow p-2 z-40">
              <button
                onClick={() => {
                  exportCsv();
                  setDownloadMenuOpen(false);
                }}
                className="block w-full text-left px-3 py-1 text-sm hover:bg-emerald-50"
              >
                Excel / CSV
              </button>
              <button
                onClick={() => {
                  exportPdf();
                  setDownloadMenuOpen(false);
                }}
                className="block w-full text-left px-3 py-1 text-sm hover:bg-emerald-50"
              >
                PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow overflow-x-auto transition-all">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-emerald-50 text-emerald-900">
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Gate Pass No</th>
              <th className="px-3 py-2 text-left">Truck No</th>
              <th className="px-3 py-2 text-left">Supplier</th>
              <th className="px-3 py-2 text-left">Item Type</th>
              <th className="px-3 py-2 text-left">Transporter</th>
              <th className="px-3 py-2 text-left">Driver</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-gray-400">
                  No inward gate passes found.
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row) => (
                <tr
                  key={row._id}
                  className="border-t border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-3 py-2">
                    {row.createdAt
                      ? new Date(row.createdAt).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="px-3 py-2">{row.gatePassNo || "-"}</td>
                  <td className="px-3 py-2">{row.truckNo || "-"}</td>
                  <td className="px-3 py-2">{row.supplier || "-"}</td>
                  <td className="px-3 py-2">{row.itemType || "-"}</td>
                  <td className="px-3 py-2">{row.transporter || "-"}</td>
                  <td className="px-3 py-2">{row.driverName || "-"}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEdit(row)}
                        className="p-1 rounded hover:bg-emerald-50"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4 text-emerald-600" />
                      </button>
                      <button
                        onClick={() => handleDelete(row)}
                        className="p-1 rounded hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                      <button
                        onClick={() => openPrintWindow(row)}
                        className="p-1 rounded hover:bg-gray-100"
                        title="Print"
                      >
                        <Printer className="w-4 h-4 text-gray-700" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 text-xs">
          <span className="text-gray-500">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={`px-3 py-1 rounded border ${
                page <= 1
                  ? "border-gray-200 text-gray-300"
                  : "border-gray-300 text-gray-700"
              }`}
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className={`px-3 py-1 rounded border ${
                page >= totalPages
                  ? "border-gray-200 text-gray-300"
                  : "border-gray-300 text-gray-700"
              }`}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
