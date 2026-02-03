import React, { useEffect, useState } from "react";
import { Edit2, Trash2, Printer, X } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../../services/api";
import DataTable from "../ui/DataTable";

export default function GatePassOUT() {
  const [companies, setCompanies] = useState([]);
  const [salesInvoices, setSalesInvoices] = useState([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [form, setForm] = useState({
    truckNo: "",
    customer: "",
    transporter: "",
    driverName: "",
    driverContact: "",
    freightCharges: "",
    remarks: "",
  });

  const [errors, setErrors] = useState({});
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [settings, setSettings] = useState(null);

  // Confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: "",
    message: "",
    onConfirm: null,
    expectedText: "",
  });
  const [confirmInput, setConfirmInput] = useState("");

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

    if (!selectedInvoiceId) {
      newErr.invoiceId = "Invoice is required.";
    }
    setErrors(newErr);
    if (Object.keys(newErr).length > 0) {
      const firstKey = Object.keys(newErr)[0];
      setTimeout(() => {
        document.getElementById(`field-${firstKey}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
      return false;
    }
    return true;
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
        const res = await api.get("/settings");
        if (res.data && res.data.success !== false) {
          setSettings(res.data.data || res.data);
        }
      } catch {}
    };
    loadSettings();
  }, []);

  // Load companies for customer dropdown
  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const res = await api.get("/companies");
        setCompanies(res.data.data || []);
      } catch {}
    };
    loadCompanies();
  }, []);

  // Load sales invoices
  useEffect(() => {
    const loadInvoices = async () => {
      try {
        const res = await api.get("/transactions", {
          params: { type: "SALE", limit: 500, skip: 0 },
        });
        setSalesInvoices(res.data?.data || []);
      } catch {}
    };
    loadInvoices();
  }, []);

  // Fetch rows
  const fetchRows = async () => {
    try {
      setLoading(true);
      const params = {
        page: 1,
        limit: 1000,
        type: "OUT",
      };
      const res = await api.get("/gatepasses", { params });
      if (res.data && res.data.success === false)
        throw new Error(res.data.message || "Failed");
      setRows(res.data.data || []);
    } catch (err) {
      toast.error(err.message || "Unable to fetch gate passes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line
  }, []);

  const normalizeType = (value) => {
    if (!value) return "";
    const trimmed = String(value).trim();
    if (/^both/i.test(trimmed)) return "Both";
    if (/^all/i.test(trimmed)) return "All";
    return trimmed;
  };

  const transporterOptions = companies.filter((c) => {
    const t = normalizeType(c.type);
    return t === "Transporter" || t === "Both" || t === "All";
  });
  const filteredInvoices = salesInvoices;
  const filteredTransporterOptions = transporterOptions;

  // Handlers
  const handleChange = (e) => {
    const { name, value } = e.target;
    let v = value;
    if (name === "truckNo") {
      v = formatTruckInput(value);
    }
    if (name === "driverName") {
      v = value.replace(/[^A-Za-z\s]/g, "");
      v = v.replace(/\s+/g, " ");
    }
    if (name === "driverContact") {
      v = formatContactInput(value);
    }
    if (name === "freightCharges") {
      v = value.replace(/[^\d.]/g, "");
    }
    setForm((prev) => ({ ...prev, [name]: v }));
    validateField(name, v);
  };

  const handleInvoiceChange = (id) => {
    setSelectedInvoiceId(id);
    clearFieldError("invoiceId");
    const invoice = salesInvoices.find((t) => t._id === id);
    if (!invoice) return;
    setForm((prev) => ({
      ...prev,
      customer: invoice.companyName || "",
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    const invoice = salesInvoices.find((t) => t._id === selectedInvoiceId);
    if (!invoice) {
      toast.error("Select a valid invoice.");
      return;
    }

    const payload = {
      ...form,
      type: "OUT",
      invoiceId: invoice._id,
      invoiceNo: invoice.invoiceNo,
      items: (invoice.items || []).map((it) => ({
        itemType: it.productTypeName,
        stockType: "Production",
        customItemName: "",
        quantity: it.netWeightKg || 0,
        unit: "kg",
        rate: it.rate || 0,
        amount: it.amount || 0,
      })),
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
        freightCharges: "",
        remarks: "",
      });
      setSelectedInvoiceId("");
      setEditingId(null);
      setErrors({});
      fetchRows();
    } catch (err) {
      toast.error(err.message || "Unable to save.");
      document.getElementById("gatepass-out-form")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  const handleEdit = (row) => {
    setForm({
      truckNo: row.truckNo || "",
      customer: row.customer || "",
      transporter: row.transporter || "",
      driverName: row.driverName || "",
      driverContact: row.driverContact || "",
      freightCharges: row.freightCharges ? String(row.freightCharges) : "",
      remarks: row.remarks || "",
    });

    setSelectedInvoiceId(row.invoiceId || "");
    setForm((prev) => ({ ...prev, transporter: row.transporter || "" }));

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
      }? This will also remove related stock entries. This action cannot be undone.`,
      onConfirm: async () => {
        if (confirmDialog.expectedText && confirmInput !== confirmDialog.expectedText) {
          toast.error("Please type the gate pass number to confirm.");
          return;
        }
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
            expectedText: "",
          });
          setConfirmInput("");
        }
      },
      expectedText: row.gatePassNo || "DELETE",
    });
    setConfirmInput("");
  };

  // Print window - A5 size
  const openPrintWindow = (row) => {
    const win = window.open("", "_blank", "width=600,height=842");
    if (!win) return;

    const millName = settings?.companyName || settings?.name || "Rice Mill";
    const millAddress = settings?.companyAddress || settings?.address || "";
    const apiHost = api.defaults.baseURL.replace(/\/api\/?$/, "");
    const logo =
      settings?.logoUrl ||
      settings?.logo ||
      settings?.logoPath ||
      `${apiHost}/uploads/logo.png`;

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
        <div><span class="label">Invoice No:</span><span class="value">${
          row.invoiceNo || "-"
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
      
      <button onclick="window.print()" style="margin-top:12px;padding:6px 10px;border:1px solid #ddd;border-radius:4px;background:#047857;color:#fff;font-size:12px;">Print</button>
      </body></html>
    `;
    win.document.write(html);
    win.document.close();
  };

  const tableColumns = [
    {
      key: "createdAt",
      label: "Date",
      render: (val) => (val ? new Date(val).toLocaleDateString() : "-"),
    },
    { key: "gatePassNo", label: "GP No" },
    { key: "invoiceNo", label: "Invoice No" },
    { key: "truckNo", label: "Truck" },
    {
      key: "items",
      label: "Items",
      render: (val, row) => {
        const list = (row.items || [])
          .map((it) =>
            it.itemType === "Other" && it.customItemName
              ? it.customItemName
              : it.itemType
          )
          .filter(Boolean);
        return list.length ? Array.from(new Set(list)).join(", ") : "-";
      },
    },
    {
      key: "customer",
      label: "Customer",
      filterOptions: Array.from(new Set(rows.map((r) => r.customer).filter(Boolean))),
    },
    { key: "driverName", label: "Driver" },
    {
      key: "totalAmount",
      label: "Amount",
      render: (val) => (val != null ? Number(val).toFixed(2) : "0"),
    },
    {
      key: "actions",
      label: "Actions",
      skipExport: true,
      render: (_, row) => (
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
      ),
    },
  ];

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
            {confirmDialog.expectedText && (
              <div className="mb-4">
                <label className="block text-xs text-gray-500 mb-1">
                  Type {confirmDialog.expectedText} to confirm
                </label>
                <input
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none border-gray-300"
                  placeholder={confirmDialog.expectedText}
                />
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() =>
                  setConfirmDialog({
                    open: false,
                    title: "",
                    message: "",
                    onConfirm: null,
                    expectedText: "",
                  })
                }
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                disabled={
                  confirmDialog.expectedText &&
                  confirmInput !== confirmDialog.expectedText
                }
                className={`px-4 py-2 rounded-lg text-sm ${
                  confirmDialog.expectedText &&
                  confirmInput !== confirmDialog.expectedText
                    ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <form
        id="gatepass-out-form"
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow p-4 space-y-4"
      >
        <h2 className="text-lg font-semibold text-emerald-700">
          Outward Gate Pass
        </h2>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Invoice */}
          <div id="field-invoiceId">
            <label className="block text-sm font-medium mb-1">
              Invoice No <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedInvoiceId}
              onChange={(e) => handleInvoiceChange(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                errors.invoiceId ? "border-red-500" : "border-gray-300"
              }`}
            >
              <option value="">Select invoice</option>
              {filteredInvoices.map((inv) => (
                <option key={inv._id} value={inv._id}>
                  {inv.invoiceNo} — {inv.companyName}
                </option>
              ))}
            </select>
            {errors.invoiceId && (
              <p className="text-xs text-red-500 mt-1">{errors.invoiceId}</p>
            )}
          </div>
          <div id="field-truckNo">
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

          {/* Customer (from invoice) */}
          <div id="field-customer">
            <label className="block text-sm font-medium mb-1">
              Customer <span className="text-red-500">*</span>
            </label>
            <input
              name="customer"
              value={form.customer}
              readOnly
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none bg-gray-50 ${
                errors.customer ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="Auto from invoice"
            />
            {errors.customer && (
              <p className="text-xs text-red-500 mt-1">{errors.customer}</p>
            )}
          </div>

          {/* Driver Name */}
          <div id="field-driverName">
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
          <div id="field-driverContact">
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
          <div id="field-transporter">
            <label className="block text-sm font-medium mb-1">
              Transporter
            </label>
            <select
              name="transporter"
              value={form.transporter}
              onChange={handleChange}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                errors.transporter ? "border-red-500" : "border-gray-300"
              }`}
            >
              <option value="">Select transporter</option>
              {filteredTransporterOptions.map((t) => (
                <option key={t._id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
            {errors.transporter && (
              <p className="text-xs text-red-500 mt-1">{errors.transporter}</p>
            )}
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

        {/* Invoice Items Preview */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Invoice Items (read only)
          </h3>
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
            {selectedInvoiceId ? (
              <ul className="list-disc pl-5 space-y-1">
                {(salesInvoices.find((t) => t._id === selectedInvoiceId)?.items || []).map(
                  (it, i) => (
                    <li key={i}>
                      {it.productTypeName} — {Number(it.netWeightKg || 0).toFixed(2)} kg
                    </li>
                  )
                )}
              </ul>
            ) : (
              <span>Select an invoice to see items.</span>
            )}
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
        <div className="flex items-center justify-end gap-3">
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm shadow hover:bg-emerald-700"
          >
            {editingId ? "Update Gate Pass" : "Generate Gate Pass"}
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
                  freightCharges: "",
                  remarks: "",
                });
                setSelectedInvoiceId("");
                setErrors({});
              }}
              className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-xs"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      <DataTable
        title="Gate Pass OUT"
        columns={tableColumns}
        data={rows}
        idKey="_id"
        searchPlaceholder="Search gate passes..."
        emptyMessage={loading ? "Loading..." : "No gate passes found."}
      />
    </div>
  );
}
