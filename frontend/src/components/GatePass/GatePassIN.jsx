// src/components/GatePass/GatePassIN.jsx
import React, { useEffect, useRef, useState } from "react";
import api from "../../services/api";
import * as Dialog from "@radix-ui/react-dialog";
import toast, { Toaster } from "react-hot-toast";
import { LogIn, Edit, Trash2, Printer, Download } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";

const PAGE_SIZE = 10;

function todayISODate() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function GatePassIN() {
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

  // Lists and data
  const [companies, setCompanies] = useState([]);
  const [products, setProducts] = useState([]);
  const [allList, setAllList] = useState([]); // full list from backend

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

  // Stats object
  const [stats, setStats] = useState({
    count: 0,
    totalNetWeight: 0,
    lastUpdatedTime: "-",
    nextGatePassNo: "",
  });

  // UI & modal states
  const [loading, setLoading] = useState(false);
  const [printData, setPrintData] = useState(null);

  const [csvOpen, setCsvOpen] = useState(false);
  const [csvFilename, setCsvFilename] = useState("");
  const [csvScope, setCsvScope] = useState("current"); // 'current' | 'all'

  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  // selection for keyboard print
  const [selectedId, setSelectedId] = useState(null);

  // refs for Enter navigation
  const inputRefs = useRef([]);

  // --- Lifecycle: load initial data ---
  useEffect(() => {
    refreshAll();

    const handleKey = (e) => {
      // Scope Enter navigation to our inputs only
      const active = document.activeElement;
      const isInside = inputRefs.current.some((r) => r && r === active);

      // Ctrl+P -> print selected
      if (e.ctrlKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        if (selectedId) {
          openPrint(selectedId);
        } else {
          toast.error("No gate pass selected to print (click a row first).");
        }
      }

      // Ctrl+L -> reload
      if (e.ctrlKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        refreshAll();
        toast.success("Reloaded");
      }

      // Shift+Enter -> save
      if (e.shiftKey && e.key === "Enter") {
        e.preventDefault();
        handleSave();
      }

      // Enter -> next input (only inside our inputs)
      if (!e.shiftKey && e.key === "Enter" && isInside) {
        e.preventDefault();
        const idx = inputRefs.current.findIndex((r) => r === active);
        const next = inputRefs.current[idx + 1];
        if (next) next.focus();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // --- Data loaders ---
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
      console.error("loadCompanies", err);
    }
  }

  async function loadProducts() {
    try {
      const res = await api.get("/product-types");
      setProducts(res.data.data || []);
    } catch (err) {
      console.error("loadProducts", err);
    }
  }

  async function loadList() {
    try {
      const res = await api.get("/gatepasses?type=IN");
      const data = res.data.data || [];
      // sort by date desc then createdAt desc for stable order
      data.sort(
        (a, b) =>
          new Date(b.date) - new Date(a.date) ||
          new Date(b.updatedAt) - new Date(a.updatedAt)
      );
      setAllList(data);
    } catch (err) {
      console.error("loadList", err);
    }
  }

  async function loadStats() {
    try {
      const res = await api.get("/gatepasses/stats/today");
      const full = res.data.data || {};
      const s = full.stats?.IN || { count: 0, totalNetWeight: 0 };
      setStats({
        count: s.count || 0,
        totalNetWeight: s.totalNetWeight || 0,
        lastUpdatedTime: full.lastUpdatedTime
          ? new Date(full.lastUpdatedTime).toLocaleTimeString()
          : "-",
        nextGatePassNo: full.nextGatePassNo || "",
      });
    } catch (err) {
      console.error("loadStats", err);
    }
  }

  // --- Form handlers ---
  function handleNumeric(e) {
    const name = e.target.name;
    let v = String(e.target.value || "");
    v = v.replace(/^0+(?=\d)/, ""); // remove leading zeros but allow single 0
    setForm((s) => ({ ...s, [name]: v }));
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  }

  function computeNet(f) {
    const numBags = Number(f.numBags) || 0;
    const bagWeightKg = Number(f.bagWeightKg) || 0;
    const empty = Number(f.emptyBagWeightKg) || 0;
    const perBagNet = Math.max(bagWeightKg - empty, 0);
    return +(numBags * perBagNet).toFixed(3);
  }

  // --- Save ---
  async function handleSave() {
    if (
      !form.date ||
      !form.companyId ||
      !form.productTypeId ||
      !form.numBags ||
      !form.bagWeightKg
    ) {
      toast.error(
        "Please fill required fields: Date, Company, Product, Bags, Bag Weight"
      );
      return;
    }

    const payload = {
      ...form,
      numBags: Number(form.numBags),
      bagWeightKg: Number(form.bagWeightKg),
      emptyBagWeightKg: Number(form.emptyBagWeightKg || 0),
    };

    setLoading(true);
    try {
      await api.post("/gatepasses", { ...payload, type: "IN" });
      toast.success("IN Gate Pass saved");
      setForm({
        date: todayISODate(),
        companyId: "",
        companyName: "",
        productTypeId: "",
        productTypeName: "",
        numBags: "",
        bagWeightKg: "",
        emptyBagWeightKg: 0,
        remarks: "",
      });
      await refreshAll();
    } catch (err) {
      console.error("save error", err);
      toast.error(err.response?.data?.message || "Save failed");
    }
    setLoading(false);
  }

  // --- Edit flow ---
  function openEdit(g) {
    setEditData({ ...g });
    setEditOpen(true);
  }

  async function handleUpdate() {
    if (!editData) return;
    const payload = { ...editData };
    delete payload.gatePassNo;
    setLoading(true);
    try {
      await api.put(`/gatepasses/${editData._id}`, payload);
      toast.success("Updated");
      setEditOpen(false);
      await refreshAll();
    } catch (err) {
      console.error("update error", err);
      toast.error(err.response?.data?.message || "Update failed");
    }
    setLoading(false);
  }

  // --- Delete flow ---
  function confirmDelete(id) {
    setDeleteId(id);
    setDeleteOpen(true);
  }

  async function doDelete() {
    if (!deleteId) return;
    setLoading(true);
    try {
      await api.delete(`/gatepasses/${deleteId}`);
      toast.success("Deleted");
      setDeleteOpen(false);
      if (selectedId === deleteId) setSelectedId(null);
      await refreshAll();
    } catch (err) {
      console.error("delete error", err);
      toast.error("Delete failed");
    }
    setLoading(false);
  }

  // --- Print flow ---
  async function openPrint(id) {
    try {
      const res = await api.get(`/gatepasses/print/${id}`);
      setPrintData(res.data.data);
    } catch (err) {
      console.error("print error", err);
      toast.error("Cannot load print preview");
    }
  }

  // --- CSV Export helpers (in-file) ---
  function arrayToCSV(rows) {
    if (!rows || rows.length === 0) return "";
    const headers = Object.keys(rows[0]);
    const escape = (v) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
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
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleExportCSV() {
    const defaultName = `IN-GatePass-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    const fname = csvFilename.trim() || defaultName;
    const rows = (csvScope === "current" ? pagedList : filteredList).map(
      (g) => ({
        gatePassNo: g.gatePassNo,
        date: new Date(g.date).toLocaleString(),
        companyName: g.companyName,
        productTypeName: g.productTypeName,
        numBags: g.numBags,
        bagWeightKg: g.bagWeightKg,
        emptyBagWeightKg: g.emptyBagWeightKg,
        netWeightKg: g.netWeightKg,
        remarks: g.remarks || "",
      })
    );
    downloadCSV(rows, fname);
    setCsvOpen(false);
    setCsvFilename("");
    toast.success("CSV exported");
  }

  // --- Row selection ---
  function onRowClick(id) {
    setSelectedId((s) => (s === id ? null : id));
  }

  // --- Pagination helpers ---
  function goToPage(p) {
    const next = Math.min(
      Math.max(1, p),
      Math.max(1, Math.ceil(allList.length / pageSize))
    );
    setPage(next);
  }

  // --- Input refs registration (Enter navigation) ---
  const setInputRef = (el, idx) => {
    inputRefs.current[idx] = el;
  };

  // Print-only CSS for the card
  const printStyles = `
    @media print {
      body * { visibility: hidden; }
      .print-card, .print-card * { visibility: visible; }
      .print-card { position: absolute; left: 50%; top: 10mm; transform: translateX(-50%); }
    }
  `;

  return (
    <div className="space-y-6">
      <Toaster />
      <style>{printStyles}</style>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-emerald-400">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Today IN count</div>
              <div className="text-2xl font-bold text-emerald-800">
                {stats.count || 0}
              </div>
            </div>
            <div className="bg-emerald-100 p-2 rounded-full">
              <LogIn className="text-emerald-700" />
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-400">
            Last updated: {stats.lastUpdatedTime}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-emerald-300">
          <div>
            <div className="text-sm text-gray-500">
              Total IN net weight (today)
            </div>
            <div className="text-2xl font-bold text-emerald-800">
              {stats.totalNetWeight || 0} kg
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-emerald-200">
          <div>
            <div className="text-sm text-gray-500">Next GatePass (preview)</div>
            <div className="text-lg font-semibold text-emerald-800">
              {stats.nextGatePassNo || "Auto"}
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-[#E8F9F1] rounded-xl p-6 border border-emerald-100 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-emerald-800">
            Add IN Gate Pass
          </h3>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <input
            ref={(el) => setInputRef(el, 0)}
            className="bg-white border rounded px-3 py-2"
            type="date"
            name="date"
            value={form.date}
            onChange={handleChange}
            placeholder="Date"
            aria-label="date"
          />

          <select
            ref={(el) => setInputRef(el, 1)}
            className="bg-white border rounded px-3 py-2"
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
            aria-label="company"
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
            className="bg-white border rounded px-3 py-2"
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
            aria-label="product"
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
            className="bg-white border rounded px-3 py-2"
            type="number"
            name="numBags"
            value={form.numBags}
            onChange={handleNumeric}
            placeholder="No. of bags"
            aria-label="numBags"
          />

          <input
            ref={(el) => setInputRef(el, 4)}
            className="bg-white border rounded px-3 py-2"
            type="number"
            name="bagWeightKg"
            value={form.bagWeightKg}
            onChange={handleNumeric}
            placeholder="Bag weight (kg)"
            aria-label="bagWeightKg"
          />

          <input
            ref={(el) => setInputRef(el, 5)}
            className="bg-white border rounded px-3 py-2"
            type="number"
            name="emptyBagWeightKg"
            value={form.emptyBagWeightKg}
            onChange={handleNumeric}
            placeholder="Empty bag weight"
            aria-label="emptyBagWeightKg"
          />

          {/* Remarks spanning full row to avoid stray empty cell */}
          <input
            ref={(el) => setInputRef(el, 6)}
            className="bg-white border rounded px-3 py-2 col-span-4"
            type="text"
            name="remarks"
            value={form.remarks}
            onChange={handleChange}
            placeholder="Remarks"
            aria-label="remarks"
          />
        </div>

        <div className="mt-4 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Net weight (auto):{" "}
            <span className="font-semibold text-emerald-700">
              {computeNet(form)} kg
            </span>
          </div>
          <div>
            <button
              onClick={handleSave}
              disabled={loading}
              className="bg-emerald-700 text-white px-5 py-2 rounded shadow hover:bg-emerald-800"
            >
              {loading ? "Saving..." : "Save IN GatePass"}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-3">
            <button
              className="flex items-center gap-2 px-3 py-1 bg-emerald-50 border rounded hover:bg-emerald-100"
              onClick={() => setCsvOpen(true)}
            >
              <Download size={16} /> Export CSV
            </button>
          </div>

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

          {/* Pagination controls */}
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1 border rounded"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
            >
              Previous
            </button>

            {Array.from({ length: totalPages }).map((_, i) => {
              const p = i + 1;
              return (
                <button
                  key={`pg-${p}`}
                  onClick={() => goToPage(p)}
                  className={`px-3 py-1 rounded ${
                    p === page ? "bg-emerald-700 text-white" : "border"
                  }`}
                >
                  {p}
                </button>
              );
            })}

            <button
              className="px-3 py-1 border rounded"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
            >
              Next
            </button>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-[#E6F9F0] text-emerald-800">
            <tr>
              <th className="p-3 text-left">GP No</th>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Company</th>
              <th className="p-3 text-left">Product</th>
              <th className="p-3 text-right">Bags</th>
              <th className="p-3 text-right">Net Wt (kg)</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pagedList.map((g, idx) => (
              <tr
                key={g._id}
                className={`${idx % 2 ? "bg-white" : "bg-gray-50"} border-b ${
                  selectedId === g._id ? "ring-2 ring-emerald-200" : ""
                }`}
                onClick={() => onRowClick(g._id)}
              >
                <td className="p-3">{g.gatePassNo}</td>
                <td className="p-3">{new Date(g.date).toLocaleDateString()}</td>
                <td className="p-3">{g.companyName}</td>
                <td className="p-3">{g.productTypeName}</td>
                <td className="p-3 text-right">{g.numBags}</td>
                <td className="p-3 text-right">{g.netWeightKg}</td>
                <td className="p-3 text-center flex justify-center gap-3">
                  <Edit
                    className="cursor-pointer text-blue-600"
                    size={18}
                    onClick={() => openEdit(g)}
                  />
                  <Trash2
                    className="cursor-pointer text-red-600"
                    size={18}
                    onClick={() => confirmDelete(g._id)}
                  />
                  <Printer
                    className="cursor-pointer text-emerald-700"
                    size={18}
                    onClick={() => openPrint(g._id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CSV Export Dialog */}
      <Dialog.Root open={csvOpen} onOpenChange={setCsvOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl p-5 w-[420px]">
            <Dialog.Title className="text-lg font-semibold">
              Export CSV
            </Dialog.Title>
            <Dialog.Description className="text-sm text-gray-500 mb-3">
              Choose filename and scope (current page or all entries).
            </Dialog.Description>

            <div className="space-y-3">
              <div>
                <label className="text-sm block mb-1">Filename</label>
                <input
                  value={csvFilename}
                  onChange={(e) => setCsvFilename(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  placeholder={`IN-GatePass-${new Date()
                    .toISOString()
                    .slice(0, 10)}.csv`}
                />
              </div>

              <div>
                <label className="text-sm block mb-1">Scope</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="scope-in"
                      checked={csvScope === "current"}
                      onChange={() => setCsvScope("current")}
                    />{" "}
                    Current page
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="scope-in"
                      checked={csvScope === "all"}
                      onChange={() => setCsvScope("all")}
                    />{" "}
                    All entries
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  className="px-4 py-2 border rounded"
                  onClick={() => setCsvOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 bg-emerald-700 text-white rounded"
                  onClick={handleExportCSV}
                >
                  Export
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Print Dialog (card-sized) */}
      {printData && (
        <Dialog.Root open={true} onOpenChange={() => setPrintData(null)}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/40" />
            <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl p-5 w-[380px] print-card">
              <Dialog.Title className="text-center text-lg font-semibold">
                Gate Pass (IN)
              </Dialog.Title>
              <Dialog.Description className="text-center text-sm text-gray-500 mb-3">
                Card-sized print preview
              </Dialog.Description>

              <div className="text-sm space-y-1">
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
                  <strong>Remarks:</strong> {printData.remarks || "-"}
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  className="flex-1 bg-emerald-700 text-white py-2 rounded"
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

      {/* Edit Dialog */}
      <Dialog.Root open={editOpen} onOpenChange={setEditOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl p-5 w-[480px]">
            <Dialog.Title className="text-lg font-semibold">
              Edit IN Gate Pass
            </Dialog.Title>
            <Dialog.Description className="text-sm text-gray-500 mb-3">
              Modify fields and click Update. GatePassNo cannot be changed.
            </Dialog.Description>

            {editData && (
              <div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    className="bg-gray-100 border rounded px-3 py-2"
                    value={editData.companyName || ""}
                    disabled
                  />
                  <input
                    className="border rounded px-3 py-2"
                    type="number"
                    value={editData.numBags || ""}
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
                    value={editData.bagWeightKg || ""}
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
                    value={editData.emptyBagWeightKg || ""}
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
                    className="col-span-2 border rounded px-3 py-2"
                    value={editData.remarks || ""}
                    onChange={(e) =>
                      setEditData((d) => ({ ...d, remarks: e.target.value }))
                    }
                  />
                </div>

                <div className="mt-4 flex justify-end gap-3">
                  <button
                    className="px-4 py-2 border rounded"
                    onClick={() => setEditOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 bg-emerald-700 text-white rounded"
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

      {/* Delete Dialog */}
      <Dialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl p-5 w-[400px]">
            <Dialog.Title className="text-lg font-semibold text-center">
              Confirm Delete
            </Dialog.Title>
            <Dialog.Description className="text-sm text-gray-500 text-center mb-3">
              This action cannot be undone.
            </Dialog.Description>

            <div className="mt-4 flex justify-center gap-3">
              <button
                className="px-4 py-2 border rounded"
                onClick={() => setDeleteOpen(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-600 text-white rounded"
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
