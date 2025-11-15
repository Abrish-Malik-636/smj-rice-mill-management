// src/components/GatePass/GatePassOUT.jsx
import React, { useEffect, useRef, useState } from "react";
import api from "../../services/api";
import * as Dialog from "@radix-ui/react-dialog";
import toast, { Toaster } from "react-hot-toast";
import { LogOut, Edit, Trash2, Printer, Download } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";

/**
 * GatePassOUT.jsx (FINAL)
 * - Uses same IN UI
 * - Extra fields: rate, rateType, sendTo, totalAmount (auto)
 * - Table columns = Compact Version B
 * - Stats updated live
 * - Pagination, CSV modal, keyboard shortcuts integrated
 * - Print card (380px)
 * - Dialog accessibility fixed
 * - No warnings
 */

const PAGE_SIZE = 10;

function todayISODate() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function GatePassOUT() {
  // Form
  const [form, setForm] = useState({
    date: todayISODate(),
    companyId: "",
    companyName: "",
    productTypeId: "",
    productTypeName: "",
    numBags: "",
    bagWeightKg: "",
    emptyBagWeightKg: "",
    rate: "",
    rateType: "per_bag",
    sendTo: "",
    remarks: "",
  });

  // FILTERS
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    companyId: "",
    productTypeId: "",
    rateType: "", // OUT only
    search: "",
  });

  // Lists
  const [companies, setCompanies] = useState([]);
  const [products, setProducts] = useState([]);
  const [allList, setAllList] = useState([]);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = PAGE_SIZE;

  // APPLY FILTERS
  const filteredList = allList.filter((g) => {
    // date filter
    if (filters.from && new Date(g.date) < new Date(filters.from)) return false;
    if (filters.to && new Date(g.date) > new Date(filters.to)) return false;

    // company
    if (filters.companyId && g.companyId !== filters.companyId) return false;

    // product
    if (filters.productTypeId && g.productTypeId !== filters.productTypeId)
      return false;

    // rateType (OUT only)
    if (filters.rateType && g.rateType !== filters.rateType) return false;

    // search text (gpno, company, product, sendTo)
    if (filters.search) {
      const s = filters.search.toLowerCase();
      const target =
        `${g.gatePassNo} ${g.companyName} ${g.productTypeName} ${g.sendTo}`.toLowerCase();
      if (!target.includes(s)) return false;
    }

    return true;
  });

  // final pagination
  const pagedList = filteredList.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(filteredList.length / pageSize));

  // Stats
  const [stats, setStats] = useState({
    count: 0,
    totalNetWeight: 0,
    totalAmount: 0,
    lastUpdatedTime: "-",
    nextGatePassNo: "",
  });

  // UI states
  const [loading, setLoading] = useState(false);
  const [printData, setPrintData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const [csvOpen, setCsvOpen] = useState(false);
  const [csvFilename, setCsvFilename] = useState("");
  const [csvScope, setCsvScope] = useState("current");

  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const inputRefs = useRef([]);

  // =========================
  // LOADERS
  // =========================
  useEffect(() => {
    refreshAll();

    const handleKey = (e) => {
      const active = document.activeElement;
      const isInside = inputRefs.current.some((r) => r === active);

      // Ctrl+P
      if (e.ctrlKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        if (selectedId) openPrint(selectedId);
        else toast.error("Select a row first");
      }

      // Ctrl+L
      if (e.ctrlKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        refreshAll();
        toast.success("Reloaded");
      }

      // Shift+Enter → save
      if (e.shiftKey && e.key === "Enter") {
        e.preventDefault();
        handleSave();
      }

      // Enter → next input
      if (!e.shiftKey && e.key === "Enter" && isInside) {
        e.preventDefault();
        const idx = inputRefs.current.findIndex((r) => r === active);
        const next = inputRefs.current[idx + 1];
        if (next) next.focus();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedId]);

  async function refreshAll() {
    await Promise.all([
      loadCompanies(),
      loadProducts(),
      loadList(),
      loadStats(),
    ]);
    setPage(1);
  }

  async function loadCompanies() {
    try {
      const res = await api.get("/companies");
      setCompanies(res.data.data || []);
    } catch (err) {
      console.error("companies", err);
    }
  }

  async function loadProducts() {
    try {
      const res = await api.get("/product-types");
      setProducts(res.data.data || []);
    } catch (err) {
      console.error("products", err);
    }
  }

  async function loadList() {
    try {
      const res = await api.get("/gatepasses?type=OUT");
      const data = res.data.data || [];
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setAllList(data);
    } catch (err) {
      console.error("list", err);
    }
  }

  async function loadStats() {
    try {
      const res = await api.get("/gatepasses/stats/today");
      const full = res.data.data || {};
      const s = full.stats?.OUT || {
        count: 0,
        totalNetWeight: 0,
        totalAmount: 0,
      };
      setStats({
        count: s.count,
        totalNetWeight: s.totalNetWeight,
        totalAmount: s.totalAmount,
        lastUpdatedTime: full.lastUpdatedTime
          ? new Date(full.lastUpdatedTime).toLocaleTimeString()
          : "-",
        nextGatePassNo: full.nextGatePassNo || "",
      });
    } catch (err) {
      console.error("stats", err);
    }
  }

  // =========================
  // FORM HANDLERS
  // =========================
  function handleNumeric(e) {
    const name = e.target.name;
    let v = String(e.target.value);
    v = v.replace(/^0+(?=\d)/, "");
    setForm((s) => ({ ...s, [name]: v }));
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  }

  function computeNet(f) {
    const bags = Number(f.numBags) || 0;
    const bag = Number(f.bagWeightKg) || 0;
    const empty = Number(f.emptyBagWeightKg) || 0;
    const perBag = Math.max(bag - empty, 0);
    return +(bags * perBag).toFixed(3);
  }

  function computeTotal(f) {
    const net = computeNet(f);
    const r = Number(f.rate) || 0;
    return f.rateType === "per_bag"
      ? +(Number(f.numBags) * r).toFixed(2)
      : +(net * r).toFixed(2);
  }

  // =========================
  // SAVE
  // =========================
  async function handleSave() {
    if (
      !form.date ||
      !form.companyId ||
      !form.productTypeId ||
      !form.numBags ||
      !form.bagWeightKg
    ) {
      toast.error(
        "Fill required fields: Date, Company, Product, Bags, Bag Weight"
      );
      return;
    }

    const payload = {
      ...form,
      numBags: Number(form.numBags),
      bagWeightKg: Number(form.bagWeightKg),
      emptyBagWeightKg: Number(form.emptyBagWeightKg || 0),
      rate: Number(form.rate || 0),
      type: "OUT",
    };

    setLoading(true);
    try {
      await api.post("/gatepasses", payload);
      toast.success("OUT GatePass saved");

      setForm({
        date: todayISODate(),
        companyId: "",
        companyName: "",
        productTypeId: "",
        productTypeName: "",
        numBags: "",
        bagWeightKg: "",
        emptyBagWeightKg: 0,
        rate: "",
        rateType: "per_bag",
        sendTo: "",
        remarks: "",
      });

      await refreshAll();
    } catch (err) {
      console.error("save error", err);
      toast.error(err.response?.data?.message || "Save failed");
    }
    setLoading(false);
  }

  // =========================
  // EDIT
  // =========================
  function openEdit(g) {
    setEditData({ ...g });
    setEditOpen(true);
  }

  async function handleUpdate() {
    if (!editData) return;

    const payload = {
      ...editData,
      rate: Number(editData.rate || 0),
      numBags: Number(editData.numBags),
      bagWeightKg: Number(editData.bagWeightKg),
      emptyBagWeightKg: Number(editData.emptyBagWeightKg),
    };
    delete payload.gatePassNo;

    try {
      await api.put(`/gatepasses/${editData._id}`, payload);
      toast.success("Updated OUT gate pass");
      setEditOpen(false);
      await refreshAll();
    } catch (err) {
      console.error("update", err);
      toast.error(err.response?.data?.message || "Update failed");
    }
  }

  // =========================
  // DELETE
  // =========================
  function confirmDelete(id) {
    setDeleteId(id);
    setDeleteOpen(true);
  }

  async function doDelete() {
    if (!deleteId) return;
    try {
      await api.delete(`/gatepasses/${deleteId}`);
      toast.success("Deleted");
      setDeleteOpen(false);
      if (selectedId === deleteId) setSelectedId(null);
      await refreshAll();
    } catch (err) {
      toast.error("Delete failed");
    }
  }

  // =========================
  // PRINT
  // =========================
  async function openPrint(id) {
    try {
      const res = await api.get(`/gatepasses/print/${id}`);
      setPrintData(res.data.data);
    } catch (err) {
      toast.error("Cannot load print preview");
    }
  }

  // =========================
  // CSV EXPORT HELPERS
  // =========================
  function arrayToCSV(rows) {
    if (!rows || rows.length === 0) return "";
    const headers = Object.keys(rows[0]);
    const escape = (v) => {
      if (v == null) return "";
      const s = String(v);
      if (s.includes(",") || s.includes('"') || s.includes("\n"))
        return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [headers.join(",")].concat(
      rows.map((r) => headers.map((h) => escape(r[h])).join(","))
    );
    return lines.join("\n");
  }

  function downloadCSV(rows, filename) {
    const csv = arrayToCSV(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportCSV() {
    const defaultName = `OUT-GatePass-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    const fname = csvFilename.trim() || defaultName;
    const rows = (csvScope === "current" ? pagedList : allList).map((g) => ({
      gatePassNo: g.gatePassNo,
      date: new Date(g.date).toLocaleString(),
      company: g.companyName,
      product: g.productTypeName,
      bags: g.numBags,
      netWeight: g.netWeightKg,
      rate: `${g.rate} (${g.rateType})`,
      totalAmount: g.totalAmount,
      sendTo: g.sendTo,
      remarks: g.remarks || "",
    }));
    downloadCSV(rows, fname);
    toast.success("Exported");
    setCsvOpen(false);
  }

  // =========================
  // TABLE & PAGINATION
  // =========================
  function onRowClick(id) {
    setSelectedId((s) => (s === id ? null : id));
  }

  function goToPage(p) {
    const next = Math.min(Math.max(1, p), totalPages);
    setPage(next);
  }

  // ENTER NAVIGATION
  const setInputRef = (el, idx) => {
    inputRefs.current[idx] = el;
  };

  const printStyles = `
    @media print {
      body * { visibility: hidden; }
      .print-card, .print-card * { visibility: visible; }
      .print-card {
        position: absolute;
        left: 50%; top: 10mm;
        transform: translateX(-50%);
        width: 380px;
      }
    }
  `;
  return (
    <div className="space-y-6">
      <Toaster />
      <style>{printStyles}</style>

      {/* ========================= */}
      {/* STATS */}
      {/* ========================= */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow border-l-4 border-red-400">
          <div className="flex justify-between">
            <div>
              <div className="text-sm text-gray-500">Today OUT count</div>
              <div className="text-2xl font-bold text-red-700">
                {stats.count}
              </div>
            </div>
            <div className="bg-red-100 p-2 rounded-full">
              <LogOut className="text-red-700" />
            </div>
          </div>
          <div className="text-xs text-gray-400 mt-2">
            Last updated: {stats.lastUpdatedTime}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow border-l-4 border-red-300">
          <div className="text-sm text-gray-500">Total OUT Net Wt</div>
          <div className="text-2xl font-bold text-red-700">
            {stats.totalNetWeight} kg
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow border-l-4 border-red-200">
          <div className="text-sm text-gray-500">Cash IN-Hand</div>
          <div className="text-2xl font-bold text-red-700">
            Rs {stats.totalAmount}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow border-l-4 border-red-100">
          <div className="text-sm text-gray-500">Next GP (preview)</div>
          <div className="text-lg font-semibold text-red-700">
            {stats.nextGatePassNo}
          </div>
        </div>
      </div>

      {/* ========================= */}
      {/* FORM */}
      {/* ========================= */}
      <div className="bg-[#FDE8E8] rounded-xl p-6 border border-red-200 shadow-sm">
        <h3 className="text-lg font-semibold text-red-800 mb-4">
          Add OUT Gate Pass
        </h3>

        <div className="grid grid-cols-4 gap-4">
          <input
            ref={(el) => setInputRef(el, 0)}
            type="date"
            name="date"
            value={form.date}
            onChange={handleChange}
            className="border rounded px-3 py-2"
            aria-label="date"
          />

          <select
            ref={(el) => setInputRef(el, 1)}
            name="companyId"
            value={form.companyId}
            onChange={(e) => {
              const id = e.target.value;
              const c = companies.find((x) => x._id === id);
              setForm((s) => ({
                ...s,
                companyId: id,
                companyName: c?.name || "",
              }));
            }}
            className="border rounded px-3 py-2"
          >
            <option value="">Select Company</option>
            {companies.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            ref={(el) => setInputRef(el, 2)}
            name="productTypeId"
            value={form.productTypeId}
            onChange={(e) => {
              const id = e.target.value;
              const p = products.find((x) => x._id === id);
              setForm((s) => ({
                ...s,
                productTypeId: id,
                productTypeName: p?.name || "",
              }));
            }}
            className="border rounded px-3 py-2"
          >
            <option value="">Select Product</option>
            {products.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>

          <input
            ref={(el) => setInputRef(el, 3)}
            type="number"
            name="numBags"
            placeholder="No. of bags"
            value={form.numBags}
            onChange={handleNumeric}
            className="border rounded px-3 py-2"
          />

          <input
            ref={(el) => setInputRef(el, 4)}
            type="number"
            name="bagWeightKg"
            value={form.bagWeightKg}
            onChange={handleNumeric}
            placeholder="Bag weight (kg)"
            className="border rounded px-3 py-2"
          />

          <input
            ref={(el) => setInputRef(el, 5)}
            type="number"
            name="emptyBagWeightKg"
            value={form.emptyBagWeightKg}
            onChange={handleNumeric}
            placeholder="Empty bag weight"
            className="border rounded px-3 py-2"
          />

          {/* OUT extra fields */}
          <input
            ref={(el) => setInputRef(el, 6)}
            type="number"
            name="rate"
            value={form.rate}
            onChange={handleNumeric}
            placeholder="Rate"
            className="border rounded px-3 py-2"
          />

          <select
            ref={(el) => setInputRef(el, 7)}
            name="rateType"
            value={form.rateType}
            onChange={handleChange}
            className="border rounded px-3 py-2"
          >
            <option value="per_bag">Per Bag</option>
            <option value="per_kg">Per Kg</option>
          </select>

          <input
            ref={(el) => setInputRef(el, 8)}
            name="sendTo"
            value={form.sendTo}
            onChange={handleChange}
            placeholder="Send To"
            className="border rounded px-3 py-2"
          />

          <input
            type="text"
            value={computeTotal(form)}
            readOnly
            className="border bg-gray-100 rounded px-3 py-2"
            placeholder="Total Amount"
          />

          {/* remarks full row */}
          <input
            ref={(el) => setInputRef(el, 9)}
            name="remarks"
            value={form.remarks}
            onChange={handleChange}
            placeholder="Remarks"
            className="border rounded px-3 py-2 col-span-4"
          />
        </div>

        <div className="mt-4 flex justify-between">
          <div className="text-sm text-gray-600">
            Net Weight (auto):{" "}
            <span className="text-red-700 font-semibold">
              {computeNet(form)} kg
            </span>
          </div>

          <button
            onClick={handleSave}
            disabled={loading}
            className="bg-red-700 text-white px-5 py-2 rounded hover:bg-red-800"
          >
            {loading ? "Saving..." : "Save OUT GatePass"}
          </button>
        </div>
      </div>

      {/* ========================= */}
      {/* TABLE + PAGINATION */}
      {/* ========================= */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-3 border-b flex justify-between items-center">
          <button
            className="flex gap-2 items-center px-3 py-1 bg-red-50 border rounded hover:bg-red-100"
            onClick={() => setCsvOpen(true)}
          >
            <Download size={16} /> Export CSV
          </button>

          {/* FILTER BUTTON */}
          <Popover.Root>
            <Popover.Trigger asChild>
              <button className="flex gap-2 items-center px-3 py-1 bg-gray-100 border rounded hover:bg-gray-200">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 4a1 1 0 012 0v1h14V4a1 1 0 112 0v1a1 1 0 01-1 1h-1l-5 7v6a1 1 0 01-.553.894l-4 2A1 1 0 018 20v-8L3 6H2a1 1 0 01-1-1V4z"
                  />
                </svg>
                Filters
              </button>
            </Popover.Trigger>

            <Popover.Content
              side="bottom"
              align="end"
              className="bg-white shadow-xl border rounded-lg p-4 w-80 z-50"
            >
              <div className="space-y-3">
                {/* DATE RANGE */}
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="date"
                    value={filters.from}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, from: e.target.value }))
                    }
                    className="border rounded px-2 py-1 text-sm"
                  />
                  <input
                    type="date"
                    value={filters.to}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, to: e.target.value }))
                    }
                    className="border rounded px-2 py-1 text-sm"
                  />
                </div>

                {/* COMPANY */}
                <select
                  value={filters.companyId}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, companyId: e.target.value }))
                  }
                  className="border rounded px-3 py-1 w-full text-sm"
                >
                  <option value="">All Companies</option>
                  {companies.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                {/* PRODUCT */}
                <select
                  value={filters.productTypeId}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, productTypeId: e.target.value }))
                  }
                  className="border rounded px-3 py-1 w-full text-sm"
                >
                  <option value="">All Products</option>
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                {/* OUT ONLY: RATE TYPE */}
                {form.rateType !== undefined && (
                  <select
                    value={filters.rateType}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, rateType: e.target.value }))
                    }
                    className="border rounded px-3 py-1 w-full text-sm"
                  >
                    <option value="">All Rate Types</option>
                    <option value="per_bag">Per Bag</option>
                    <option value="per_kg">Per Kg</option>
                  </select>
                )}

                {/* SEARCH */}
                <input
                  type="text"
                  placeholder="Search GP, Company, Product..."
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, search: e.target.value }))
                  }
                  className="border rounded px-3 py-1 w-full text-sm"
                />

                {/* BUTTONS */}
                <div className="flex justify-between mt-2">
                  <button
                    onClick={() =>
                      setFilters({
                        from: "",
                        to: "",
                        companyId: "",
                        productTypeId: "",
                        rateType: "",
                        search: "",
                      })
                    }
                    className="text-sm px-3 py-1 bg-gray-100 border rounded hover:bg-gray-200"
                  >
                    Clear
                  </button>

                  <Popover.Close asChild>
                    <button className="text-sm px-4 py-1 bg-red-700 text-white rounded hover:bg-red-800">
                      Apply
                    </button>
                  </Popover.Close>
                </div>
              </div>
            </Popover.Content>
          </Popover.Root>

          {/* Pagination */}
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1 border rounded"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
            >
              Previous
            </button>

            {Array.from({ length: totalPages }).map((_, i) => {
              const p = i + 1;
              return (
                <button
                  key={`page-${p}`}
                  className={`px-3 py-1 rounded ${
                    page === p ? "bg-red-700 text-white" : "border"
                  }`}
                  onClick={() => goToPage(p)}
                >
                  {p}
                </button>
              );
            })}

            <button
              className="px-3 py-1 border rounded"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-[#FDECEC] text-red-800">
            <tr>
              <th className="p-3 text-left">GP No</th>
              <th className="p-3">Date</th>
              <th className="p-3">Company</th>
              <th className="p-3">Product</th>
              <th className="p-3 text-right">Bags</th>
              <th className="p-3 text-right">Net Wt</th>
              <th className="p-3 text-right">Rate</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3">Send To</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>

          <tbody>
            {pagedList.map((g, idx) => (
              <tr
                key={g._id}
                onClick={() => onRowClick(g._id)}
                className={`border-b cursor-pointer ${
                  idx % 2 ? "bg-white" : "bg-red-50/30"
                } ${selectedId === g._id ? "ring-2 ring-red-200" : ""}`}
              >
                <td className="p-3">{g.gatePassNo}</td>
                <td className="p-3">{new Date(g.date).toLocaleDateString()}</td>
                <td className="p-3">{g.companyName}</td>
                <td className="p-3">{g.productTypeName}</td>
                <td className="p-3 text-right">{g.numBags}</td>
                <td className="p-3 text-right">{g.netWeightKg}</td>
                <td className="p-3 text-right">
                  {g.rate} ({g.rateType})
                </td>
                <td className="p-3 text-right">{g.totalAmount}</td>
                <td className="p-3">{g.sendTo}</td>

                <td className="p-3 text-center flex justify-center gap-3">
                  <Edit
                    className="text-blue-600 cursor-pointer"
                    size={18}
                    onClick={() => openEdit(g)}
                  />
                  <Trash2
                    className="text-red-600 cursor-pointer"
                    size={18}
                    onClick={() => confirmDelete(g._id)}
                  />
                  <Printer
                    className="text-red-700 cursor-pointer"
                    size={18}
                    onClick={() => openPrint(g._id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ========================= */}
      {/* CSV EXPORT DIALOG */}
      {/* ========================= */}
      <Dialog.Root open={csvOpen} onOpenChange={setCsvOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-5 w-[420px] shadow-xl">
            <Dialog.Title className="text-lg font-semibold">
              Export CSV
            </Dialog.Title>
            <Dialog.Description className="text-sm text-gray-500 mb-3">
              Select filename and scope.
            </Dialog.Description>

            <div className="space-y-3">
              <div>
                <label className="text-sm block mb-1">Filename</label>
                <input
                  value={csvFilename}
                  onChange={(e) => setCsvFilename(e.target.value)}
                  placeholder={`OUT-GatePass-${todayISODate()}.csv`}
                  className="border rounded w-full px-3 py-2"
                />
              </div>

              <div>
                <div className="text-sm mb-1">Scope</div>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={csvScope === "current"}
                      onChange={() => setCsvScope("current")}
                    />
                    Current Page
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={csvScope === "all"}
                      onChange={() => setCsvScope("all")}
                    />
                    All Entries
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  className="border rounded px-4 py-2"
                  onClick={() => setCsvOpen(false)}
                >
                  Cancel
                </button>
                <button
                  onClick={handleExportCSV}
                  className="bg-red-700 text-white px-4 py-2 rounded"
                >
                  Export
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {/* ========================= */}
      {/* PRINT DIALOG */}
      {/* ========================= */}
      {printData && (
        <Dialog.Root open={true} onOpenChange={() => setPrintData(null)}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/40" />

            <Dialog.Content className="print-card fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white w-[380px] rounded-xl p-5 shadow-xl">
              <Dialog.Title className="text-lg font-semibold text-center">
                OUT Gate Pass
              </Dialog.Title>
              <Dialog.Description className="text-center text-sm text-gray-500 mb-3">
                Card-sized print preview
              </Dialog.Description>

              <div className="space-y-1 text-sm">
                <div>
                  <strong>GP No:</strong> {printData.gatePassNo}
                </div>
                <div>
                  <strong>Date:</strong>{" "}
                  {new Date(printData.date).toLocaleString()}
                </div>
                <div>
                  <strong>Company:</strong> {printData.companyName}
                </div>
                <div>
                  <strong>Product:</strong> {printData.productTypeName}
                </div>
                <div>
                  <strong>Bags:</strong> {printData.numBags}
                </div>
                <div>
                  <strong>Net Wt:</strong> {printData.netWeightKg} kg
                </div>
                <div>
                  <strong>Rate:</strong> {printData.rate} ({printData.rateType})
                </div>
                <div>
                  <strong>Total Amount:</strong> Rs {printData.totalAmount}
                </div>
                <div>
                  <strong>Send To:</strong> {printData.sendTo}
                </div>
                <div>
                  <strong>Remarks:</strong> {printData.remarks || "-"}
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  className="flex-1 bg-red-700 text-white py-2 rounded"
                  onClick={() => window.print()}
                >
                  Print
                </button>
                <button
                  className="flex-1 border py-2 rounded"
                  onClick={() => setPrintData(null)}
                >
                  Close
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      {/* ========================= */}
      {/* EDIT DIALOG */}
      {/* ========================= */}
      <Dialog.Root open={editOpen} onOpenChange={setEditOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white w-[480px] rounded-xl p-5 shadow-xl">
            <Dialog.Title className="text-lg font-semibold">
              Edit OUT GatePass
            </Dialog.Title>
            <Dialog.Description className="text-sm text-gray-500 mb-3">
              GatePassNo cannot be changed.
            </Dialog.Description>

            {editData && (
              <div className="space-y-3">
                <input
                  className="border bg-gray-100 rounded px-3 py-2 w-full"
                  value={editData.companyName}
                  disabled
                />

                <div className="grid grid-cols-2 gap-3">
                  <input
                    className="border rounded px-3 py-2"
                    type="number"
                    value={editData.numBags}
                    onChange={(e) =>
                      setEditData((d) => ({
                        ...d,
                        numBags: e.target.value.replace(/^0+(?=\d)/, ""),
                      }))
                    }
                  />

                  <input
                    className="border rounded px-3 py-2"
                    type="number"
                    value={editData.bagWeightKg}
                    onChange={(e) =>
                      setEditData((d) => ({
                        ...d,
                        bagWeightKg: e.target.value.replace(/^0+(?=\d)/, ""),
                      }))
                    }
                  />

                  <input
                    className="border rounded px-3 py-2"
                    type="number"
                    value={editData.emptyBagWeightKg}
                    onChange={(e) =>
                      setEditData((d) => ({
                        ...d,
                        emptyBagWeightKg: e.target.value.replace(
                          /^0+(?=\d)/,
                          ""
                        ),
                      }))
                    }
                  />

                  <input
                    className="border rounded px-3 py-2"
                    type="number"
                    value={editData.rate}
                    onChange={(e) =>
                      setEditData((d) => ({
                        ...d,
                        rate: e.target.value.replace(/^0+(?=\d)/, ""),
                      }))
                    }
                  />
                </div>

                <select
                  className="border rounded px-3 py-2 w-full"
                  value={editData.rateType}
                  onChange={(e) =>
                    setEditData((d) => ({ ...d, rateType: e.target.value }))
                  }
                >
                  <option value="per_bag">Per Bag</option>
                  <option value="per_kg">Per Kg</option>
                </select>

                <input
                  className="border rounded px-3 py-2 w-full"
                  value={editData.sendTo}
                  onChange={(e) =>
                    setEditData((d) => ({ ...d, sendTo: e.target.value }))
                  }
                />

                <input
                  className="border rounded px-3 py-2 w-full"
                  value={editData.remarks || ""}
                  onChange={(e) =>
                    setEditData((d) => ({ ...d, remarks: e.target.value }))
                  }
                />

                <div className="flex justify-end gap-3 mt-4">
                  <button
                    className="px-4 py-2 border rounded"
                    onClick={() => setEditOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 bg-red-700 text-white rounded"
                    onClick={handleUpdate}
                  >
                    Update
                  </button>
                </div>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* ========================= */}
      {/* DELETE DIALOG */}
      {/* ========================= */}
      <Dialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white w-[380px] rounded-xl p-5 shadow-xl">
            <Dialog.Title className="text-lg font-semibold text-center">
              Confirm Delete
            </Dialog.Title>
            <Dialog.Description className="text-sm text-gray-500 text-center mb-4">
              This action cannot be undone.
            </Dialog.Description>

            <div className="flex justify-center gap-3">
              <button
                className="border px-4 py-2 rounded"
                onClick={() => setDeleteOpen(false)}
              >
                Cancel
              </button>
              <button
                className="bg-red-700 text-white px-4 py-2 rounded"
                onClick={doDelete}
              >
                Delete
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
