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
    "customer",
    "itemType",
    "quantity",
    "unit",
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

export default function GatePassOUT() {
  const [form, setForm] = useState({
    truckNo: "",
    customer: "",
    itemType: "",
    quantity: "",
    unit: "kg",
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

  const nameRegex = /^[A-Za-z\s.'+]+$/; // allow letters, spaces, dot, apostrophe (no hyphen)
  const truckRegex = /^[A-Z]{2,4}-\d{3,4}$/;

  const setFieldError = (field, msg) =>
    setErrors((p) => ({ ...p, [field]: msg }));
  const clearFieldError = (field) =>
    setErrors((p) => {
      const c = { ...p };
      delete c[field];
      return c;
    });

  const validateTruckNo = (v) => {
    if (!v) return "Truck number is required.";
    if (v.length < 6) return "Truck number too short.";
    if (v.length > 12) return "Truck number too long.";
    if (!truckRegex.test(v))
      return "Format: ABC-123 or AB-1234 (caps letters, hyphen, digits).";
    return "";
  };
  const validateCustomer = (v) => {
    if (!v || v.trim() === "") return "Customer is required for OUT gate pass.";
    if (!nameRegex.test(v))
      return "Customer name invalid. Use letters, spaces, dot or apostrophe only.";
    return "";
  };
  const validateItemType = (v) => (!v ? "Please select item type." : "");
  const validateQuantity = (v) => {
    if (v === "" || v == null) return "Quantity is required.";
    if (!/^[0-9]+(\.[0-9]+)?$/.test(String(v)))
      return "Quantity must be numeric (no letters).";
    if (Number(v) <= 0) return "Quantity must be greater than 0.";
    return "";
  };
  const validateDriver = (v) =>
    !v ? "" : nameRegex.test(v) ? "" : "Driver name invalid.";

  const validateField = (name, value) => {
    let msg = "";
    if (name === "truckNo") msg = validateTruckNo(value);
    if (name === "customer") msg = validateCustomer(value);
    if (name === "itemType") msg = validateItemType(value);
    if (name === "quantity") msg = validateQuantity(value);
    if (name === "driverName") msg = validateDriver(value);
    if (msg) setFieldError(name, msg);
    else clearFieldError(name);
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await api.get("/settings/general");
        if (res.data && res.data.success !== false)
          setSettings(res.data.data || res.data);
      } catch {}
    };
    loadSettings();
  }, []);

  const fetchRows = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: PAGE_SIZE,
        type: "OUT",
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
      toast.error(err.message || "Unable to fetch");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows(); /* eslint-disable-next-line */
  }, [page, itemFilter]);

  // suggestions only when customer field has error
  const customerSuggestions = errors.customer
    ? Array.from(new Set(rows.map((r) => r.customer).filter(Boolean))).slice(
        0,
        6
      )
    : [];

  // formatting truck number while typing
  const formatTruckInput = (raw) => {
    let s = raw.toUpperCase();
    s = s.replace(/[^A-Z0-9]/g, "");
    const letters = s.match(/^[A-Z]*/)[0] || "";
    const digits = s.slice(letters.length) || "";
    if (!digits) return letters;
    return `${letters}-${digits}`.slice(0, 12);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let v = value;
    if (name === "truckNo") v = formatTruckInput(value);
    if (name === "customer" || name === "driverName")
      v = value.replace(/\s+/g, " ");
    if (name === "quantity") v = value.replace(/[^\d.]/g, ""); // allow only numbers and dot
    setForm((p) => ({ ...p, [name]: v }));
    validateField(name, v);
  };

  const validateForm = () => {
    const e1 = validateTruckNo(form.truckNo);
    const e2 = validateCustomer(form.customer);
    const e3 = validateItemType(form.itemType);
    const e4 = validateQuantity(form.quantity);
    const e5 = validateDriver(form.driverName);
    const newErr = {};
    if (e1) newErr.truckNo = e1;
    if (e2) newErr.customer = e2;
    if (e3) newErr.itemType = e3;
    if (e4) newErr.quantity = e4;
    if (e5) newErr.driverName = e5;
    setErrors(newErr);
    return Object.keys(newErr).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error("Fix highlighted fields.");
      return;
    }
    const payload = { ...form, type: "OUT", quantity: Number(form.quantity) };
    try {
      const url = editingId ? `/gatepasses/${editingId}` : "/gatepasses";
      const method = editingId ? "put" : "post";
      const res = await api[method](url, payload);
      if (res.data && res.data.success === false)
        throw new Error(res.data.message || "Save failed");
      toast.success(editingId ? "Updated." : "Created.");
      setForm({
        truckNo: "",
        customer: "",
        itemType: "",
        quantity: "",
        unit: "kg",
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

  const handleEdit = (row) => {
    setForm({
      truckNo: row.truckNo || "",
      customer: row.customer || "",
      itemType: row.itemType || "",
      quantity: row.quantity != null ? String(row.quantity) : "",
      unit: row.unit || "kg",
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
      toast.success("Deleted.");
      fetchRows();
    } catch (err) {
      toast.error(err.message || "Unable to delete");
    }
  };

  // print single gatepass
  const openPrintWindow = (row) => {
    const win = window.open("", "_blank", "width=700,height=900");
    if (!win) return;
    const millName = settings?.name || settings?.companyName || "Rice Mill";
    const millAddress = settings?.address || settings?.companyAddress || "";
    const logo = settings?.logoUrl || settings?.logo || "";
    const gateTypeLabel = "OUTWARD";
    const logoHtml = logo
      ? `<img src="${logo}" style="height:40px;margin-right:10px;border-radius:6px" alt="logo" />`
      : `<div style="width:40px;height:40px;border-radius:6px;background:#ecfdf5;color:#047857;display:inline-flex;align-items:center;justify-content:center;font-weight:700;margin-right:10px">GP</div>`;

    const html = `
      <html><head><title>Gate Pass ${row.gatePassNo || ""}</title>
      <style>
        body{font-family:system-ui;background:#f3f4f6}
        .card{max-width:520px;margin:28px auto;background:#fff;padding:20px;border-radius:12px;box-shadow:0 8px 20px rgba(0,0,0,0.08)}
        .header{display:flex;align-items:center}
        .title{font-weight:700;color:#047857;font-size:18px}
        .addr{font-size:12px;color:#6b7280}
        .tag{display:inline-block;margin-top:6px;padding:4px 10px;border-radius:999px;background:#d1fae5;color:#047857;font-weight:600;font-size:12px}
        .row{display:flex;justify-content:space-between;margin:8px 0;font-size:13px}
        hr{border:0;border-top:1px solid #e6e6e6;margin:12px 0}
      </style></head><body>
      <div class="card"><div class="header">${logoHtml}<div><div class="title">${millName}</div><div class="addr">${millAddress}</div><div class="tag">${gateTypeLabel}</div></div></div>
      <hr/>
      <div class="row"><div>Gate Pass No</div><div>${
        row.gatePassNo || "-"
      }</div></div>
      <div class="row"><div>Date</div><div>${
        row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"
      }</div></div>
      <div class="row"><div>Truck No</div><div>${row.truckNo || "-"}</div></div>
      <div class="row"><div>Customer</div><div>${
        row.customer || "-"
      }</div></div>
      <div class="row"><div>Item</div><div>${row.itemType || "-"}</div></div>
      <div class="row"><div>Quantity</div><div>${row.quantity || "-"} ${
      row.unit || ""
    }</div></div>
      <div class="row"><div>Transporter</div><div>${
        row.transporter || "-"
      }</div></div>
      <div class="row"><div>Driver</div><div>${
        row.driverName || "-"
      }</div></div>
      <hr/>
      <div style="color:#6b7280;font-size:12px">${row.remarks || ""}</div>
      </div><script>window.print();</script></body></html>
    `;
    win.document.write(html);
    win.document.close();
  };

  // CSV export (filtered visible)
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
    a.download = `GatePass_OUT_page${page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // PDF export via print table
  const exportPdf = () => {
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
        <td>${r.customer || ""}</td>
        <td>${r.itemType || ""}</td>
        <td>${r.quantity || ""} ${r.unit || ""}</td>
        <td>${r.transporter || ""}</td>
        <td>${r.driverName || ""}</td>
      </tr>`
      )
      .join("");

    const html = `
      <html><head><title>Gate Passes</title>
      <style>body{font-family:system-ui;padding:20px}.hdr{display:flex;align-items:center;gap:10px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #e5e7eb;padding:6px;text-align:left;font-size:12px}th{background:#f0fdf4;color:#065f46}</style></head><body>
      <div class="hdr">${
        logo
          ? `<img src="${logo}" style="height:36px"/>`
          : '<div style="width:36px;height:36px;background:#ecfdf5;color:#047857;display:inline-flex;align-items:center;justify-content:center;border-radius:6px">GP</div>'
      }<div><div style="font-weight:700">${millName}</div><div style="font-size:12px;color:#6b7280">${millAddress}</div></div></div>
      <table><thead><tr><th>Date</th><th>GP No</th><th>Truck</th><th>Customer</th><th>Item</th><th>Qty</th><th>Transporter</th><th>Driver</th></tr></thead><tbody>${rowsHtml}</tbody></table><script>window.print();</script></body></html>
    `;
    const win = window.open("", "_blank", "width=900,height=700");
    win.document.write(html);
    win.document.close();
  };

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
          Outward Gate Pass
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
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                errors.truckNo ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.truckNo && (
              <p className="text-xs text-red-500 mt-1">{errors.truckNo}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Customer <span className="text-red-500">*</span>
            </label>
            <input
              name="customer"
              value={form.customer}
              onChange={handleChange}
              placeholder="Customer name"
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                errors.customer ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.customer && (
              <p className="text-xs text-red-500 mt-1">{errors.customer}</p>
            )}
            {customerSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                <span className="text-xs text-gray-400 mr-1">Suggestions:</span>
                {customerSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setForm((f) => ({ ...f, customer: s }));
                      clearFieldError("customer");
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
              <option value="Rice">Rice</option>
              <option value="Broken Rice">Broken Rice</option>
              <option value="Bran">Bran</option>
              <option value="Husk">Husk</option>
              <option value="Packaging">Packaging Material</option>
              <option value="Other">Other</option>
            </select>
            {errors.itemType && (
              <p className="text-xs text-red-500 mt-1">{errors.itemType}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Quantity <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                name="quantity"
                value={form.quantity}
                onChange={handleChange}
                placeholder="0"
                className={`flex-1 rounded-lg border px-3 py-2 text-sm outline-none ${
                  errors.quantity ? "border-red-500" : "border-gray-300"
                }`}
              />
              <select
                name="unit"
                value={form.unit}
                onChange={handleChange}
                className="w-24 rounded-lg border px-2 py-2 text-sm outline-none border-gray-300"
              >
                <option value="kg">kg</option>
                <option value="ton">ton</option>
                <option value="bags">bags</option>
                <option value="pcs">pcs</option>
              </select>
            </div>
            {errors.quantity && (
              <p className="text-xs text-red-500 mt-1">{errors.quantity}</p>
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
                  customer: "",
                  itemType: "",
                  quantity: "",
                  unit: "kg",
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

      {/* filter + download (overlay + menu) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 relative">
          <button
            onClick={() => setFilterOpen((s) => !s)}
            className="p-2 rounded bg-emerald-50 hover:bg-emerald-100"
          >
            <Funnel className="w-4 h-4 text-emerald-700" />
          </button>
          {filterOpen && (
            <div className="fixed top-24 right-6 z-40 bg-white border rounded p-3 shadow">
              <div className="flex gap-2 items-center">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="search truck/customer/gp no"
                  className="rounded border px-2 py-1 text-sm outline-none"
                />
                <select
                  value={itemFilter}
                  onChange={(e) => setItemFilter(e.target.value)}
                  className="rounded border px-2 py-1 text-sm outline-none"
                >
                  <option value="">All item types</option>
                  <option value="Rice">Rice</option>
                  <option value="Broken Rice">Broken Rice</option>
                  <option value="Bran">Bran</option>
                  <option value="Husk">Husk</option>
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

      {/* table */}
      <div className="bg-white rounded-xl shadow overflow-x-auto transition-all">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-emerald-50 text-emerald-900">
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Gate Pass No</th>
              <th className="px-3 py-2 text-left">Truck No</th>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-left">Item Type</th>
              <th className="px-3 py-2 text-left">Quantity</th>
              <th className="px-3 py-2 text-left">Transporter</th>
              <th className="px-3 py-2 text-left">Driver</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="px-3 py-4 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-4 text-center text-gray-400">
                  No outward gate passes found.
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
                  <td className="px-3 py-2">{row.customer || "-"}</td>
                  <td className="px-3 py-2">{row.itemType || "-"}</td>
                  <td className="px-3 py-2">
                    {row.quantity || "-"} {row.unit || ""}
                  </td>
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
