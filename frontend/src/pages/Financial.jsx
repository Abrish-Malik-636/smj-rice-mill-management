// src/pages/Financial.jsx
import React, { useEffect, useState } from "react";
import {
  CreditCard,
  ArrowDownCircle,
  ArrowUpCircle,
  Edit2,
  Plus,
  AlertCircle,
  Trash2,
  Save,
  Printer,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import api from "../services/api";

const PAGE_SIZE = 10;

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const emptyForm = {
  date: todayISO(),
  companyId: "",
  paymentStatus: "PAID", // default Paid
  paymentMethod: "CASH", // default Cash
  dueDate: "",
  partialPaid: "",
  remarks: "",
};

const makeEmptyItem = () => ({
  productTypeId: "",
  numBags: "",
  perBagWeightKg: "",
  netWeightKg: "",
  rate: "",
  rateType: "per_bag",
});

export default function Financial() {
  // Tabs
  const [activeTab, setActiveTab] = useState("sale");

  // Masters
  const [companies, setCompanies] = useState([]);
  const [products, setProducts] = useState([]);

  // Stock balances: [{ companyId, companyName, productTypeId, productTypeName, balanceKg }]
  const [stockBalances, setStockBalances] = useState([]);

  // PURCHASE state
  const [purchaseForm, setPurchaseForm] = useState({ ...emptyForm });
  const [purchaseItems, setPurchaseItems] = useState([makeEmptyItem()]);
  const [purchaseEditingId, setPurchaseEditingId] = useState(null);
  const [purchaseList, setPurchaseList] = useState([]);
  const [purchaseTotal, setPurchaseTotal] = useState(0);
  const [purchasePage, setPurchasePage] = useState(1);
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  // SALE state
  const [saleForm, setSaleForm] = useState({ ...emptyForm });
  const [saleItems, setSaleItems] = useState([makeEmptyItem()]);
  const [saleEditingId, setSaleEditingId] = useState(null);
  const [saleList, setSaleList] = useState([]);
  const [saleTotal, setSaleTotal] = useState(0);
  const [salePage, setSalePage] = useState(1);
  const [saleLoading, setSaleLoading] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Print dialog
  const [printTxn, setPrintTxn] = useState(null);
  const [printSettings, setPrintSettings] = useState(null);
  const [loadingSettings, setLoadingSettings] = useState(false);

  // Print-only CSS for small invoice card
  const printStyles = `
    @media print {
      body * {
        visibility: hidden;
      }
      #print-invoice, #print-invoice * {
        visibility: visible;
      }
      #print-invoice {
        position: absolute;
        inset: 0;
        margin: auto;
        max-width: 80mm;
      }
    }
  `;

  // Load masters + stock
  useEffect(() => {
    const loadMasters = async () => {
      try {
        const [cRes, pRes] = await Promise.all([
          api.get("/companies"),
          api.get("/product-types"),
        ]);
        setCompanies(cRes.data.data || []);
        setProducts(pRes.data.data || []);
      } catch (err) {
        console.error("Error loading masters:", err);
        toast.error("Failed to load master data");
      }
    };

    loadMasters();
    loadStockBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initial transactions
  useEffect(() => {
    fetchTransactions("PURCHASE", 1);
    fetchTransactions("SALE", 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load stock balances from backend
  const loadStockBalances = async () => {
    try {
      // our route: /api/stock/current
      const res = await api.get("/stock/current");
      setStockBalances(res.data.data || []);
    } catch (err) {
      console.error("Error loading stock balances:", err);
    }
  };

  const fetchTransactions = async (type, page = 1) => {
    const skip = (page - 1) * PAGE_SIZE;
    if (type === "PURCHASE") setPurchaseLoading(true);
    if (type === "SALE") setSaleLoading(true);
    try {
      const res = await api.get("/transactions", {
        params: { type, limit: PAGE_SIZE, skip },
      });
      const { data = [], total = 0 } = res.data || {};
      if (type === "PURCHASE") {
        setPurchaseList(data);
        setPurchaseTotal(total);
        setPurchasePage(page);
      } else {
        setSaleList(data);
        setSaleTotal(total);
        setSalePage(page);
      }
    } catch (err) {
      console.error("Error loading transactions:", err);
      toast.error("Failed to load transactions");
    } finally {
      if (type === "PURCHASE") setPurchaseLoading(false);
      if (type === "SALE") setSaleLoading(false);
    }
  };

  const totalPagesFor = (total) =>
    Math.max(1, Math.ceil((total || 0) / PAGE_SIZE));

  // Helpers
  const handleFormChange = (type, field, value) => {
    if (type === "PURCHASE") {
      setPurchaseForm((f) => ({ ...f, [field]: value }));
    } else {
      setSaleForm((f) => ({ ...f, [field]: value }));
    }
  };

  const handleItemChange = (type, index, field, value) => {
    const list = type === "PURCHASE" ? [...purchaseItems] : [...saleItems];
    const item = { ...list[index], [field]: value };

    // Auto net weight = bags × perBagWeight
    if (field === "numBags" || field === "perBagWeightKg") {
      const bags = Number(field === "numBags" ? value : item.numBags || 0) || 0;
      const perBag =
        Number(field === "perBagWeightKg" ? value : item.perBagWeightKg || 0) ||
        0;
      if (bags && perBag) {
        item.netWeightKg = (bags * perBag).toFixed(3);
      } else {
        item.netWeightKg = "";
      }
    }

    list[index] = item;
    if (type === "PURCHASE") setPurchaseItems(list);
    else setSaleItems(list);
  };

  const addItemRow = (type) => {
    if (type === "PURCHASE")
      setPurchaseItems((items) => [...items, makeEmptyItem()]);
    else setSaleItems((items) => [...items, makeEmptyItem()]);
  };

  const computeLineAmount = (item) => {
    const bags = Number(item.numBags || 0);
    const perBag = Number(item.perBagWeightKg || 0);
    const rate = Number(item.rate || 0);
    const net =
      item.netWeightKg !== "" && item.netWeightKg != null
        ? Number(item.netWeightKg)
        : bags && perBag
        ? bags * perBag
        : 0;

    if (!rate) return 0;
    if (item.rateType === "per_bag") return bags * rate;
    return net * rate;
  };

  const computeInvoiceTotal = (items) =>
    items.reduce((sum, it) => sum + computeLineAmount(it), 0);

  // Stock helper
  const getStockBalance = (companyId, productTypeId) => {
    if (!companyId || !productTypeId) return null;
    const row = stockBalances.find(
      (b) => b.companyId === companyId && b.productTypeId === productTypeId
    );
    if (!row) return null;
    return Number(row.balanceKg || 0);
  };

  const validateForm = (type) => {
    const form = type === "PURCHASE" ? purchaseForm : saleForm;
    const items = type === "PURCHASE" ? purchaseItems : saleItems;

    if (!form.date) {
      toast.error("Date is required");
      return false;
    }
    if (!form.companyId) {
      toast.error("Please select a company");
      return false;
    }

    const total = computeInvoiceTotal(items);
    const payStatus = form.paymentStatus || "PAID";

    if ((payStatus === "UNPAID" || payStatus === "PARTIAL") && !form.dueDate) {
      toast.error("Due date is required for unpaid or partial invoices");
      return false;
    }

    if (payStatus === "PARTIAL") {
      const paid = Number(form.partialPaid || 0);
      if (!paid || paid <= 0) {
        toast.error("For partial payment, amount paid must be > 0");
        return false;
      }
      if (paid > total) {
        toast.error("Amount paid cannot exceed total invoice amount");
        return false;
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      toast.error("Add at least one item");
      return false;
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.productTypeId) {
        toast.error(`Item ${i + 1}: Select a product`);
        return false;
      }
      const rate = Number(it.rate || 0);
      if (!rate || rate <= 0) {
        toast.error(`Item ${i + 1}: Rate must be greater than 0`);
        return false;
      }
      const net =
        it.netWeightKg !== "" && it.netWeightKg != null
          ? Number(it.netWeightKg)
          : Number(it.numBags || 0) * Number(it.perBagWeightKg || 0);
      if (!net || net <= 0) {
        toast.error(`Item ${i + 1}: Net weight must be > 0`);
        return false;
      }
    }

    // Extra validation for SALE: cannot sell more than stock
    if (type === "SALE" && stockBalances.length && form.companyId) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const net =
          it.netWeightKg !== "" && it.netWeightKg != null
            ? Number(it.netWeightKg)
            : Number(it.numBags || 0) * Number(it.perBagWeightKg || 0);

        const bal = getStockBalance(form.companyId, it.productTypeId);

        if (bal != null && net > bal + 0.0001) {
          toast.error(
            `Item ${i + 1}: Net weight (${net.toFixed(
              3
            )} kg) exceeds available stock (${bal.toFixed(3)} kg)`
          );
          return false;
        }
      }
    }

    return true;
  };

  const buildPayload = (type) => {
    const form = type === "PURCHASE" ? purchaseForm : saleForm;
    const items = type === "PURCHASE" ? purchaseItems : saleItems;
    const total = computeInvoiceTotal(items);

    const mappedItems = items.map((it) => {
      const bags = Number(it.numBags || 0);
      const perBag = Number(it.perBagWeightKg || 0);
      const net =
        it.netWeightKg !== "" && it.netWeightKg != null
          ? Number(it.netWeightKg)
          : bags && perBag
          ? bags * perBag
          : 0;

      return {
        productTypeId: it.productTypeId,
        numBags: bags,
        perBagWeightKg: perBag,
        netWeightKg: net,
        rate: Number(it.rate || 0),
        rateType: it.rateType || "per_kg",
      };
    });

    const baseRemarks = form.remarks || "";
    let finalRemarks = baseRemarks;

    if (form.paymentStatus === "PARTIAL") {
      const paid = Number(form.partialPaid || 0);
      const remaining = Math.max(total - paid, 0);
      const extra = `Paid: Rs ${paid.toFixed(
        2
      )}, Remaining: Rs ${remaining.toFixed(2)}, Due: ${form.dueDate || "-"}`;
      finalRemarks = baseRemarks ? `${baseRemarks} | ${extra}` : extra;
    }

    return {
      type: type === "PURCHASE" ? "PURCHASE" : "SALE",
      date: form.date,
      companyId: form.companyId,
      paymentStatus: form.paymentStatus || "PAID",
      paymentMethod: form.paymentMethod || "CASH",
      dueDate: form.paymentStatus === "PAID" ? null : form.dueDate || null,
      remarks: finalRemarks,
      items: mappedItems,
    };
  };

  const resetForm = (type) => {
    if (type === "PURCHASE") {
      setPurchaseForm({ ...emptyForm });
      setPurchaseItems([makeEmptyItem()]);
      setPurchaseEditingId(null);
    } else {
      setSaleForm({ ...emptyForm });
      setSaleItems([makeEmptyItem()]);
      setSaleEditingId(null);
    }
  };

  const handleSubmit = async (type, e) => {
    e.preventDefault();
    if (!validateForm(type)) return;

    const payload = buildPayload(type);
    const isEditing =
      type === "PURCHASE" ? !!purchaseEditingId : !!saleEditingId;
    const editingId = type === "PURCHASE" ? purchaseEditingId : saleEditingId;

    try {
      if (isEditing) {
        await api.put(`/transactions/${editingId}`, payload);
        toast.success(`${type === "PURCHASE" ? "Purchase" : "Sale"} updated`);
      } else {
        await api.post("/transactions", payload);
        toast.success(`${type === "PURCHASE" ? "Purchase" : "Sale"} saved`);
      }
      resetForm(type);
      fetchTransactions(type, 1);
      // reload stock after any transaction
      loadStockBalances();
    } catch (err) {
      console.error("Save transaction error:", err);
      const msg = err?.response?.data?.message || "Failed to save transaction";
      toast.error(msg);
    }
  };

  const handleEdit = (type, txn) => {
    setActiveTab(type === "PURCHASE" ? "purchase" : "sale");

    const form = {
      date: txn.date
        ? new Date(txn.date).toISOString().slice(0, 10)
        : todayISO(),
      companyId: txn.companyId || "",
      paymentStatus: txn.paymentStatus || "PAID",
      paymentMethod: txn.paymentMethod || "CASH",
      dueDate: txn.dueDate
        ? new Date(txn.dueDate).toISOString().slice(0, 10)
        : "",
      partialPaid: "",
      remarks: txn.remarks || "",
    };

    const items = (txn.items || []).map((it) => ({
      productTypeId: it.productTypeId || "",
      numBags:
        it.numBags !== null && it.numBags !== undefined
          ? String(it.numBags)
          : "",
      perBagWeightKg:
        it.perBagWeightKg !== null && it.perBagWeightKg !== undefined
          ? String(it.perBagWeightKg)
          : "",
      netWeightKg:
        it.netWeightKg !== null && it.netWeightKg !== undefined
          ? String(it.netWeightKg)
          : "",
      rate: it.rate !== null && it.rate !== undefined ? String(it.rate) : "",
      rateType: it.rateType || "per_kg",
    }));

    if (type === "PURCHASE") {
      setPurchaseForm(form);
      setPurchaseItems(items.length ? items : [makeEmptyItem()]);
      setPurchaseEditingId(txn._id);
    } else {
      setSaleForm(form);
      setSaleItems(items.length ? items : [makeEmptyItem()]);
      setSaleEditingId(txn._id);
    }
  };

  const openDeleteDialog = (txn) => setDeleteTarget(txn);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/transactions/${deleteTarget._id}`);
      toast.success("Transaction deleted");
      fetchTransactions(deleteTarget.type, 1);
      loadStockBalances();
      setDeleteTarget(null);
    } catch (err) {
      console.error("Delete transaction error:", err);
      toast.error("Failed to delete transaction");
    } finally {
      setDeleting(false);
    }
  };

  const openPrintDialog = async (txn) => {
    setPrintTxn(txn);
    if (!printSettings) {
      setLoadingSettings(true);
      try {
        const res = await api.get("/settings");
        setPrintSettings(res.data.data || null);
      } catch (err) {
        console.error("Error loading settings for print:", err);
        toast.error("Failed to load settings for print");
      } finally {
        setLoadingSettings(false);
      }
    }
  };

  // Summary cards (simple)
  const todaySummaryCards = () => {
    const saleTotalToday = saleList.reduce(
      (sum, t) => sum + (t.totalAmount || 0),
      0
    );
    const purchaseTotalToday = purchaseList.reduce(
      (sum, t) => sum + (t.totalAmount || 0),
      0
    );

    const cards = [
      {
        title: "Today Sales",
        value: `Rs. ${saleTotalToday.toFixed(0)}`,
        icon: <ArrowUpCircle size={20} />,
        accent: "border-emerald-400",
      },
      {
        title: "Today Purchases",
        value: `Rs. ${purchaseTotalToday.toFixed(0)}`,
        icon: <ArrowDownCircle size={20} />,
        accent: "border-sky-400",
      },
      {
        title: "Transactions Loaded",
        value: saleList.length + purchaseList.length,
        icon: <CreditCard size={20} />,
        accent: "border-amber-400",
      },
    ];

    return (
      <div className="grid grid-cols-3 gap-4">
        {cards.map((c, idx) => (
          <div
            key={idx}
            className={`bg-white rounded-lg p-4 shadow-sm border-l-4 ${c.accent}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-400">{c.title}</div>
                <div className="text-xl font-semibold text-emerald-900 mt-1">
                  {c.value}
                </div>
              </div>
              <div className="text-emerald-600">{c.icon}</div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderForm = (type) => {
    const form = type === "PURCHASE" ? purchaseForm : saleForm;
    const items = type === "PURCHASE" ? purchaseItems : saleItems;
    const isEditing =
      type === "PURCHASE" ? !!purchaseEditingId : !!saleEditingId;
    const working = type === "PURCHASE" ? purchaseLoading : saleLoading;

    const total = computeInvoiceTotal(items);
    const partialPaid = Number(form.partialPaid || 0);
    const partialRemaining =
      form.paymentStatus === "PARTIAL" ? Math.max(total - partialPaid, 0) : 0;

    return (
      <form
        onSubmit={(e) => handleSubmit(type, e)}
        className="space-y-4 bg-emerald-50 p-4 rounded-lg"
      >
        {/* Row 1: Date + Company */}
        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-1">
            <label className="text-xs text-gray-600 flex items-center gap-1">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              className="w-full border p-2 rounded text-sm"
              value={form.date}
              onChange={(e) => handleFormChange(type, "date", e.target.value)}
            />
          </div>

          <div className="col-span-3">
            <label className="text-xs text-gray-600 flex items-center gap-1">
              Company <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full border p-2 rounded text-sm"
              value={form.companyId}
              onChange={(e) =>
                handleFormChange(type, "companyId", e.target.value)
              }
            >
              <option value="">Select company</option>
              {companies.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Remarks */}
        <div>
          <label className="text-xs text-gray-600">Remarks</label>
          <input
            type="text"
            className="w-full border p-2 rounded text-sm"
            value={form.remarks}
            onChange={(e) => handleFormChange(type, "remarks", e.target.value)}
            placeholder="Optional notes"
          />
        </div>

        {/* Items table */}
        <div className="bg-white border rounded-lg">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <div className="text-sm font-semibold text-emerald-800">
              {type === "PURCHASE" ? "Purchase Items" : "Sale Items"}
            </div>
            <button
              type="button"
              onClick={() => addItemRow(type)}
              className="flex items-center gap-1 text-xs px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
            >
              <Plus size={14} /> Add Item
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-emerald-100 text-emerald-800">
                <tr>
                  <th className="p-2 text-left">Product</th>
                  <th className="p-2 text-right">Bags</th>
                  <th className="p-2 text-right">Per Bag (kg)</th>
                  <th className="p-2 text-right">Net Weight (kg)</th>
                  <th className="p-2 text-right">Rate</th>
                  <th className="p-2 text-left">Rate Type</th>
                  <th className="p-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => {
                  const lineAmount = computeLineAmount(it);

                  // Stock-aware product options for SALE
                  let productOptions = products;
                  if (
                    type === "SALE" &&
                    form.companyId &&
                    stockBalances.length
                  ) {
                    const availableIds = new Set(
                      stockBalances
                        .filter(
                          (b) =>
                            b.companyId === form.companyId &&
                            Number(b.balanceKg || 0) > 0
                        )
                        .map((b) => b.productTypeId)
                    );
                    productOptions = products.filter((p) =>
                      availableIds.has(p._id)
                    );
                  }

                  const balance =
                    type === "SALE" && form.companyId && it.productTypeId
                      ? getStockBalance(form.companyId, it.productTypeId)
                      : null;

                  return (
                    <tr key={idx} className="border-t align-top">
                      <td className="p-2">
                        <select
                          className="border p-1 rounded w-full"
                          value={it.productTypeId}
                          onChange={(e) =>
                            handleItemChange(
                              type,
                              idx,
                              "productTypeId",
                              e.target.value
                            )
                          }
                        >
                          <option value="">
                            {type === "SALE" && form.companyId
                              ? "Select stock item"
                              : "Select product"}
                          </option>
                          {productOptions.map((p) => (
                            <option key={p._id} value={p._id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0"
                          className="border p-1 rounded w-full text-right"
                          value={it.numBags}
                          onChange={(e) =>
                            handleItemChange(
                              type,
                              idx,
                              "numBags",
                              e.target.value
                            )
                          }
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          className="border p-1 rounded w-full text-right"
                          value={it.perBagWeightKg}
                          onChange={(e) =>
                            handleItemChange(
                              type,
                              idx,
                              "perBagWeightKg",
                              e.target.value
                            )
                          }
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="0.001"
                          className="border p-1 rounded w-full text-right bg-gray-50"
                          value={it.netWeightKg}
                          readOnly
                        />
                        {type === "SALE" &&
                          form.companyId &&
                          it.productTypeId && (
                            <div className="mt-1 text-[10px] text-gray-500 text-right">
                              {balance != null
                                ? `Available: ${balance.toFixed(3)} kg in stock`
                                : "No stock info"}
                            </div>
                          )}
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="border p-1 rounded w-full text-right"
                          value={it.rate}
                          onChange={(e) =>
                            handleItemChange(type, idx, "rate", e.target.value)
                          }
                        />
                      </td>
                      <td className="p-2">
                        <select
                          className="border p-1 rounded w-full"
                          value={it.rateType}
                          onChange={(e) =>
                            handleItemChange(
                              type,
                              idx,
                              "rateType",
                              e.target.value
                            )
                          }
                        >
                          <option value="per_kg">Per Kg</option>
                          <option value="per_bag">Per Bag</option>
                        </select>
                      </td>
                      <td className="p-2 text-right">
                        {lineAmount.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-gray-400 p-3">
                      No items added
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment section AFTER items */}
        <div className="grid grid-cols-4 gap-3 items-end">
          <div className="col-span-2">
            <label className="text-xs text-gray-600">Payment Status</label>
            <div className="flex items-center gap-4 mt-1 text-sm">
              <label className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  name={`${type}-paymentStatus`}
                  value="PAID"
                  checked={form.paymentStatus === "PAID"}
                  onChange={(e) =>
                    handleFormChange(type, "paymentStatus", e.target.value)
                  }
                />
                <span>Paid</span>
              </label>
              <label className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  name={`${type}-paymentStatus`}
                  value="UNPAID"
                  checked={form.paymentStatus === "UNPAID"}
                  onChange={(e) =>
                    handleFormChange(type, "paymentStatus", e.target.value)
                  }
                />
                <span>Unpaid</span>
              </label>
              <label className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  name={`${type}-paymentStatus`}
                  value="PARTIAL"
                  checked={form.paymentStatus === "PARTIAL"}
                  onChange={(e) =>
                    handleFormChange(type, "paymentStatus", e.target.value)
                  }
                />
                <span>Partial</span>
              </label>
            </div>
          </div>

          <div className="col-span-1">
            <label className="text-xs text-gray-600">Payment Method</label>
            <select
              className="w-full border p-2 rounded text-sm"
              value={form.paymentMethod}
              onChange={(e) =>
                handleFormChange(type, "paymentMethod", e.target.value)
              }
            >
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CREDIT">Credit</option>
            </select>
          </div>

          <div className="col-span-1">
            <label className="text-xs text-gray-600 flex items-center gap-1">
              Due Date
              {form.paymentStatus !== "PAID" && (
                <span className="text-red-500">*</span>
              )}
            </label>
            <input
              type="date"
              className="w-full border p-2 rounded text-sm"
              value={form.dueDate}
              onChange={(e) =>
                handleFormChange(type, "dueDate", e.target.value)
              }
              disabled={form.paymentStatus === "PAID"}
            />
          </div>

          <div className="col-span-1">
            <label className="text-xs text-gray-600">Total Amount</label>
            <div className="w-full border p-2 rounded text-sm bg-gray-50 text-right">
              Rs. {total.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Partial details */}
        {form.paymentStatus === "PARTIAL" && (
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-1">
              <label className="text-xs text-gray-600">Amount Paid (Rs)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full border p-2 rounded text-sm text-right"
                value={form.partialPaid}
                onChange={(e) =>
                  handleFormChange(type, "partialPaid", e.target.value)
                }
              />
            </div>
            <div className="col-span-1">
              <label className="text-xs text-gray-600">Remaining (Rs)</label>
              <div className="w-full border p-2 rounded text-sm bg-gray-50 text-right">
                Rs. {partialRemaining.toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <AlertCircle size={12} />
            <span>All validations run when you press Save.</span>
          </div>
          <div className="flex gap-2">
            {isEditing && (
              <button
                type="button"
                onClick={() => resetForm(type)}
                className="px-3 py-2 rounded bg-gray-200 text-gray-700 text-sm flex items-center gap-1"
              >
                <AlertCircle size={14} />
                Cancel Edit
              </button>
            )}

            <button
              type="submit"
              disabled={working}
              className="px-3 py-2 rounded bg-emerald-600 text-white text-sm flex items-center gap-1 disabled:opacity-60"
            >
              <Save size={14} />
              {isEditing
                ? working
                  ? "Updating..."
                  : "Update Transaction"
                : working
                ? "Saving..."
                : type === "PURCHASE"
                ? "Save Purchase"
                : "Save Sale"}
            </button>
          </div>
        </div>
      </form>
    );
  };

  const renderTable = (type) => {
    const list = type === "PURCHASE" ? purchaseList : saleList;
    const total = type === "PURCHASE" ? purchaseTotal : saleTotal;
    const page = type === "PURCHASE" ? purchasePage : salePage;
    const loading = type === "PURCHASE" ? purchaseLoading : saleLoading;

    const totalPages = totalPagesFor(total);

    return (
      <div className="bg-white rounded-lg shadow-sm p-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-emerald-800">
            Recent {type === "PURCHASE" ? "Purchases" : "Sales"}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page <= 1 || loading}
              onClick={() => fetchTransactions(type, Math.max(1, page - 1))}
              className="px-2 py-1 border rounded disabled:opacity-50"
            >
              Prev
            </button>
            <button
              disabled={page >= totalPages || loading}
              onClick={() =>
                fetchTransactions(type, Math.min(totalPages, page + 1))
              }
              className="px-2 py-1 border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border rounded">
            <thead className="bg-emerald-100 text-emerald-800">
              <tr>
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-left">Invoice #</th>
                <th className="p-2 text-left">Company</th>
                <th className="p-2 text-right">Items</th>
                <th className="p-2 text-right">Total Amount</th>
                <th className="p-2 text-left">Payment</th>
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => {
                const dateStr = t.date
                  ? new Date(t.date).toLocaleDateString()
                  : "-";
                return (
                  <tr key={t._id} className="border-t hover:bg-gray-50">
                    <td className="p-2">{dateStr}</td>
                    <td className="p-2">{t.invoiceNo}</td>
                    <td className="p-2">{t.companyName}</td>
                    <td className="p-2 text-right">{t.items?.length || 0}</td>
                    <td className="p-2 text-right">
                      {t.totalAmount?.toFixed(2)}
                    </td>
                    <td className="p-2">
                      <div className="flex flex-col gap-0.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            t.paymentStatus === "PAID"
                              ? "bg-emerald-100 text-emerald-700"
                              : t.paymentStatus === "PARTIAL"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {t.paymentStatus}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {t.paymentMethod || "CASH"}
                        </span>
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(type, t)}
                          className="text-blue-500 hover:text-blue-700"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => openPrintDialog(t)}
                          className="text-emerald-600 hover:text-emerald-800"
                          title="Print"
                        >
                          <Printer size={14} />
                        </button>
                        <button
                          onClick={() => openDeleteDialog(t)}
                          className="text-red-500 hover:text-red-700"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="text-center text-gray-400 p-3">
                    No transactions found
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={7} className="text-center text-gray-400 p-3">
                    Loading...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const tabs = [
    {
      key: "sale",
      label: "Sales",
      icon: <ArrowUpCircle size={18} />,
    },
    {
      key: "purchase",
      label: "Purchases",
      icon: <ArrowDownCircle size={18} />,
    },
  ];

  return (
    <div className="space-y-6">
      <style>{printStyles}</style>
      <Toaster position="top-center" />

      {/* Title */}
      <div>
        <h2 className="text-3xl font-bold text-emerald-900">Transactions</h2>
        <p className="text-gray-500 text-sm">
          Manage sale and purchase invoices linked with master data and stock.
        </p>
      </div>

      {/* Summary */}
      {todaySummaryCards()}

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200 mt-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition border-b-2 ${
              activeTab === tab.key
                ? "text-emerald-700 border-emerald-700 bg-emerald-50"
                : "text-gray-500 border-transparent hover:text-emerald-600 hover:bg-gray-50"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-4">
        {activeTab === "sale" && (
          <>
            {renderForm("SALE")}
            {renderTable("SALE")}
          </>
        )}
        {activeTab === "purchase" && (
          <>
            {renderForm("PURCHASE")}
            {renderTable("PURCHASE")}
          </>
        )}
      </div>

      {/* Delete dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-5 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-emerald-900 mb-2">
              Delete Transaction?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently delete invoice{" "}
              <span className="font-semibold">{deleteTarget.invoiceNo}</span>.
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-2 rounded bg-gray-200 text-gray-700 text-sm"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-3 py-2 rounded bg-rose-600 text-white text-sm disabled:opacity-60"
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print dialog (small card) */}
      {printTxn && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 print:bg-transparent">
          <div
            id="print-invoice"
            className="bg-white rounded-lg shadow-lg p-5 w-full max-w-lg print:shadow-none print:border print:border-gray-300"
          >
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <div className="flex items-center gap-3">
                {printSettings?.logoUrl && (
                  <img
                    src={printSettings.logoUrl}
                    alt="Logo"
                    className="h-10 object-contain"
                  />
                )}
                <div>
                  <div className="text-sm font-semibold text-emerald-900">
                    {printSettings?.companyName || "SMJ Rice Mill"}
                  </div>
                  {printSettings?.address && (
                    <div className="text-[11px] text-gray-500">
                      {printSettings.address}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right text-xs text-gray-500">
                <div>Invoice: {printTxn.invoiceNo}</div>
                <div>
                  Date:{" "}
                  {printTxn.date
                    ? new Date(printTxn.date).toLocaleDateString()
                    : "-"}
                </div>
              </div>
            </div>

            <div className="text-xs mb-3">
              <div className="flex justify-between">
                <div>
                  <span className="font-semibold">Type: </span>
                  {printTxn.type}
                </div>
                <div>
                  <span className="font-semibold">Company: </span>
                  {printTxn.companyName}
                </div>
              </div>
              <div className="flex justify-between mt-1">
                <div>
                  <span className="font-semibold">Payment: </span>
                  {printTxn.paymentStatus}
                  {printTxn.paymentMethod && (
                    <span className="ml-1 text-gray-500">
                      ({printTxn.paymentMethod})
                    </span>
                  )}
                </div>
                {printTxn.dueDate && (
                  <div>
                    <span className="font-semibold">Due Date: </span>
                    {new Date(printTxn.dueDate).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>

            <div className="border rounded mb-3 overflow-hidden">
              <table className="w-full text-[11px]">
                <thead className="bg-emerald-50 text-emerald-900">
                  <tr>
                    <th className="p-1 text-left">Product</th>
                    <th className="p-1 text-right">Bags</th>
                    <th className="p-1 text-right">Per Bag</th>
                    <th className="p-1 text-right">Net (kg)</th>
                    <th className="p-1 text-right">Rate</th>
                    <th className="p-1 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {printTxn.items?.map((it, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-1">{it.productTypeName}</td>
                      <td className="p-1 text-right">{it.numBags}</td>
                      <td className="p-1 text-right">{it.perBagWeightKg}</td>
                      <td className="p-1 text-right">{it.netWeightKg}</td>
                      <td className="p-1 text-right">
                        {it.rate} / {it.rateType === "per_bag" ? "bag" : "kg"}
                      </td>
                      <td className="p-1 text-right">
                        {it.amount?.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t bg-emerald-50">
                    <td colSpan={5} className="p-1 text-right font-semibold">
                      Total
                    </td>
                    <td className="p-1 text-right font-semibold">
                      {printTxn.totalAmount?.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {printTxn.remarks && (
              <div className="text-[11px] text-gray-600 mb-3">
                <span className="font-semibold">Remarks: </span>
                {printTxn.remarks}
              </div>
            )}

            <div className="flex justify-end gap-2 print:hidden">
              <button
                type="button"
                onClick={() => setPrintTxn(null)}
                className="px-3 py-1.5 rounded bg-gray-200 text-gray-700 text-xs"
                disabled={loadingSettings}
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs flex items-center gap-1 disabled:opacity-60"
                disabled={loadingSettings}
              >
                <Printer size={12} />
                Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
