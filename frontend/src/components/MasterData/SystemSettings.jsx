// src/components/MasterData/SystemSettings.jsx
import React, { useEffect, useState } from "react";
import api from "../../services/api"; // your axios instance
import { UploadCloud, Save, ArrowDownCircle } from "lucide-react";

export default function SystemSettings() {
  const [settings, setSettings] = useState({
    companyName: "",
    shortName: "",
    address: "",
    phone: "",
    email: "",
    ntn: "",
    strn: "",
    defaultCurrency: "PKR",
    fiscalYearStart: "",
    dateFormat: "DD/MM/YYYY",
    timezone: "Asia/Karachi",
    logoUrl: "",

    defaultBagWeightKg: 65,
    defaultMoisturePercent: 14,
    gatepassAutoNumbering: true,
    gatepassPrefix: "GP-",
    gatepassStartFrom: 1,
    productionBatchPrefix: "PB-",
    invoicePrefix: "INV-",
    invoiceStartFrom: 1,
    autoSaveProductionWeights: true,

    printHeader: "",
    printFooter: "",
    watermarkText: "",
    showLogoOnPrint: true,
    pageSize: "A4",
    marginTop: 20,
    marginLeft: 15,
    marginRight: 15,
    marginBottom: 20,
  });

  const [activeTab, setActiveTab] = useState("general");
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [restoreFile, setRestoreFile] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get("/settings");
        if (res.data && res.data.data) {
          // normalize dates to yyyy-mm-dd for inputs
          const s = res.data.data;
          setSettings((prev) => ({ ...prev, ...s }));
        }
      } catch (err) {
        console.error("Error loading settings", err);
      }
    };
    load();
  }, []);

  const handleChange = (k, v) => {
    setSettings((s) => ({ ...s, [k]: v }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // convert fiscal year start to Date if provided as string input
      const payload = { ...settings };
      if (
        payload.fiscalYearStart &&
        typeof payload.fiscalYearStart === "string"
      ) {
        payload.fiscalYearStart = new Date(payload.fiscalYearStart);
      }
      const res = await api.put("/settings", payload);
      setMsg("Settings saved");
      setTimeout(() => setMsg(""), 2500);
    } catch (err) {
      console.error(err);
      setMsg("Error saving");
      setTimeout(() => setMsg(""), 2500);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoSelect = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setLogoFile(f);
    // preview locally
    const reader = new FileReader();
    reader.onload = () => {
      handleChange("logoUrl", reader.result);
    };
    reader.readAsDataURL(f);
  };

  const uploadLogo = async () => {
    if (!logoFile) return alert("Choose a logo file first");
    const form = new FormData();
    form.append("logo", logoFile);
    setLoading(true);
    try {
      const res = await api.post("/settings/logo", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data && res.data.logoUrl) {
        handleChange("logoUrl", res.data.logoUrl);
        setMsg("Logo uploaded");
        setTimeout(() => setMsg(""), 2000);
      }
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const downloadBackup = () => {
    // open new tab to GET /api/settings/backup
    window.open(`${api.defaults.baseURL}/settings/backup`, "_blank");
  };

  const handleRestoreSelect = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setRestoreFile(f);
  };

  const uploadRestore = async () => {
    if (!restoreFile) return alert("Choose a backup JSON file first");
    const form = new FormData();
    form.append("backup", restoreFile);
    setLoading(true);
    try {
      const res = await api.post("/settings/restore", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("Restore complete — please reload app");
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      console.error(err);
      alert("Restore failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-emerald-800">
            System Settings
          </h2>
          <p className="text-sm text-gray-500">
            Global settings (single document)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            className="bg-emerald-600 text-white px-3 py-2 rounded flex items-center gap-2"
          >
            <Save size={16} /> Save
          </button>
          <div className="text-sm text-green-700">{msg}</div>
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("general")}
          className={`px-3 py-2 rounded ${
            activeTab === "general" ? "bg-emerald-600 text-white" : "bg-white"
          }`}
        >
          General
        </button>
        <button
          onClick={() => setActiveTab("operational")}
          className={`px-3 py-2 rounded ${
            activeTab === "operational"
              ? "bg-emerald-600 text-white"
              : "bg-white"
          }`}
        >
          Operational
        </button>
        <button
          onClick={() => setActiveTab("printing")}
          className={`px-3 py-2 rounded ${
            activeTab === "printing" ? "bg-emerald-600 text-white" : "bg-white"
          }`}
        >
          Printing
        </button>
        <button
          onClick={() => setActiveTab("backup")}
          className={`px-3 py-2 rounded ${
            activeTab === "backup" ? "bg-emerald-600 text-white" : "bg-white"
          }`}
        >
          Backup
        </button>
      </div>

      {/* content */}
      <div className="bg-white p-4 rounded-lg shadow-sm">
        {activeTab === "general" && (
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="text-xs text-gray-600">Company Name</label>
              <input
                className="w-full border p-2 rounded"
                value={settings.companyName || ""}
                onChange={(e) => handleChange("companyName", e.target.value)}
              />
              <label className="text-xs text-gray-600 mt-2">Short Name</label>
              <input
                className="w-full border p-2 rounded"
                value={settings.shortName || ""}
                onChange={(e) => handleChange("shortName", e.target.value)}
              />
              <label className="text-xs text-gray-600 mt-2">Address</label>
              <input
                className="w-full border p-2 rounded"
                value={settings.address || ""}
                onChange={(e) => handleChange("address", e.target.value)}
              />
              <div className="grid grid-cols-3 gap-2 mt-2">
                <input
                  className="border p-2 rounded"
                  placeholder="Phone"
                  value={settings.phone || ""}
                  onChange={(e) => handleChange("phone", e.target.value)}
                />
                <input
                  className="border p-2 rounded"
                  placeholder="Email"
                  value={settings.email || ""}
                  onChange={(e) => handleChange("email", e.target.value)}
                />
                <input
                  className="border p-2 rounded"
                  placeholder="NTN"
                  value={settings.ntn || ""}
                  onChange={(e) => handleChange("ntn", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <input
                  className="border p-2 rounded"
                  placeholder="STRN"
                  value={settings.strn || ""}
                  onChange={(e) => handleChange("strn", e.target.value)}
                />
                <input
                  className="border p-2 rounded"
                  placeholder="Default Currency"
                  value={settings.defaultCurrency || ""}
                  onChange={(e) =>
                    handleChange("defaultCurrency", e.target.value)
                  }
                />
                <input
                  type="date"
                  className="border p-2 rounded"
                  value={
                    settings.fiscalYearStart
                      ? new Date(settings.fiscalYearStart)
                          .toISOString()
                          .slice(0, 10)
                      : ""
                  }
                  onChange={(e) =>
                    handleChange("fiscalYearStart", e.target.value)
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <input
                  className="border p-2 rounded"
                  placeholder="Date format"
                  value={settings.dateFormat || ""}
                  onChange={(e) => handleChange("dateFormat", e.target.value)}
                />
                <input
                  className="border p-2 rounded"
                  placeholder="Timezone"
                  value={settings.timezone || ""}
                  onChange={(e) => handleChange("timezone", e.target.value)}
                />
              </div>
            </div>

            <div className="col-span-1">
              <div className="border rounded p-3 text-center">
                <div className="text-sm text-gray-600">Logo</div>
                <div className="mt-2">
                  {settings.logoUrl ? (
                    <img
                      src={settings.logoUrl}
                      alt="logo"
                      className="mx-auto h-24 object-contain"
                    />
                  ) : (
                    <div className="h-24 w-full bg-gray-100 flex items-center justify-center text-gray-400">
                      No logo
                    </div>
                  )}
                </div>
                <div className="mt-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoSelect}
                  />
                  <div className="mt-2 flex gap-2 justify-center">
                    <button
                      className="px-3 py-1 bg-emerald-600 text-white rounded"
                      onClick={uploadLogo}
                    >
                      <UploadCloud size={16} /> Upload
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "operational" && (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-600">
                Default bag weight (kg)
              </label>
              <input
                type="number"
                className="border p-2 rounded w-full"
                value={settings.defaultBagWeightKg || 65}
                onChange={(e) =>
                  handleChange("defaultBagWeightKg", Number(e.target.value))
                }
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">
                Default moisture %
              </label>
              <input
                type="number"
                className="border p-2 rounded w-full"
                value={settings.defaultMoisturePercent || 14}
                onChange={(e) =>
                  handleChange("defaultMoisturePercent", Number(e.target.value))
                }
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">
                Gatepass Auto Numbering
              </label>
              <div className="mt-2">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!settings.gatepassAutoNumbering}
                    onChange={(e) =>
                      handleChange("gatepassAutoNumbering", e.target.checked)
                    }
                  />
                  <span>Enable</span>
                </label>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-600">Gatepass Prefix</label>
              <input
                className="border p-2 rounded w-full"
                value={settings.gatepassPrefix || ""}
                onChange={(e) => handleChange("gatepassPrefix", e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">
                Gatepass Start From
              </label>
              <input
                type="number"
                className="border p-2 rounded w-full"
                value={settings.gatepassStartFrom || 1}
                onChange={(e) =>
                  handleChange("gatepassStartFrom", Number(e.target.value))
                }
              />
            </div>

            <div>
              <label className="text-xs text-gray-600">
                Production Batch Prefix
              </label>
              <input
                className="border p-2 rounded w-full"
                value={settings.productionBatchPrefix || ""}
                onChange={(e) =>
                  handleChange("productionBatchPrefix", e.target.value)
                }
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">Invoice Prefix</label>
              <input
                className="border p-2 rounded w-full"
                value={settings.invoicePrefix || ""}
                onChange={(e) => handleChange("invoicePrefix", e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">
                Invoice Start From
              </label>
              <input
                type="number"
                className="border p-2 rounded w-full"
                value={settings.invoiceStartFrom || 1}
                onChange={(e) =>
                  handleChange("invoiceStartFrom", Number(e.target.value))
                }
              />
            </div>

            <div className="col-span-3 mt-3">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!settings.autoSaveProductionWeights}
                  onChange={(e) =>
                    handleChange("autoSaveProductionWeights", e.target.checked)
                  }
                />
                <span>Auto Save Production Weights</span>
              </label>
            </div>
          </div>
        )}

        {activeTab === "printing" && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-600">Header Text</label>
              <textarea
                className="border p-2 rounded w-full"
                rows={3}
                value={settings.printHeader || ""}
                onChange={(e) => handleChange("printHeader", e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">Footer Text</label>
              <textarea
                className="border p-2 rounded w-full"
                rows={3}
                value={settings.printFooter || ""}
                onChange={(e) => handleChange("printFooter", e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs text-gray-600">Watermark Text</label>
              <input
                className="border p-2 rounded w-full"
                value={settings.watermarkText || ""}
                onChange={(e) => handleChange("watermarkText", e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs text-gray-600">
                Show Logo On Print
              </label>
              <div className="mt-2">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!settings.showLogoOnPrint}
                    onChange={(e) =>
                      handleChange("showLogoOnPrint", e.target.checked)
                    }
                  />
                  <span>Show Logo</span>
                </label>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-600">Page Size</label>
              <select
                className="border p-2 rounded w-full"
                value={settings.pageSize || "A4"}
                onChange={(e) => handleChange("pageSize", e.target.value)}
              >
                <option value="A4">A4</option>
                <option value="A5">A5</option>
                <option value="Letter">Letter</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-600">
                Margins (Top/Left/Right/Bottom in mm)
              </label>
              <div className="grid grid-cols-4 gap-2 mt-1">
                <input
                  type="number"
                  className="border p-2 rounded"
                  value={settings.marginTop || 20}
                  onChange={(e) =>
                    handleChange("marginTop", Number(e.target.value))
                  }
                />
                <input
                  type="number"
                  className="border p-2 rounded"
                  value={settings.marginLeft || 15}
                  onChange={(e) =>
                    handleChange("marginLeft", Number(e.target.value))
                  }
                />
                <input
                  type="number"
                  className="border p-2 rounded"
                  value={settings.marginRight || 15}
                  onChange={(e) =>
                    handleChange("marginRight", Number(e.target.value))
                  }
                />
                <input
                  type="number"
                  className="border p-2 rounded"
                  value={settings.marginBottom || 20}
                  onChange={(e) =>
                    handleChange("marginBottom", Number(e.target.value))
                  }
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "backup" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button
                onClick={downloadBackup}
                className="bg-sky-600 text-white px-3 py-2 rounded flex items-center gap-2"
              >
                <ArrowDownCircle size={16} /> Download Backup
              </button>

              <div>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestoreSelect}
                />
                <button
                  onClick={uploadRestore}
                  className="ml-2 bg-rose-600 text-white px-3 py-2 rounded"
                >
                  Restore Backup
                </button>
              </div>
            </div>

            <div className="text-sm text-gray-600">
              Backup includes settings, companies, product types and expense
              categories.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
