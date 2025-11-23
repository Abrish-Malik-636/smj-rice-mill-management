// src/pages/Production.jsx
import React, { useEffect, useState } from "react";
import api from "../services/api";
import toast, { Toaster } from "react-hot-toast";
import {
  Factory,
  SunMedium,
  Moon,
  Activity,
  Trash2,
  Plus,
  CheckCircle2,
  RefreshCcw,
  Printer,
  X,
} from "lucide-react";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
} from "recharts";

function todayISODate() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function Production() {
  const [summary, setSummary] = useState({
    dayShiftOutputWeightKg: 0,
    nightShiftOutputWeightKg: 0,
    totalOutputWeightKg: 0,
    batchCount: 0,
  });

  const [weeklyData, setWeeklyData] = useState([]);
  const [shiftCompareData, setShiftCompareData] = useState([]);

  const [activeTab, setActiveTab] = useState("IN_PROCESS");
  const [inProcessBatches, setInProcessBatches] = useState([]);
  const [completedBatches, setCompletedBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);

  const [companies, setCompanies] = useState([]);
  const [products, setProducts] = useState([]);

  const [creating, setCreating] = useState(false);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [working, setWorking] = useState(false);
  const [savingBatchInfo, setSavingBatchInfo] = useState(false);

  const [batchForm, setBatchForm] = useState({
    date: todayISODate(),
    paddyWeightKg: "",
    remarks: "",
  });

  const [editBatchForm, setEditBatchForm] = useState({
    date: "",
    paddyWeightKg: "",
    remarks: "",
  });

  const [outputForm, setOutputForm] = useState({
    productTypeId: "",
    companyId: "",
    numBags: "",
    perBagWeightKg: "",
    netWeightKg: "",
    shift: "DAY",
  });

  // Slip preview
  const [showSlip, setShowSlip] = useState(false);
  const [millInfo, setMillInfo] = useState({
    name: "SMJ Rice Mill",
    address: "Mirza Virkan Road, Sheikhupura",
    phone: "",
    email: "",
    logoUrl: "",
  });

  useEffect(() => {
    loadSummary();
    loadMeta();
    loadBatches();
    loadMillInfo();
  }, []);

  useEffect(() => {
    buildChartsFromBatches(completedBatches);
  }, [completedBatches]);

  // Auto net weight = bags * perBagWeightKg
  useEffect(() => {
    const bags = Number(outputForm.numBags) || 0;
    const perBag = Number(outputForm.perBagWeightKg) || 0;
    const net = bags * perBag;
    setOutputForm((f) => ({
      ...f,
      netWeightKg: net ? net.toFixed(3) : "",
    }));
  }, [outputForm.numBags, outputForm.perBagWeightKg]);

  async function loadMillInfo() {
    try {
      const res = await api.get("/settings");
      const data = res.data?.data || {};
      const general = data.general || data.generalSettings || {};
      const printing = data.printing || data.printingSettings || {};
      setMillInfo((prev) => ({
        ...prev,
        name: general.millName || prev.name,
        address: general.fullAddress || prev.address,
        phone: general.phone || "",
        email: general.email || "",
        logoUrl: printing.logoPath || "",
      }));
    } catch {
      // silent if settings missing
    }
  }

  async function loadSummary() {
    try {
      setLoadingSummary(true);
      const res = await api.get("/production/summary/today");
      if (res.data?.success) {
        setSummary(res.data.data || summary);
      }
    } catch {
      toast.error("Failed to load production summary");
    }
    setLoadingSummary(false);
  }

  async function loadMeta() {
    try {
      const [cRes, pRes] = await Promise.all([
        api.get("/companies"),
        api.get("/product-types"),
      ]);
      setCompanies(cRes.data.data || []);
      setProducts(pRes.data.data || []);
    } catch {
      toast.error("Failed to load company/product master data");
    }
  }

  async function loadBatches() {
    try {
      setLoadingBatches(true);
      const [inRes, completedRes] = await Promise.all([
        api.get("/production/batches", {
          params: { status: "IN_PROCESS", limit: 50 },
        }),
        api.get("/production/batches", {
          params: { status: "COMPLETED", limit: 50 },
        }),
      ]);

      const inList = inRes.data.data || [];
      const compList = completedRes.data.data || [];

      setInProcessBatches(inList);
      setCompletedBatches(compList);

      if (!selectedBatchId) {
        const first = inList[0] || compList[0];
        if (first) {
          selectBatch(first._id, first.status);
        }
      }
    } catch {
      toast.error("Failed to load batches");
    }
    setLoadingBatches(false);
  }

  async function selectBatch(id, tabOverride) {
    try {
      const res = await api.get(`/production/batches/${id}`);
      if (!res.data?.success) {
        toast.error("Failed to load batch details");
        return;
      }
      const b = res.data.data;
      setSelectedBatchId(id);
      setSelectedBatch(b);
      if (tabOverride) setActiveTab(tabOverride);

      setEditBatchForm({
        date: b.date
          ? new Date(b.date).toISOString().slice(0, 10)
          : todayISODate(),
        paddyWeightKg: b.paddyWeightKg?.toString() || "",
        remarks: b.remarks || "",
      });
    } catch {
      toast.error("Failed to load batch details");
    }
  }

  function buildChartsFromBatches(batches) {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ key, date: d });
    }

    const lineData = days.map((d) => {
      const dayStr = d.key;
      const sameDayBatches = batches.filter((b) => {
        const bDay = new Date(b.date).toISOString().slice(0, 10);
        return bDay === dayStr;
      });

      let total = 0;
      let day = 0;
      let night = 0;
      sameDayBatches.forEach((b) => {
        total += b.totalOutputWeightKg || 0;
        day += b.dayShiftOutputWeightKg || 0;
        night += b.nightShiftOutputWeightKg || 0;
      });

      return {
        label: d.date.toLocaleDateString(undefined, {
          day: "2-digit",
          month: "short",
        }),
        total: +total.toFixed(3),
        day: +day.toFixed(3),
        night: +night.toFixed(3),
      };
    });

    setWeeklyData(lineData);

    let sumDay = 0;
    let sumNight = 0;
    batches.forEach((b) => {
      sumDay += b.dayShiftOutputWeightKg || 0;
      sumNight += b.nightShiftOutputWeightKg || 0;
    });

    setShiftCompareData([
      { name: "Day Shift", day: sumDay, night: 0 },
      { name: "Night Shift", day: 0, night: sumNight },
    ]);
  }

  async function handleCreateBatch() {
    if (!batchForm.date) {
      toast.error("Please select a batch date");
      return;
    }
    if (!batchForm.paddyWeightKg) {
      toast.error("Enter paddy weight (kg)");
      return;
    }

    setCreating(true);
    try {
      const res = await api.post("/production/batches", {
        date: batchForm.date,
        paddyWeightKg: Number(batchForm.paddyWeightKg),
        remarks: batchForm.remarks,
      });
      if (!res.data?.success) {
        toast.error(res.data?.message || "Failed to create batch");
      } else {
        toast.success("Production batch created");
        setBatchForm({
          date: todayISODate(),
          paddyWeightKg: "",
          remarks: "",
        });
        await loadBatches();
        await selectBatch(res.data.data._id, "IN_PROCESS");
        await loadSummary();
      }
    } catch {
      toast.error("Failed to create batch");
    }
    setCreating(false);
  }

  function numClean(v) {
    return String(v).replace(/^0+(?=\d)/, "");
  }

  async function handleSaveBatchInfo() {
    if (!selectedBatchId || !selectedBatch) {
      toast.error("Select a batch first");
      return;
    }
    if (!editBatchForm.paddyWeightKg) {
      toast.error("Enter paddy weight (kg)");
      return;
    }

    setSavingBatchInfo(true);
    try {
      const payload = {
        date: editBatchForm.date,
        paddyWeightKg: Number(editBatchForm.paddyWeightKg),
        remarks: editBatchForm.remarks,
      };
      const res = await api.put(
        `/production/batches/${selectedBatchId}`,
        payload
      );
      if (!res.data?.success) {
        toast.error(res.data?.message || "Failed to update batch");
      } else {
        toast.success("Batch updated");
        setSelectedBatch(res.data.data);
        await loadBatches();
        await loadSummary();
      }
    } catch {
      toast.error("Failed to update batch");
    }
    setSavingBatchInfo(false);
  }

  async function handleAddOutput() {
    if (!selectedBatchId || !selectedBatch) {
      toast.error("Select a batch first");
      return;
    }
    if (selectedBatch.status !== "IN_PROCESS") {
      toast.error("Cannot add output to completed batch");
      return;
    }

    if (
      !outputForm.productTypeId ||
      !outputForm.numBags ||
      !outputForm.perBagWeightKg
    ) {
      toast.error("Fill product, bags and weight per bag");
      return;
    }

    const product = products.find((p) => p._id === outputForm.productTypeId);
    const company = companies.find((c) => c._id === outputForm.companyId);

    const payload = {
      productTypeId: outputForm.productTypeId,
      productTypeName: product?.name || "",
      companyId: outputForm.companyId || null,
      companyName: company?.name || "",
      numBags: Number(outputForm.numBags),
      perBagWeightKg: Number(outputForm.perBagWeightKg),
      shift: outputForm.shift,
    };
    const currentOutputsTotal = (selectedBatch.outputs || []).reduce(
      (sum, o) => sum + (o.netWeightKg || 0),
      0
    );
    const newNet =
      (Number(outputForm.numBags) || 0) *
      (Number(outputForm.perBagWeightKg) || 0);
    const newTotal = currentOutputsTotal + newNet;

    if (newTotal > (selectedBatch.paddyWeightKg || 0)) {
      toast.error(
        `Total output (${newTotal.toFixed(
          3
        )} kg) cannot exceed paddy input (${selectedBatch.paddyWeightKg.toFixed(
          3
        )} kg).`
      );
      return;
    }

    setWorking(true);
    try {
      const res = await api.post(
        `/production/batches/${selectedBatchId}/outputs`,
        payload
      );
      if (!res.data?.success) {
        toast.error(res.data?.message || "Failed to add output");
      } else {
        toast.success("Output added");
        setSelectedBatch(res.data.data);
        setOutputForm({
          productTypeId: "",
          companyId: "",
          numBags: "",
          perBagWeightKg: "",
          netWeightKg: "",
          shift: "DAY",
        });
        await loadSummary();
        await loadBatches();
      }
    } catch {
      toast.error("Failed to add output");
    }
    setWorking(false);
  }

  async function handleCompleteBatch() {
    if (!selectedBatchId || !selectedBatch) {
      toast.error("Select a batch first");
      return;
    }
    if ((selectedBatch.outputs || []).length === 0) {
      toast.error("Add at least one output before completing batch");
      return;
    }

    const msg =
      "Are you sure you want to mark this batch as COMPLETED?\n\nAfter completion this batch cannot be edited and stock will be updated.";
    if (!window.confirm(msg)) return;

    setWorking(true);
    try {
      const res = await api.post(
        `/production/batches/${selectedBatchId}/complete`
      );
      if (!res.data?.success) {
        toast.error(res.data?.message || "Failed to complete batch");
      } else {
        toast.success("Batch completed; finished stock updated");
        setSelectedBatch(res.data.data);
        await loadSummary();
        await loadBatches();
      }
    } catch {
      toast.error("Failed to complete batch");
    }
    setWorking(false);
  }

  async function handleDeleteBatch() {
    if (!selectedBatchId || !selectedBatch) {
      toast.error("Select a batch first");
      return;
    }

    const isCompleted = selectedBatch.status === "COMPLETED";

    const msg = isCompleted
      ? "Are you sure you want to DELETE this completed batch?\n\nPaddy and finished stock for this batch will be reversed from stock as if the batch never existed."
      : "Are you sure you want to DELETE this in-process batch?\n\nPaddy for this batch will be returned back to stock.";

    if (!window.confirm(msg)) return;

    setWorking(true);
    try {
      const res = await api.delete(`/production/batches/${selectedBatchId}`);
      if (!res.data?.success) {
        toast.error(res.data?.message || "Failed to delete batch");
      } else {
        toast.success(res.data.message || "Batch deleted");
        setSelectedBatchId(null);
        setSelectedBatch(null);
        await loadSummary();
        await loadBatches();
      }
    } catch {
      toast.error("Failed to delete batch");
    }
    setWorking(false);
  }

  const currentBatchList =
    activeTab === "IN_PROCESS" ? inProcessBatches : completedBatches;

  const remainingPaddy =
    selectedBatch && selectedBatch.paddyWeightKg != null
      ? Math.max(
          0,
          (selectedBatch.paddyWeightKg || 0) -
            (selectedBatch.totalOutputWeightKg || 0)
        )
      : 0;

  return (
    <div className="space-y-6">
      <Toaster />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-emerald-800 flex items-center gap-2">
            <Factory size={20} />
            Production Management
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage paddy batches, finished outputs and day/night shift
            performance with live stock integration.
          </p>
        </div>
        <button
          onClick={() => {
            loadSummary();
            loadBatches();
            toast.success("Production refreshed");
          }}
          className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm text-emerald-700 hover:bg-emerald-50"
        >
          <RefreshCcw size={16} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl shadow border-l-4 border-emerald-400">
          <div className="flex justify-between">
            <div>
              <div className="text-xs text-gray-500">Day Shift Output</div>
              <div className="text-xl font-bold text-emerald-800">
                {summary.dayShiftOutputWeightKg} kg
              </div>
            </div>
            <div className="bg-emerald-100 p-2 rounded-full">
              <SunMedium className="text-emerald-700" size={18} />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow border-l-4 border-sky-300">
          <div className="flex justify-between">
            <div>
              <div className="text-xs text-gray-500">Night Shift Output</div>
              <div className="text-xl font-bold text-sky-800">
                {summary.nightShiftOutputWeightKg} kg
              </div>
            </div>
            <div className="bg-sky-100 p-2 rounded-full">
              <Moon className="text-sky-700" size={18} />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow border-l-4 border-amber-300">
          <div className="flex justify-between">
            <div>
              <div className="text-xs text-gray-500">Total Output (Today)</div>
              <div className="text-xl font-bold text-amber-700">
                {summary.totalOutputWeightKg} kg
              </div>
            </div>
            <div className="bg-amber-100 p-2 rounded-full">
              <Activity className="text-amber-600" size={18} />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow border-l-4 border-violet-200">
          <div className="flex justify-between">
            <div>
              <div className="text-xs text-gray-500">Batches Today</div>
              <div className="text-xl font-bold text-violet-800">
                {summary.batchCount}
              </div>
            </div>
            <div className="bg-violet-100 p-2 rounded-full">
              <Factory className="text-violet-700" size={18} />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow border-l-4 border-gray-200">
          <div className="text-xs text-gray-500">Status</div>
          <div className="text-xl font-bold text-gray-800">
            {loadingSummary ? "Updating..." : "Up to date"}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Live summary for today&apos;s production
          </div>
        </div>
      </div>

      {/* Batches + Detail */}
      <div className="grid grid-cols-5 gap-4">
        {/* Left: batch list + create */}
        <div className="col-span-2 bg-white rounded-xl shadow border flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex gap-4 text-sm">
              <button
                onClick={() => setActiveTab("IN_PROCESS")}
                className={`pb-1 ${
                  activeTab === "IN_PROCESS"
                    ? "text-emerald-700 font-semibold border-b-2 border-emerald-700"
                    : "text-gray-500"
                }`}
              >
                In-Process
              </button>
              <button
                onClick={() => setActiveTab("COMPLETED")}
                className={`pb-1 ${
                  activeTab === "COMPLETED"
                    ? "text-emerald-700 font-semibold border-b-2 border-emerald-700"
                    : "text-gray-500"
                }`}
              >
                Completed
              </button>
            </div>

            <button
              onClick={handleCreateBatch}
              disabled={creating}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-emerald-700 text-white rounded hover:bg-emerald-800 disabled:opacity-60"
            >
              <Plus size={14} />
              {creating ? "Creating..." : "New Batch"}
            </button>
          </div>

          {/* Quick create form */}
          <div className="p-3 border-b bg-gray-50 grid grid-cols-3 gap-2 text-xs">
            <div className="col-span-1">
              <input
                type="date"
                value={batchForm.date}
                onChange={(e) =>
                  setBatchForm((f) => ({ ...f, date: e.target.value }))
                }
                className="border rounded px-2 py-1 w-full"
              />
            </div>
            <div className="col-span-1">
              <input
                type="number"
                value={batchForm.paddyWeightKg}
                onChange={(e) =>
                  setBatchForm((f) => ({
                    ...f,
                    paddyWeightKg: numClean(e.target.value),
                  }))
                }
                placeholder="Paddy (kg)"
                className="border rounded px-2 py-1 w-full"
              />
            </div>
            <div className="col-span-1">
              <input
                type="text"
                value={batchForm.remarks}
                onChange={(e) =>
                  setBatchForm((f) => ({ ...f, remarks: e.target.value }))
                }
                placeholder="Remarks"
                className="border rounded px-2 py-1 w-full"
              />
            </div>
          </div>

          {/* Batch list */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#E6F9F0] text-emerald-800">
                <tr>
                  <th className="p-2 text-left">Batch No</th>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-right">Paddy (kg)</th>
                  <th className="p-2 text-right">Output (kg)</th>
                </tr>
              </thead>
              <tbody>
                {currentBatchList.map((b, idx) => (
                  <tr
                    key={b._id}
                    className={`cursor-pointer ${
                      selectedBatchId === b._id
                        ? "bg-emerald-50"
                        : idx % 2
                        ? "bg-white"
                        : "bg-gray-50"
                    }`}
                    onClick={() => selectBatch(b._id, b.status)}
                  >
                    <td className="p-2">{b.batchNo}</td>
                    <td className="p-2">
                      {new Date(b.date).toLocaleDateString()}
                    </td>
                    <td className="p-2 text-right">
                      {b.totalRawWeightKg?.toFixed(2)}
                    </td>
                    <td className="p-2 text-right">
                      {b.totalOutputWeightKg?.toFixed(2)}
                    </td>
                  </tr>
                ))}

                {currentBatchList.length === 0 && (
                  <tr>
                    <td className="p-3 text-center text-gray-500" colSpan={4}>
                      {loadingBatches
                        ? "Loading batches..."
                        : "No batches found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: batch detail */}
        <div className="col-span-3 bg-white rounded-xl shadow border p-4 space-y-4">
          {selectedBatch ? (
            <>
              {/* Header row */}
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="text-sm text-gray-500">Selected Batch</div>
                  <div className="text-lg font-semibold text-emerald-800">
                    {selectedBatch.batchNo}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-2">
                    Status:{" "}
                    {selectedBatch.status === "IN_PROCESS" ? (
                      <span className="text-yellow-600 font-semibold">
                        In Process
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-semibold">
                        Completed
                      </span>
                    )}
                    <span className="text-gray-300">•</span>
                    <button
                      onClick={handleDeleteBatch}
                      className="flex items-center gap-1 text-rose-600 hover:text-rose-700 text-xs"
                    >
                      <Trash2 size={12} />
                      Delete
                    </button>
                  </div>
                </div>

                <div className="text-xs text-right text-gray-500">
                  <div>
                    Paddy:{" "}
                    <span className="font-semibold text-gray-700">
                      {selectedBatch.totalRawWeightKg?.toFixed(3)} kg
                    </span>
                  </div>
                  <div>
                    Output:{" "}
                    <span className="font-semibold text-emerald-700">
                      {selectedBatch.totalOutputWeightKg?.toFixed(3)} kg
                    </span>
                  </div>
                  <div>
                    Remaining Paddy:{" "}
                    <span className="font-semibold text-sky-700">
                      {remainingPaddy.toFixed(3)} kg
                    </span>
                  </div>
                </div>
              </div>

              {/* Batch editable info */}
              <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-4 gap-3 text-xs items-end">
                <div>
                  <label className="block text-[11px] text-gray-500">
                    Batch Date
                  </label>
                  <input
                    type="date"
                    value={editBatchForm.date}
                    onChange={(e) =>
                      setEditBatchForm((f) => ({
                        ...f,
                        date: e.target.value,
                      }))
                    }
                    className="border rounded px-2 py-1 w-full"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500">
                    Paddy Weight (kg)
                  </label>
                  <input
                    type="number"
                    value={editBatchForm.paddyWeightKg}
                    onChange={(e) =>
                      setEditBatchForm((f) => ({
                        ...f,
                        paddyWeightKg: numClean(e.target.value),
                      }))
                    }
                    className="border rounded px-2 py-1 w-full"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] text-gray-500">
                    Remarks
                  </label>
                  <input
                    type="text"
                    value={editBatchForm.remarks}
                    onChange={(e) =>
                      setEditBatchForm((f) => ({
                        ...f,
                        remarks: e.target.value,
                      }))
                    }
                    className="border rounded px-2 py-1 w-full"
                  />
                </div>
                <div className="col-span-4 flex justify-between items-center">
                  <button
                    onClick={() => setShowSlip(true)}
                    className="flex items-center gap-1 text-xs px-3 py-1 rounded border text-emerald-700 hover:bg-emerald-50"
                  >
                    <Printer size={14} />
                    Preview Slip
                  </button>
                  <button
                    onClick={handleSaveBatchInfo}
                    disabled={savingBatchInfo}
                    className="px-3 py-1 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {savingBatchInfo ? "Saving..." : "Save Batch Info"}
                  </button>
                </div>
              </div>

              {/* Outputs + list */}
              <div className="grid grid-cols-2 gap-4">
                {/* Outputs form */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-gray-700">
                      Finished Outputs
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <select
                      value={outputForm.productTypeId}
                      onChange={(e) =>
                        setOutputForm((f) => ({
                          ...f,
                          productTypeId: e.target.value,
                        }))
                      }
                      className="border rounded px-2 py-1 col-span-3"
                    >
                      <option value="">Finished Product</option>
                      {products.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name}
                        </option>
                      ))}
                    </select>

                    <select
                      value={outputForm.companyId}
                      onChange={(e) =>
                        setOutputForm((f) => ({
                          ...f,
                          companyId: e.target.value,
                        }))
                      }
                      className="border rounded px-2 py-1 col-span-3"
                    >
                      <option value="">Company (optional)</option>
                      {companies.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      value={outputForm.numBags}
                      onChange={(e) =>
                        setOutputForm((f) => ({
                          ...f,
                          numBags: numClean(e.target.value),
                        }))
                      }
                      placeholder="Bags"
                      className="border rounded px-2 py-1"
                    />

                    <input
                      type="number"
                      value={outputForm.perBagWeightKg}
                      onChange={(e) =>
                        setOutputForm((f) => ({
                          ...f,
                          perBagWeightKg: numClean(e.target.value),
                        }))
                      }
                      placeholder="Wt / bag (kg)"
                      className="border rounded px-2 py-1"
                    />

                    <input
                      type="number"
                      value={outputForm.netWeightKg}
                      readOnly
                      placeholder="Net Wt (kg)"
                      className="border rounded px-2 py-1 bg-gray-50"
                    />

                    <select
                      value={outputForm.shift}
                      onChange={(e) =>
                        setOutputForm((f) => ({
                          ...f,
                          shift: e.target.value,
                        }))
                      }
                      className="border rounded px-2 py-1 col-span-3"
                    >
                      <option value="DAY">Day Shift</option>
                      <option value="NIGHT">Night Shift</option>
                    </select>
                  </div>

                  <button
                    onClick={handleAddOutput}
                    disabled={working}
                    className="flex items-center gap-1 text-xs px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <Plus size={14} />
                    Add Output
                  </button>
                </div>

                {/* Outputs list */}
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-gray-700">
                    Outputs List
                  </div>

                  <div className="border rounded-lg overflow-hidden max-h-48">
                    <table className="w-full text-[11px]">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="p-2 text-left">Product</th>
                          <th className="p-2 text-left">Company</th>
                          <th className="p-2 text-right">Bags</th>
                          <th className="p-2 text-right">Net Wt</th>
                          <th className="p-2 text-left">Shift</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedBatch.outputs || []).map((o, idx) => (
                          <tr
                            key={o._id || idx}
                            className={idx % 2 ? "bg-white" : "bg-gray-50"}
                          >
                            <td className="p-2">{o.productTypeName}</td>
                            <td className="p-2">{o.companyName || "-"}</td>
                            <td className="p-2 text-right">{o.numBags}</td>
                            <td className="p-2 text-right">
                              {o.netWeightKg?.toFixed(3)}
                            </td>
                            <td className="p-2">
                              {o.shift === "DAY" ? "Day" : "Night"}
                            </td>
                          </tr>
                        ))}
                        {(!selectedBatch.outputs ||
                          selectedBatch.outputs.length === 0) && (
                          <tr>
                            <td
                              className="p-2 text-center text-gray-400"
                              colSpan={5}
                            >
                              No outputs yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Complete batch button */}
              <div className="flex justify-end pt-2 border-t mt-2 gap-2">
                {selectedBatch.status === "IN_PROCESS" && (
                  <button
                    onClick={handleCompleteBatch}
                    disabled={working}
                    className="flex items-center gap-2 px-4 py-2 rounded bg-emerald-700 text-white text-sm hover:bg-emerald-800 disabled:opacity-60"
                  >
                    <CheckCircle2 size={16} />
                    Mark Batch Completed
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500 text-sm">
              Select a batch from the left or create a new one.
            </div>
          )}
        </div>
      </div>

      {/* Charts below */}
      <div className="grid grid-cols-5 gap-4">
        {/* Weekly line chart */}
        <div className="col-span-3 bg-white rounded-xl shadow p-4 border">
          <div className="flex justify-between mb-2">
            <div>
              <div className="text-sm font-semibold text-emerald-800">
                Weekly Production
              </div>
              <div className="text-xs text-gray-500">
                Total, day & night shift output over last 7 days
              </div>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Total"
                  stroke="#0EA5E9"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="day"
                  name="Day"
                  stroke="#22C55E"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="night"
                  name="Night"
                  stroke="#F97316"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Day vs Night bar */}
        <div className="col-span-2 bg-white rounded-xl shadow p-4 border">
          <div className="flex justify-between mb-2">
            <div>
              <div className="text-sm font-semibold text-emerald-800">
                Day vs Night Output
              </div>
              <div className="text-xs text-gray-500">
                Comparison of last 7 days production
              </div>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={shiftCompareData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="day" name="Day" fill="#22C55E" />
                <Bar dataKey="night" name="Night" fill="#F97316" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Slip modal */}
      {showSlip && selectedBatch && (
        <BatchSlipModal
          onClose={() => setShowSlip(false)}
          batch={selectedBatch}
          millInfo={millInfo}
        />
      )}
    </div>
  );
}

/* ========== Batch Slip Modal (card-size print) ========== */

function BatchSlipModal({ onClose, batch, millInfo }) {
  const remaining =
    batch && batch.paddyWeightKg != null
      ? Math.max(
          0,
          (batch.paddyWeightKg || 0) - (batch.totalOutputWeightKg || 0)
        )
      : 0;

  function handlePrint() {
    const printContents = document.getElementById("batch-slip-card")?.innerHTML;
    if (!printContents) return;

    const w = window.open("", "_blank", "width=600,height=800");
    if (!w) return;
    w.document.write(`
      <html>
        <head>
          <title>Batch Slip - ${batch.batchNo}</title>
          <style>
            body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 16px; }
            .card { width: 360px; border-radius: 12px; border: 1px solid #e5e7eb; padding: 16px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 12px; }
            .title { font-size: 16px; font-weight: 700; color: #065f46; }
            .sub { font-size: 11px; color: #6b7280; }
            table { width: 100%; font-size: 11px; border-collapse: collapse; margin-top: 8px; }
            th, td { padding: 4px; border-bottom: 1px solid #e5e7eb; text-align: left; }
            th { background: #ecfdf5; }
            .label { font-size: 11px; color: #6b7280; }
            .value { font-size: 11px; font-weight: 600; color: #111827; }
          </style>
        </head>
        <body>
          <div class="card">
            ${printContents}
          </div>
        </body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <div className="text-sm font-semibold text-emerald-800">
            Batch Slip Preview
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-500"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 flex flex-col items-center">
          {/* Card-sized slip */}
          <div
            id="batch-slip-card"
            className="w-[360px] border rounded-xl p-3 shadow-sm"
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
              {millInfo.logoUrl && (
                <img
                  src={millInfo.logoUrl}
                  alt="Logo"
                  className="w-10 h-10 object-contain"
                />
              )}
              <div>
                <div className="text-sm font-bold text-emerald-800 uppercase">
                  {millInfo.name}
                </div>
                <div className="text-[10px] text-gray-500">
                  {millInfo.address}
                </div>
                {millInfo.phone && (
                  <div className="text-[10px] text-gray-500">
                    Ph: {millInfo.phone}
                  </div>
                )}
              </div>
            </div>

            <div className="border-b mb-2" />

            <div className="flex justify-between text-[11px] mb-1">
              <div>
                <div className="text-gray-500">Batch No</div>
                <div className="font-semibold">{batch.batchNo}</div>
              </div>
              <div className="text-right">
                <div className="text-gray-500">Date</div>
                <div className="font-semibold">
                  {new Date(batch.date).toLocaleDateString()}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1 text-[11px] mb-2">
              <div>
                <div className="text-gray-500">Paddy Weight</div>
                <div className="font-semibold">
                  {batch.paddyWeightKg?.toFixed(3)} kg
                </div>
              </div>
              <div>
                <div className="text-gray-500">Total Output</div>
                <div className="font-semibold">
                  {batch.totalOutputWeightKg?.toFixed(3)} kg
                </div>
              </div>
              <div>
                <div className="text-gray-500">Remaining Paddy</div>
                <div className="font-semibold">{remaining.toFixed(3)} kg</div>
              </div>
            </div>

            <div className="text-[11px] font-semibold text-gray-700 mt-1">
              Outputs
            </div>
            <table className="w-full text-[10px] mt-1">
              <thead>
                <tr>
                  <th className="text-left">Product</th>
                  <th className="text-left">Company</th>
                  <th className="text-right">Bags</th>
                  <th className="text-right">Net (kg)</th>
                  <th className="text-left">Shift</th>
                </tr>
              </thead>
              <tbody>
                {(batch.outputs || []).map((o, idx) => (
                  <tr key={o._id || idx}>
                    <td>{o.productTypeName}</td>
                    <td>{o.companyName || "-"}</td>
                    <td className="text-right">{o.numBags}</td>
                    <td className="text-right">{o.netWeightKg?.toFixed(3)}</td>
                    <td>{o.shift === "DAY" ? "Day" : "Night"}</td>
                  </tr>
                ))}
                {(!batch.outputs || batch.outputs.length === 0) && (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-400">
                      No outputs
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {batch.remarks && (
              <div className="mt-2 text-[10px]">
                <span className="text-gray-500">Remarks: </span>
                <span className="font-medium">{batch.remarks}</span>
              </div>
            )}

            <div className="mt-3 flex justify-between text-[10px] text-gray-500">
              <div>__________________</div>
              <div>__________________</div>
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-gray-500">
              <div>Shift Incharge</div>
              <div>Manager</div>
            </div>
          </div>

          <button
            onClick={handlePrint}
            className="mt-4 flex items-center gap-2 px-4 py-2 rounded bg-emerald-700 text-white text-sm hover:bg-emerald-800"
          >
            <Printer size={16} />
            Print Slip
          </button>
        </div>
      </div>
    </div>
  );
}
