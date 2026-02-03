// src/components/MasterData/SystemSettings.jsx
import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { UploadCloud, Save, ArrowDownCircle, Eye, EyeOff } from "lucide-react";
import { toast } from "react-hot-toast";
import Pin4Input from "../Pin4Input";
import ConfirmDialog from "../ui/ConfirmDialog";

export default function SystemSettings() {
  const [settings, setSettings] = useState({
    companyName: "",
    shortName: "",
    address: "",
    phone: "",
    email: "",
    defaultCurrency: "PKR",
    logoUrl: "",
    defaultBagWeightKg: 65,
    adminPin: "0000",
    additionalStockSettingsEnabled: false,
    loginPassword: "",
  });

  const [activeTab, setActiveTab] = useState("general");
  const [additionalSettingPinDialog, setAdditionalSettingPinDialog] = useState({
    open: false,
    pin: "",
    newValue: false,
  });
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [restoreFile, setRestoreFile] = useState(null);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [pinError, setPinError] = useState("");
  const [additionalPinError, setAdditionalPinError] = useState("");
  const [otpDialog, setOtpDialog] = useState({
    open: false,
    sent: false,
    otp: "",
    sending: false,
    verifying: false,
    error: "",
  });
  const [dialog, setDialog] = useState({
    open: false,
    title: "",
    message: "",
    variant: "info",
    confirmLabel: "OK",
    onConfirm: null,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get("/settings");
        if (res.data && res.data.data) {
          const s = res.data.data;
          setSettings((prev) => ({ ...prev, ...s }));
        }
      } catch (err) {
        toast.error("Failed to load settings");
      }
    };
    load();
  }, []);

  useEffect(() => {
    const onEsc = () => {
      if (otpDialog.open) setOtpDialog({ open: false, sent: false, otp: "", sending: false, verifying: false, error: "" });
      if (additionalSettingPinDialog.open) setAdditionalSettingPinDialog({ open: false, pin: "", newValue: false });
    };
    window.addEventListener("smj-esc", onEsc);
    return () => window.removeEventListener("smj-esc", onEsc);
  }, [otpDialog.open, additionalSettingPinDialog.open]);

  const handleChange = (k, v) => {
    setSettings((s) => ({ ...s, [k]: v }));
  };

  const saveSettings = async (payload) => {
    setLoading(true);
    try {
      await api.put("/settings", payload);
      toast.success("Settings saved");
      window.dispatchEvent(new Event("smj-settings-updated"));
    } catch (err) {
      toast.error("Error saving settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGeneral = async () => {
    const payload = { ...settings };
    delete payload.loginPassword;
    delete payload.adminPin;
    await saveSettings(payload);
  };

  const handleSaveStock = async () => {
    setPinError("");
    if (newPin || confirmPin || currentPin) {
      if (!currentPin || currentPin.length < 4) {
        setDialog({
          open: true,
          title: "Current PIN required",
          message: "Enter your current admin PIN to set a new one.",
          variant: "warning",
          confirmLabel: "OK",
          onConfirm: null,
        });
        return;
      }
      if (!newPin || newPin.length < 4) {
        setDialog({
          open: true,
          title: "New PIN required",
          message: "Enter a 4-digit new PIN.",
          variant: "warning",
          confirmLabel: "OK",
          onConfirm: null,
        });
        return;
      }
      if (newPin !== confirmPin) {
        setDialog({
          open: true,
          title: "PINs do not match",
          message: "New PIN and Confirm PIN must be the same.",
          variant: "warning",
          confirmLabel: "OK",
          onConfirm: null,
        });
        return;
      }
    }
    const payload = { ...settings };
    delete payload.adminPin;
    delete payload.loginPassword;
    if (currentPin) payload.adminPin = currentPin;
    if (newPin) {
      payload.newAdminPin = newPin;
      payload.loginPassword = newPin;
    }
    setLoading(true);
    try {
      await api.put("/settings", payload);
      toast.success("Settings saved");
      window.dispatchEvent(new Event("smj-settings-updated"));
      if (newPin) {
        setSettings((prev) => ({
          ...prev,
          adminPin: newPin,
          loginPassword: newPin,
        }));
      }
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
    } catch (err) {
      if (err.response?.status === 403) {
        setPinError("PIN is incorrect");
        toast.error("PIN is incorrect");
      } else {
        toast.error("Error saving settings");
      }
    } finally {
      setLoading(false);
    }
  };

  const maskEmail = (email) => {
    if (!email || !email.includes("@")) return "***";
    const [user, domain] = email.split("@");
    const maskedUser = user.length <= 2 ? `${user[0] || "*"}***` : `${user[0]}***${user[user.length - 1]}`;
    const parts = domain.split(".");
    const maskedDomain = parts.length
      ? `${parts[0][0] || "*"}***.${parts.slice(1).join(".") || "com"}`
      : "***";
    return `${maskedUser}@${maskedDomain}`;
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
      setDialog({
        open: true,
        title: "No file selected",
        message: "Please choose a logo file first.",
        variant: "warning",
        confirmLabel: "OK",
        onConfirm: null,
      });
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
        toast.success("Logo uploaded");
      }
    } catch (err) {
      toast.error("Logo upload failed");
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
      setDialog({
        open: true,
        title: "No file selected",
        message: "Please choose a backup JSON file first.",
        variant: "warning",
        confirmLabel: "OK",
        onConfirm: null,
      });
      return;
    }
    const form = new FormData();
    form.append("backup", restoreFile);
    setLoading(true);
    try {
      await api.post("/settings/restore", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setDialog({
        open: true,
        title: "Restore complete",
        message: "Backup restored successfully. Reload the app to continue.",
        variant: "info",
        confirmLabel: "Reload",
        onConfirm: () => window.location.reload(),
      });
    } catch (err) {
      toast.error("Restore failed");
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
        <div className="flex items-center gap-3" />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("general")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition border-b-2 ${
            activeTab === "general"
              ? "text-emerald-700 border-emerald-700 bg-emerald-50"
              : "text-gray-500 border-transparent hover:text-emerald-600 hover:bg-gray-50"
          }`}
        >
          General
        </button>
        <button
          onClick={() => setActiveTab("stock")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition border-b-2 ${
            activeTab === "stock"
              ? "text-emerald-700 border-emerald-700 bg-emerald-50"
              : "text-gray-500 border-transparent hover:text-emerald-600 hover:bg-gray-50"
          }`}
        >
          Admin Settings
        </button>
        <button
          onClick={() => setActiveTab("backup")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition border-b-2 ${
            activeTab === "backup"
              ? "text-emerald-700 border-emerald-700 bg-emerald-50"
              : "text-gray-500 border-transparent hover:text-emerald-600 hover:bg-gray-50"
          }`}
        >
          Backup & Restore
        </button>
      </div>

      {/* Content */}
      <div className="bg-white p-4 rounded-lg shadow-sm">
        {/* GENERAL TAB */}
        {activeTab === "general" && (
          <>
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

              <div className="grid grid-cols-2 gap-2">
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
              </div>

              <div className="grid grid-cols-1 gap-2">
                <input
                  className="border p-2 rounded"
                  placeholder="Default Currency"
                  value={settings.defaultCurrency || ""}
                  onChange={(e) =>
                    handleChange("defaultCurrency", e.target.value)
                  }
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
            <div className="pt-4 w-full flex justify-end">
              <button
                onClick={handleSaveGeneral}
                disabled={loading}
                className="bg-emerald-600 text-white px-4 py-2 rounded flex items-center gap-2 disabled:opacity-60"
              >
                <Save size={16} /> {loading ? "Saving..." : "Save"}
              </button>
            </div>
          </>
        )}

        {/* STOCK & ADMIN TAB */}
        {activeTab === "stock" && (
          <div className="space-y-4 w-full max-w-none">
            <div className="border rounded-lg p-3 bg-emerald-50/50">
              <div className="text-sm font-semibold text-emerald-800 mb-2">
                Additional Settings Options
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!(settings.additionalStockSettingsEnabled ?? false)}
                  onChange={() =>
                    setAdditionalSettingPinDialog({
                      open: true,
                      pin: "",
                      newValue: !settings.additionalStockSettingsEnabled,
                    })
                  }
                />
                Show additional stock options in Production & Stock pages
              </label>
            </div>
            <div>
              <label className="text-xs text-gray-600">Master PIN (4 digits)</label>
              <p className="text-xs text-gray-500 mb-1">
                Same PIN is used for login and protected stock settings.
              </p>
              <div className="grid grid-cols-1 gap-2">
                <Pin4Input
                  value={currentPin}
                  onChange={(v) => {
                    setCurrentPin(v.slice(0, 4));
                    if (pinError) setPinError("");
                  }}
                  error={!!pinError}
                />
                {pinError && (
                  <div className="text-xs text-red-600">{pinError}</div>
                )}
                <div className="relative">
                  <input
                    type={showNewPin ? "text" : "password"}
                    inputMode="numeric"
                    maxLength="4"
                    className="border p-2 rounded w-full pr-10"
                    placeholder="New PIN (4 digits)"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPin((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                  >
                    {showNewPin ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showConfirmPin ? "text" : "password"}
                    inputMode="numeric"
                    maxLength="4"
                    className="border p-2 rounded w-full pr-10"
                    placeholder="Confirm New PIN"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPin((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                  >
                    {showConfirmPin ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setOtpDialog({ open: true, sent: false, otp: "" })
                  }
                  className="text-xs text-emerald-700 hover:underline text-left"
                >
                  Forgot PIN?
                </button>
              </div>
            </div>
            {additionalSettingPinDialog.open && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-4 w-full max-w-sm shadow-xl">
                  <h3 className="text-sm font-semibold text-gray-800 mb-2">Admin PIN required</h3>
                  <p className="text-xs text-gray-600 mb-3">
                    Enter admin PIN to {additionalSettingPinDialog.newValue ? "enable" : "disable"} additional stock settings.
                  </p>
                  <Pin4Input
                    value={additionalSettingPinDialog.pin}
                    onChange={(v) =>
                      setAdditionalSettingPinDialog((p) => ({
                        ...p,
                        pin: v.slice(0, 4),
                      }))
                    }
                    className="mb-4"
                    error={!!additionalPinError}
                  />
                  {additionalPinError && (
                    <div className="text-xs text-red-600 mb-3">{additionalPinError}</div>
                  )}
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setAdditionalSettingPinDialog({ open: false, pin: "", newValue: false });
                        setAdditionalPinError("");
                      }}
                      className="px-3 py-1.5 rounded border border-gray-300 text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!additionalSettingPinDialog.pin) return;
                        setLoading(true);
                        try {
                          await api.put("/settings", {
                            ...settings,
                            additionalStockSettingsEnabled: additionalSettingPinDialog.newValue,
                            adminPin: additionalSettingPinDialog.pin,
                          });
                          handleChange("additionalStockSettingsEnabled", additionalSettingPinDialog.newValue);
                          setAdditionalSettingPinDialog({ open: false, pin: "", newValue: false });
                          setAdditionalPinError("");
                          toast.success(
                            additionalSettingPinDialog.newValue
                              ? "Additional settings enabled"
                              : "Additional settings disabled"
                          );
                        } catch (err) {
                          if (err.response?.status === 403) {
                            setAdditionalPinError("PIN is incorrect");
                            toast.error("PIN is incorrect");
                          } else {
                            toast.error("Error updating setting");
                          }
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={additionalSettingPinDialog.pin.length !== 4 || loading}
                      className="px-3 py-1.5 rounded bg-emerald-600 text-white text-sm disabled:opacity-50"
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="pt-2 w-full flex justify-end">
              <button
                onClick={handleSaveStock}
                disabled={loading}
                className="bg-emerald-600 text-white px-4 py-2 rounded flex items-center gap-2 disabled:opacity-60"
              >
                <Save size={16} /> {loading ? "Saving..." : "Save"}
              </button>
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
                  onClick={() =>
                    setDialog({
                      open: true,
                      title: "Restore backup?",
                      message:
                        "This will overwrite existing settings, customers, products, expense categories and operational data.",
                      variant: "warning",
                      confirmLabel: "Restore",
                      onConfirm: uploadRestore,
                    })
                  }
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

      <ConfirmDialog
        open={dialog.open}
        onClose={() =>
          setDialog((prev) => ({
            ...prev,
            open: false,
            onConfirm: null,
          }))
        }
        onConfirm={() => {
          const action = dialog.onConfirm;
          setDialog((prev) => ({ ...prev, open: false, onConfirm: null }));
          if (action) action();
        }}
        title={dialog.title}
        message={dialog.message}
        confirmLabel={dialog.confirmLabel}
        variant={dialog.variant}
      />

      {otpDialog.open && (
        <div className="fixed inset-0 z-[120] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <h3 className="text-lg font-semibold text-gray-900">OTP Verification</h3>
            <p className="text-xs text-gray-500 mt-1">
              We will send an OTP to your registered email address.
            </p>
            <div className="mt-3 text-center text-sm text-gray-700">
              {settings.email ? maskEmail(settings.email) : "***@***.***"}
            </div>
            <div className="mt-4">
              <Pin4Input
                value={otpDialog.otp}
                onChange={(v) =>
                  setOtpDialog((prev) => ({
                    ...prev,
                    otp: v.slice(0, 4),
                    error: "",
                  }))
                }
              />
              {otpDialog.error && (
                <div className="text-xs text-red-600 text-center mt-2">{otpDialog.error}</div>
              )}
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setOtpDialog({ open: false, sent: false, otp: "", sending: false, verifying: false, error: "" })}
                className="px-3 py-2 rounded border border-gray-300 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setOtpDialog((prev) => ({ ...prev, sending: true, error: "" }));
                  try {
                    const res = await api.post("/settings/otp/send");
                    if (res.data?.success) {
                      toast.success("OTP sent to email");
                      setOtpDialog((prev) => ({ ...prev, sent: true, sending: false }));
                    } else {
                      setOtpDialog((prev) => ({
                        ...prev,
                        sending: false,
                        error: res.data?.message || "Failed to send OTP",
                      }));
                    }
                  } catch (err) {
                    setOtpDialog((prev) => ({
                      ...prev,
                      sending: false,
                      error: err.response?.data?.message || "Failed to send OTP",
                    }));
                  }
                }}
                disabled={otpDialog.sending}
                className="px-3 py-2 rounded border border-gray-300 text-sm"
              >
                {otpDialog.sending ? "Sending..." : "Send OTP"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (otpDialog.otp.length !== 4) {
                    setOtpDialog((prev) => ({ ...prev, error: "Enter 4-digit OTP" }));
                    return;
                  }
                  setOtpDialog((prev) => ({ ...prev, verifying: true, error: "" }));
                  try {
                    const res = await api.post("/settings/otp/verify", { otp: otpDialog.otp });
                    if (res.data?.success) {
                      toast.success("OTP verified. You can now set a new PIN.");
                      setOtpDialog({ open: false, sent: false, otp: "", sending: false, verifying: false, error: "" });
                    } else {
                      setOtpDialog((prev) => ({
                        ...prev,
                        verifying: false,
                        error: res.data?.message || "OTP verification failed",
                      }));
                    }
                  } catch (err) {
                    setOtpDialog((prev) => ({
                      ...prev,
                      verifying: false,
                      error: err.response?.data?.message || "OTP verification failed",
                    }));
                  }
                }}
                disabled={otpDialog.verifying}
                className="px-3 py-2 rounded bg-emerald-600 text-white text-sm disabled:opacity-60"
              >
                {otpDialog.verifying ? "Verifying..." : "Verify"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
