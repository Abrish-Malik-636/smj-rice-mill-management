// src/components/MasterData/SystemSettings.jsx
import React, { useEffect, useState } from "react";
import api from "../../services/api";
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
      const payload = { ...settings };
      if (
        payload.fiscalYearStart &&
        typeof payload.fiscalYearStart === "string"
      ) {
        payload.fiscalYearStart = new Date(payload.fiscalYearStart);
      }
      await api.put("/settings", payload);
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
    const reader = new FileReader();
    reader.onload = () => {
      handleChange("logoUrl", reader.result);
    };
    reader.readAsDataURL(f);
  };

  const uploadLogo = async () => {
    if (!logoFile) {
      alert("Choose a logo file first");
      return;
    }
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
    window.open(`${api.defaults.baseURL}/settings/backup`, "_blank");
  };

  const handleRestoreSelect = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setRestoreFile(f);
  };

  const uploadRestore = async () => {
    if (!restoreFile) {
      alert("Choose a backup JSON file first");
      return;
    }
    const form = new FormData();
    form.append("backup", restoreFile);
    setLoading(true);
    try {
      await api.post("/settings/restore", form, {
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-emerald-800">
            System Settings
          </h2>
          <p className="text-sm text-gray-500">
            General information & full system backup/restore
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === "general" && (
            <button
              onClick={handleSave}
              disabled={loading}
              className="bg-emerald-600 text-white px-3 py-2 rounded flex items-center gap-2 disabled:opacity-60"
            >
              <Save size={16} /> {loading ? "Saving..." : "Save"}
            </button>
          )}
          <div className="text-sm text-green-700">{msg}</div>
        </div>
      </div>

      {/* Tabs (only General + Backup now) */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("general")}
          className={`px-3 py-2 rounded text-sm ${
            activeTab === "general"
              ? "bg-emerald-600 text-white"
              : "bg-white text-gray-700 border"
          }`}
        >
          General
        </button>
        <button
          onClick={() => setActiveTab("backup")}
          className={`px-3 py-2 rounded text-sm ${
            activeTab === "backup"
              ? "bg-emerald-600 text-white"
              : "bg-white text-gray-700 border"
          }`}
        >
          Backup & Restore
        </button>
      </div>

      {/* Content */}
      <div className="bg-white p-4 rounded-lg shadow-sm">
        {/* GENERAL TAB */}
        {activeTab === "general" && (
          <div className="grid grid-cols-3 gap-4">
            {/* Left: Company info */}
            <div className="col-span-2 space-y-2">
              <div>
                <label className="text-xs text-gray-600">Company Name</label>
                <input
                  className="w-full border p-2 rounded"
                  value={settings.companyName || ""}
                  onChange={(e) => handleChange("companyName", e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs text-gray-600">Short Name</label>
                <input
                  className="w-full border p-2 rounded"
                  value={settings.shortName || ""}
                  onChange={(e) => handleChange("shortName", e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs text-gray-600">Address</label>
                <input
                  className="w-full border p-2 rounded"
                  value={settings.address || ""}
                  onChange={(e) => handleChange("address", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
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

              <div className="grid grid-cols-3 gap-2">
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

              <div className="grid grid-cols-2 gap-2">
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

            {/* Right: Logo */}
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
                    <div className="h-24 w-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                      No logo configured
                    </div>
                  )}
                </div>
                <div className="mt-3 space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoSelect}
                    className="text-xs"
                  />
                  <div className="flex gap-2 justify-center">
                    <button
                      className="px-3 py-1 bg-emerald-600 text-white rounded flex items-center gap-1 text-xs"
                      onClick={uploadLogo}
                      type="button"
                    >
                      <UploadCloud size={14} /> Upload
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BACKUP TAB */}
        {activeTab === "backup" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button
                onClick={downloadBackup}
                type="button"
                className="bg-sky-600 text-white px-3 py-2 rounded flex items-center gap-2 text-sm"
              >
                <ArrowDownCircle size={16} /> Download Full Backup
              </button>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500">
                  Backup includes settings, master data and core operational
                  data (production, stock, gatepasses, etc.)
                </span>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="text-sm font-semibold text-gray-700 mb-2">
                Restore from Backup
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestoreSelect}
                  className="text-xs"
                />
                <button
                  onClick={uploadRestore}
                  type="button"
                  className="bg-rose-600 text-white px-3 py-2 rounded text-sm"
                >
                  Restore Backup
                </button>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                <strong>Warning:</strong> Restore will overwrite existing
                settings, companies, product types, expense categories, and core
                operational data with the backup contents.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
