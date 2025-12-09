import React, { useEffect, useState } from "react";
import {
  Edit2,
  Trash2,
  Printer,
  Download,
  X,
  Plus,
  Minus,
  Filter,
} from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../services/api";

const PAGE_SIZE = 10;

// Predefined item types for OUT
const ITEM_TYPES = [
  "Rice",
  "Broken Rice",
  "Bran",
  "Husk",
  "Packaging Material",
  "By-Products",
  "Other",
];

const UNITS = ["kg", "ton", "bags", "pcs", "mounds"];

function rowsToCsv(rows) {
  const cols = [
    "createdAt",
    "gatePassNo",
    "truckNo",
    "customer",
    "driverName",
    "driverContact",
    "transporter",
    "biltyNumber",
    "totalQuantity",
    "totalAmount",
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
    transporter: "",
    driverName: "",
    driverContact: "",
    biltyNumber: "",
    vehicleWeight: "",
    freightCharges: "",
    remarks: "",
  });

  // Items array
  const [items, setItems] = useState([
    {
      itemType: "",
      customItemName: "",
      quantity: "",
      unit: "kg",
      rate: "",
      amount: "",
    },
  ]);

  const [errors, setErrors] = useState({});
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [settings, setSettings] = useState(null);

  // Filter states
  const [showFilter, setShowFilter] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: "",
    message: "",
    onConfirm: null,
  });

  // Custom items from database
  const [customItemsList, setCustomItemsList] = useState([]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Validation regex
  const nameRegex = /^[A-Za-z\s]+$/;
  const truckRegex = /^[A-Z]{2,4}-\d{3,4}$/;
  const contactRegex = /^03\d{2}-\d{7}$/;

  const setFieldError = (field, msg) =>
    setErrors((p) => ({ ...p, [field]: msg }));
  const clearFieldError = (field) =>
    setErrors((p) => {
      const c = { ...p };
      delete c[field];
      return c;
    });

  // Validation functions
  const validateTruckNo = (v) => {
    if (!v) return "Truck number is required.";
    if (v.length < 6) return "Truck number too short.";
    if (v.length > 12) return "Truck number too long.";
    if (!truckRegex.test(v)) return "Format: ABC-123 or AB-1234";
    return "";
  };

  const validateCustomer = (v) => {
    if (!v || v.trim() === "") return "Customer is required.";
    if (!nameRegex.test(v)) return "Customer: letters and spaces only.";
    return "";
  };

  const validateDriverName = (v) =>
    !v ? "" : nameRegex.test(v) ? "" : "Driver name: letters and spaces only.";

  const validateDriverContact = (v) => {
    if (!v) return "";
    if (!contactRegex.test(v)) return "Format: 03XX-XXXXXXX (11 digits)";
    return "";
  };

  const validateField = (name, value) => {
    let msg = "";
    if (name === "truckNo") msg = validateTruckNo(value);
    if (name === "customer") msg = validateCustomer(value);
    if (name === "driverName") msg = validateDriverName(value);
    if (name === "driverContact") msg = validateDriverContact(value);
    if (msg) setFieldError(name, msg);
    else clearFieldError(name);
  };

  const validateForm = () => {
    const e1 = validateTruckNo(form.truckNo);
    const e2 = validateCustomer(form.customer);
    const e3 = validateDriverName(form.driverName);
    const e4 = validateDriverContact(form.driverContact);

    const newErr = {};
    if (e1) newErr.truckNo = e1;
    if (e2) newErr.customer = e2;
    if (e3) newErr.driverName = e3;
    if (e4) newErr.driverContact = e4;

    // Validate items
    let hasItemError = false;
    items.forEach((item, idx) => {
      if (!item.itemType) {
        newErr[`item_${idx}_type`] = "Select item type";
        hasItemError = true;
      }
      if (item.itemType === "Other" && !item.customItemName) {
        newErr[`item_${idx}_custom`] = "Specify item name";
        hasItemError = true;
      }
      if (!item.quantity || Number(item.quantity) <= 0) {
        newErr[`item_${idx}_qty`] = "Quantity required";
        hasItemError = true;
      }
    });

    if (items.length === 0) {
      toast.error("Add at least one item.");
      hasItemError = true;
    }

    setErrors(newErr);
    return Object.keys(newErr).length === 0 && !hasItemError;
  };

  // Format truck input
  const formatTruckInput = (raw) => {
    let s = raw.toUpperCase();
    s = s.replace(/[^A-Z0-9]/g, "");
    const letters = s.match(/^[A-Z]*/)[0] || "";
    const digits = s.slice(letters.length) || "";
    if (!digits) return letters;
    return `${letters}-${digits}`.slice(0, 12);
  };

  // Format contact input
  const formatContactInput = (raw) => {
    let s = raw.replace(/[^\d]/g, "");
    if (s.length <= 4) return s;
    return `${s.slice(0, 4)}-${s.slice(4, 11)}`;
  };

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await api.get("/settings/general");
        if (res.data && res.data.success !== false) {
          setSettings(res.data.data || res.data);
        }
      } catch {}
    };
    loadSettings();
  }, []);

  // Load custom items list
  useEffect(() => {
    const loadCustomItems = async () => {
      try {
        const res = await api.get("/gatepasses/custom-items");
        if (res.data && res.data.success) {
          setCustomItemsList(res.data.data || []);
        }
      } catch {}
    };
    loadCustomItems();
  }, []);

  // Fetch rows
  const fetchRows = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: PAGE_SIZE,
        type: "OUT",
        search: searchQuery || "",
        status: statusFilter || "",
      };
      const res = await api.get("/gatepasses", { params });
      if (res.data && res.data.success === false)
        throw new Error(res.data.message || "Failed");
      setRows(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      toast.error(err.message || "Unable to fetch gate passes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line
  }, [page, statusFilter]);

  // Customer suggestions
  const customerSuggestions = errors.customer
    ? Array.from(new Set(rows.map((r) => r.customer).filter(Boolean))).slice(
        0,
        6
      )
    : [];

  // Handlers
  const handleChange = (e) => {
    const { name, value } = e.target;
    let v = value;
    if (name === "truckNo") {
      v = formatTruckInput(value);
    }
    if (name === "customer" || name === "driverName") {
      v = value.replace(/[^A-Za-z\s]/g, "");
      v = v.replace(/\s+/g, " ");
    }
    if (name === "driverContact") {
      v = formatContactInput(value);
    }
    if (name === "vehicleWeight" || name === "freightCharges") {
      v = value.replace(/[^\d.]/g, "");
    }
    setForm((prev) => ({ ...prev, [name]: v }));
    validateField(name, v);
  };

  // Item handlers
  const handleItemChange = (idx, field, value) => {
    const updated = [...items];

    if (field === "itemType") {
      updated[idx][field] = value;
      if (value !== "Other") {
        updated[idx].customItemName = "";
      }
      clearFieldError(`item_${idx}_type`);
    } else if (field === "customItemName") {
      let v = value.replace(/[^A-Za-z\s]/g, "");
      v = v.replace(/\s+/g, " ");
      updated[idx][field] = v;
      clearFieldError(`item_${idx}_custom`);
    } else if (field === "quantity" || field === "rate") {
      const v = value.replace(/[^\d.]/g, "");
      updated[idx][field] = v;

      // Auto-calculate amount
      if (field === "quantity" || field === "rate") {
        const qty =
          field === "quantity" ? Number(v) : Number(updated[idx].quantity);
        const rate = field === "rate" ? Number(v) : Number(updated[idx].rate);
        updated[idx].amount = qty && rate ? (qty * rate).toFixed(2) : "";
      }

      if (field === "quantity") {
        clearFieldError(`item_${idx}_qty`);
      }
    } else {
      updated[idx][field] = value;
    }

    setItems(updated);
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        itemType: "",
        customItemName: "",
        quantity: "",
        unit: "kg",
        rate: "",
        amount: "",
      },
    ]);
  };

  const removeItem = (idx) => {
    if (items.length === 1) {
      toast.error("At least one item is required.");
      return;
    }
    setItems(items.filter((_, i) => i !== idx));
  };

  // Check if custom item should be added to dropdown
  const checkAndAddCustomItem = (customName) => {
    if (!customName || customName.trim() === "") return;

    const trimmed = customName.trim();
    if (customItemsList.includes(trimmed)) return;

    setConfirmDialog({
      open: true,
      title: "Add New Item",
      message: `Do you want to add "${trimmed}" to the items dropdown for future use?`,
      onConfirm: async () => {
        setCustomItemsList([...customItemsList, trimmed]);
        toast.success(`"${trimmed}" added to items list.`);
        setConfirmDialog({
          open: false,
          title: "",
          message: "",
          onConfirm: null,
        });
      },
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    // Check for new custom items
    const newCustomItems = items
      .filter((item) => item.itemType === "Other" && item.customItemName)
      .map((item) => item.customItemName.trim())
      .filter((name) => !customItemsList.includes(name));

    if (newCustomItems.length > 0) {
      checkAndAddCustomItem(newCustomItems[0]);
      return;
    }

    const payload = {
      ...form,
      type: "OUT",
      items: items.map((item) => ({
        itemType: item.itemType,
        customItemName: item.itemType === "Other" ? item.customItemName : "",
        quantity: item.quantity ? Number(item.quantity) : 0,
        unit: item.unit,
        rate: item.rate ? Number(item.rate) : 0,
        amount: item.amount ? Number(item.amount) : 0,
      })),
      vehicleWeight: form.vehicleWeight
        ? Number(form.vehicleWeight)
        : undefined,
      freightCharges: form.freightCharges
        ? Number(form.freightCharges)
        : undefined,
    };

    try {
      const url = editingId ? `/gatepasses/${editingId}` : "/gatepasses";
      const method = editingId ? "put" : "post";
      const res = await api[method](url, payload);
      if (res.data && res.data.success === false)
        throw new Error(res.data.message || "Save failed");
      toast.success(editingId ? "Gate pass updated." : "Gate pass created.");

      // Reset form
      setForm({
        truckNo: "",
        customer: "",
        transporter: "",
        driverName: "",
        driverContact: "",
        biltyNumber: "",
        vehicleWeight: "",
        freightCharges: "",
        remarks: "",
      });
      setItems([
        {
          itemType: "",
          customItemName: "",
          quantity: "",
          unit: "kg",
          rate: "",
          amount: "",
        },
      ]);
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
      transporter: row.transporter || "",
      driverName: row.driverName || "",
      driverContact: row.driverContact || "",
      biltyNumber: row.biltyNumber || "",
      vehicleWeight: row.vehicleWeight ? String(row.vehicleWeight) : "",
      freightCharges: row.freightCharges ? String(row.freightCharges) : "",
      remarks: row.remarks || "",
    });

    if (row.items && row.items.length > 0) {
      setItems(
        row.items.map((item) => ({
          itemType: item.itemType || "",
          customItemName: item.customItemName || "",
          quantity: item.quantity ? String(item.quantity) : "",
          unit: item.unit || "kg",
          rate: item.rate ? String(item.rate) : "",
          amount: item.amount ? String(item.amount) : "",
        }))
      );
    } else {
      setItems([
        {
          itemType: "",
          customItemName: "",
          quantity: "",
          unit: "kg",
          rate: "",
          amount: "",
        },
      ]);
    }

    setEditingId(row._id);
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = (row) => {
    setConfirmDialog({
      open: true,
      title: "Delete Gate Pass",
      message: `Are you sure you want to delete Gate Pass ${
        row.gatePassNo || ""
      }? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          const res = await api.delete(`/gatepasses/${row._id}`);
          if (res.data && res.data.success === false)
            throw new Error(res.data.message || "Delete failed");
          toast.success("Gate pass deleted.");
          fetchRows();
        } catch (err) {
          toast.error(err.message || "Unable to delete");
        } finally {
          setConfirmDialog({
            open: false,
            title: "",
            message: "",
            onConfirm: null,
          });
        }
      },
    });
  };

  // Print window - A5 size
  const openPrintWindow = (row) => {
    const win = window.open("", "_blank", "width=600,height=842");
    if (!win) return;

    const millName = settings?.companyName || settings?.name || "Rice Mill";
    const millAddress = settings?.companyAddress || settings?.address || "";
    const logo = settings?.logo || settings?.logoUrl || "";

    const logoHtml = logo
      ? `<img src="${logo}" style="height:50px;margin-right:12px;" alt="logo" />`
      : `<div style="width:50px;height:50px;background:#d1fae5;color:#047857;display:inline-flex;align-items:center;justify-content:center;font-weight:700;margin-right:12px;border-radius:8px;font-size:20px;">GP</div>`;

    let itemsHtml = "";
    if (row.items && row.items.length > 0) {
      itemsHtml = row.items
        .map((item) => {
          const displayName =
            item.itemType === "Other" && item.customItemName
              ? `${item.itemType} (${item.customItemName})`
              : item.itemType || "-";
          return `<tr>
          <td style="border:1px solid #ddd;padding:6px;">${displayName}</td>
          <td style="border:1px solid #ddd;padding:6px;text-align:right;">${
            item.quantity || 0
          } ${item.unit || ""}</td>
          <td style="border:1px solid #ddd;padding:6px;text-align:right;">${
            item.rate || 0
          }</td>
          <td style="border:1px solid #ddd;padding:6px;text-align:right;">${
            item.amount || 0
          }</td>
        </tr>`;
        })
        .join("");
    }

    const html = `
      <html><head><title>Gate Pass ${row.gatePassNo || ""}</title>
      <style>
        @media print { @page { size: A5; margin: 10mm; } }
        body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;margin:0;padding:12mm;width:148mm;min-height:210mm;box-sizing:border-box;}
        .header{display:flex;align-items:center;border-bottom:2px solid #047857;padding-bottom:10px;margin-bottom:12px;}
        .title{font-weight:700;color:#047857;font-size:18px;line-height:1.2;}
        .addr{font-size:11px;color:#6b7280;margin-top:2px;}
        .tag{display:inline-block;margin-top:4px;padding:3px 8px;border-radius:4px;background:#fef3c7;color:#92400e;font-weight:600;font-size:11px;}
        .info{display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;margin:12px 0;}
        .info div{display:flex;justify-content:space-between;padding:4px 0;}
        .label{color:#6b7280;font-weight:500;}
        .value{color:#111;font-weight:600;}
        table{width:100%;border-collapse:collapse;margin:12px 0;font-size:11px;}
        th{background:#f0fdf4;color:#065f46;padding:6px;border:1px solid #ddd;text-align:left;}
        .remarks{font-size:11px;color:#6b7280;margin-top:12px;padding:8px;background:#f9fafb;border-radius:4px;}
        .footer{margin-top:20px;font-size:10px;color:#9ca3af;text-align:center;border-top:1px solid #e5e7eb;padding-top:8px;}
      </style></head><body>
      <div class="header">
        ${logoHtml}
        <div style="flex:1;">
          <div class="title">${millName}</div>
          <div class="addr">${millAddress}</div>
          <div class="tag">OUTWARD GATE PASS</div>
        </div>
      </div>
      
      <div class="info">
        <div><span class="label">Gate Pass No:</span><span class="value">${
          row.gatePassNo || "-"
        }</span></div>
        <div><span class="label">Date:</span><span class="value">${
          row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "-"
        }</span></div>
        <div><span class="label">Truck No:</span><span class="value">${
          row.truckNo || "-"
        }</span></div>
        <div><span class="label">Customer:</span><span class="value">${
          row.customer || "-"
        }</span></div>
        <div><span class="label">Driver:</span><span class="value">${
          row.driverName || "-"
        }</span></div>
        <div><span class="label">Contact:</span><span class="value">${
          row.driverContact || "-"
        }</span></div>
        <div><span class="label">Transporter:</span><span class="value">${
          row.transporter || "-"
        }</span></div>
        <div><span class="label">Bilty No:</span><span class="value">${
          row.biltyNumber || "-"
        }</span></div>
      </div>

      <table>
        <thead><tr><th>Item Description</th><th style="text-align:right;">Quantity</th><th style="text-align:right;">Rate</th><th style="text-align:right;">Amount</th></tr></thead>
        <tbody>${itemsHtml}</tbody>
        <tfoot>
          <tr style="background:#f0fdf4;font-weight:700;">
            <td style="border:1px solid #ddd;padding:6px;" colspan="2">Total</td>
            <td style="border:1px solid #ddd;padding:6px;text-align:right;">${
              row.totalQuantity || 0
            }</td>
            <td style="border:1px solid #ddd;padding:6px;text-align:right;">${
              row.totalAmount || 0
            }</td>
          </tr>
        </tfoot>
      </table>

      ${
        row.remarks
          ? `<div class="remarks"><strong>Remarks:</strong> ${row.remarks}</div>`
          : ""
      }
      
      <div class="footer">
        <div>Authorized Signature: _________________</div>
        <div style="margin-top:4px;">Printed on ${new Date().toLocaleString()}</div>
      </div>
      
      <script>window.print();</script>
      </body></html>
    `;
    win.document.write(html);
    win.document.close();
  };

  // CSV export
  const exportCsv = () => {
    if (!rows || rows.length === 0) {
      toast.error("No data to export.");
      return;
    }
    const csv = rowsToCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GatePass_OUT_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Apply filter
  const applyFilter = () => {
    setPage(1);
    fetchRows();
  };

  return (
    <div className="space-y-4">
      {/* Confirmation Dialog */}
      {confirmDialog.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {confirmDialog.title}
              </h3>
              <button
                onClick={() =>
                  setConfirmDialog({
                    open: false,
                    title: "",
                    message: "",
                    onConfirm: null,
                  })
                }
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              {confirmDialog.message}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() =>
                  setConfirmDialog({
                    open: false,
                    title: "",
                    message: "",
                    onConfirm: null,
                  })
                }
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow p-4 space-y-4"
      >
        <h2 className="text-lg font-semibold text-emerald-700">
          Outward Gate Pass
        </h2>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Truck No */}
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

          {/* Customer */}
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
                {customerSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setForm((f) => ({ ...f, customer: s }));
                      clearFieldError("customer");
                    }}
                    className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Driver Name */}
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

          {/* Driver Contact */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Driver Contact
            </label>
            <input
              name="driverContact"
              value={form.driverContact}
              onChange={handleChange}
              placeholder="03XX-XXXXXXX"
              maxLength={12}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                errors.driverContact ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.driverContact && (
              <p className="text-xs text-red-500 mt-1">
                {errors.driverContact}
              </p>
            )}
          </div>

          {/* Transporter */}
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

          {/* Bilty Number */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Bilty/LR Number
            </label>
            <input
              name="biltyNumber"
              value={form.biltyNumber}
              onChange={handleChange}
              placeholder="Optional"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none border-gray-300"
            />
          </div>

          {/* Vehicle Weight */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Vehicle Weight (kg)
            </label>
            <input
              name="vehicleWeight"
              value={form.vehicleWeight}
              onChange={handleChange}
              placeholder="0"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none border-gray-300"
            />
          </div>

          {/* Freight Charges */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Freight Charges
            </label>
            <input
              name="freightCharges"
              value={form.freightCharges}
              onChange={handleChange}
              placeholder="0"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none border-gray-300"
            />
          </div>
        </div>

        {/* Items Section */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Items</h3>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-sm"
            >
              <Plus className="w-4 h-4" /> Add Item
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="grid md:grid-cols-7 gap-3 items-start p-3 bg-gray-50 rounded-lg"
              >
                {/* Item Type */}
                <div className="md:col-span-2">
                  <select
                    value={item.itemType}
                    onChange={(e) =>
                      handleItemChange(idx, "itemType", e.target.value)
                    }
                    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                      errors[`item_${idx}_type`]
                        ? "border-red-500"
                        : "border-gray-300"
                    }`}
                  >
                    <option value="">Select item</option>
                    {ITEM_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                    {customItemsList.map((custom) => (
                      <option key={custom} value="Other">
                        {custom}
                      </option>
                    ))}
                  </select>
                  {errors[`item_${idx}_type`] && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors[`item_${idx}_type`]}
                    </p>
                  )}
                </div>

                {/* Custom Item Name (if Other) */}
                {item.itemType === "Other" && (
                  <div className="md:col-span-2">
                    <input
                      value={item.customItemName}
                      onChange={(e) =>
                        handleItemChange(idx, "customItemName", e.target.value)
                      }
                      placeholder="Specify item"
                      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                        errors[`item_${idx}_custom`]
                          ? "border-red-500"
                          : "border-gray-300"
                      }`}
                    />
                    {errors[`item_${idx}_custom`] && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors[`item_${idx}_custom`]}
                      </p>
                    )}
                  </div>
                )}

                {/* Quantity */}
                <div
                  className={item.itemType === "Other" ? "" : "md:col-span-2"}
                >
                  <div className="flex gap-2">
                    <input
                      value={item.quantity}
                      onChange={(e) =>
                        handleItemChange(idx, "quantity", e.target.value)
                      }
                      placeholder="Qty"
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm outline-none ${
                        errors[`item_${idx}_qty`]
                          ? "border-red-500"
                          : "border-gray-300"
                      }`}
                    />
                    <select
                      value={item.unit}
                      onChange={(e) =>
                        handleItemChange(idx, "unit", e.target.value)
                      }
                      className="w-20 rounded-lg border px-2 py-2 text-sm outline-none border-gray-300"
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  {errors[`item_${idx}_qty`] && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors[`item_${idx}_qty`]}
                    </p>
                  )}
                </div>

                {/* Rate */}
                <div>
                  <input
                    value={item.rate}
                    onChange={(e) =>
                      handleItemChange(idx, "rate", e.target.value)
                    }
                    placeholder="Rate"
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none border-gray-300"
                  />
                </div>

                {/* Amount (auto-calculated) */}
                <div>
                  <input
                    value={item.amount}
                    readOnly
                    placeholder="Amount"
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none border-gray-200 bg-gray-100"
                  />
                </div>

                {/* Remove Button */}
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="p-2 rounded-lg hover:bg-red-50 text-red-500"
                    title="Remove item"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Remarks */}
        <div>
          <label className="block text-sm font-medium mb-1">Remarks</label>
          <textarea
            name="remarks"
            value={form.remarks}
            onChange={handleChange}
            rows={2}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none border-gray-300"
          />
        </div>

        {/* Submit Buttons */}
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
                  transporter: "",
                  driverName: "",
                  driverContact: "",
                  biltyNumber: "",
                  vehicleWeight: "",
                  freightCharges: "",
                  remarks: "",
                });
                setItems([
                  {
                    itemType: "",
                    customItemName: "",
                    quantity: "",
                    unit: "kg",
                    rate: "",
                    amount: "",
                  },
                ]);
                setErrors({});
              }}
              className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-xs"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      {/* Filter & Actions Bar */}
      <div className="flex items-center justify-between gap-3">
        {/* Filter Button & Inline Filter */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilter(!showFilter)}
            className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
          >
            <Filter className="w-4 h-4" />
          </button>

          {showFilter && (
            <div className="flex items-center gap-2 animate-fadeIn">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="rounded-lg border px-3 py-2 text-sm outline-none border-gray-300 w-48"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm outline-none border-gray-300"
              >
                <option value="">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
              <button
                onClick={applyFilter}
                className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700"
              >
                Apply
              </button>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("");
                  setShowFilter(false);
                }}
                className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm hover:bg-gray-200"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Export Button */}
        <button
          onClick={exportCsv}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-emerald-50 text-emerald-900">
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">GP No</th>
              <th className="px-3 py-2 text-left">Truck</th>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-left">Driver</th>
              <th className="px-3 py-2 text-right">Total Qty</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-center">Status</th>
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
                  No gate passes found.
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
                  <td className="px-3 py-2 font-medium">
                    {row.gatePassNo || "-"}
                  </td>
                  <td className="px-3 py-2">{row.truckNo || "-"}</td>
                  <td className="px-3 py-2">{row.customer || "-"}</td>
                  <td className="px-3 py-2">{row.driverName || "-"}</td>
                  <td className="px-3 py-2 text-right font-medium">
                    {row.totalQuantity || 0}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {row.totalAmount || 0}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                        row.status === "Completed"
                          ? "bg-green-100 text-green-700"
                          : row.status === "Cancelled"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {row.status || "Pending"}
                    </span>
                  </td>
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

        {/* Pagination */}
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
