import React, { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Clock,
  Mail,
  MessageCircle,
  Phone,
  Languages,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";

const LANGUAGE_OPTIONS = [
  { id: "en", label: "English" },
  { id: "ur", label: "اردو" },
];

const TEMPLATE_OPTIONS = [
  { id: "soft", labelEn: "Friendly reminder", labelUr: "نرم یاددہانی" },
  { id: "strong", labelEn: "Urgent reminder", labelUr: "فوری یاددہانی" },
];

// ---------- Helpers ----------
const formatDate = (dateString) => {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
};

const isPendingInvoice = (t) =>
  t &&
  (t.paymentStatus === "UNPAID" || t.paymentStatus === "PARTIAL") &&
  t.dueDate;

// build message text based on language/template
function buildMessage({
  transaction,
  company,
  settings,
  language,
  templateId,
}) {
  if (!transaction || !settings) return { subject: "", body: "", sms: "" };

  const millName = settings.millName || "SMJ Mill";
  const millPhone = settings.phone || "";
  const millEmail = settings.email || "";

  const companyName = company?.name || transaction.companyName || "";
  const amount = Number(transaction.totalAmount || 0).toFixed(2);
  const invoiceNo = transaction.invoiceNo;
  const due = formatDate(transaction.dueDate);
  const date = formatDate(transaction.date);
  const status = transaction.paymentStatus;

  if (language === "ur") {
    const polite =
      templateId === "soft" ||
      (templateId !== "soft" && templateId !== "strong");
    const subject = polite
      ? `ادائیگی کی یاددہانی - انوائس ${invoiceNo}`
      : `فوری ادائیگی درکار - انوائس ${invoiceNo}`;

    const bodyLines = polite
      ? [
          `محترم ${companyName}،`,
          "",
          `یہ ایک دوستانہ یاددہانی ہے کہ آپ کا انوائس ${invoiceNo} مورخہ ${date} رقم ${amount} اب تک مکمل طور پر ادا نہیں ہوا۔`,
          `ادائیگی کی آخری تاریخ: ${due}.`,
          "",
          `براہ کرم اپنی سہولت کے مطابق جلد از جلد ادائیگی کا انتظام کریں۔`,
          "",
          `شکریہ،`,
          millName,
          millPhone ? `فون: ${millPhone}` : "",
          millEmail ? `ای میل: ${millEmail}` : "",
        ]
      : [
          `محترم ${companyName}،`,
          "",
          `آپ کا انوائس ${invoiceNo} مورخہ ${date} رقم ${amount} ابھی تک ادا نہیں ہوا جبکہ آخری تاریخ ${due} گزر چکی/قریب ہے۔`,
          "",
          `براہ کرم ادائیگی فوری طور پر مکمل کریں تاکہ آپ کی سروس میں کوئی تعطل نہ آئے۔`,
          "",
          `شکریہ،`,
          millName,
          millPhone ? `فون: ${millPhone}` : "",
          millEmail ? `ای میل: ${millEmail}` : "",
        ];

    const sms = polite
      ? `محترم ${companyName}, آپ کا انوائس ${invoiceNo} رقم ${amount} کی ادائیگی ${due} تک واجب الادا ہے۔ براہ کرم ادائیگی مکمل کریں۔ - ${millName}`
      : `فوری ادائیگی درکار: انوائس ${invoiceNo} رقم ${amount} ابھی تک ادا نہیں ہوا۔ براہ کرم فوراً ادائیگی کریں۔ - ${millName}`;

    return { subject, body: bodyLines.join("\n"), sms };
  }

  // English messages
  const polite =
    templateId === "soft" || (templateId !== "soft" && templateId !== "strong");
  const subject = polite
    ? `Payment reminder - Invoice ${invoiceNo}`
    : `Urgent payment reminder - Invoice ${invoiceNo}`;

  const bodyLines = polite
    ? [
        `Dear ${companyName},`,
        "",
        `This is a friendly reminder that your invoice ${invoiceNo} dated ${date} for amount ${amount} is still ${status.toLowerCase()} and is due on ${due}.`,
        "",
        `Kindly arrange the payment at your earliest convenience.`,
        "",
        `Thank you,`,
        millName,
        millPhone ? `Phone: ${millPhone}` : "",
        millEmail ? `Email: ${millEmail}` : "",
      ]
    : [
        `Dear ${companyName},`,
        "",
        `Your invoice ${invoiceNo} dated ${date} for amount ${amount} remains unpaid and is due on ${due}.`,
        "",
        `Please treat this as an urgent reminder and clear the outstanding amount immediately to avoid any interruption in services.`,
        "",
        `Regards,`,
        millName,
        millPhone ? `Phone: ${millPhone}` : "",
        millEmail ? `Email: ${millEmail}` : "",
      ];

  const sms = polite
    ? `Dear ${companyName}, invoice ${invoiceNo} (amount ${amount}) is due on ${due}. Please complete the payment. - ${millName}`
    : `URGENT: Invoice ${invoiceNo} (amount ${amount}) is still unpaid. Please pay immediately. - ${millName}`;

  return { subject, body: bodyLines.join("\n"), sms };
}

export default function Notifications() {
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [settings, setSettings] = useState(null);

  const [selectedId, setSelectedId] = useState(null);
  const [language, setLanguage] = useState("en");
  const [templateId, setTemplateId] = useState("soft");
  const [channels, setChannels] = useState({
    email: true,
    sms: true,
    whatsapp: false,
  });
  const [scheduleMode, setScheduleMode] = useState("now"); // now | later
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");

  // --------- Load data ---------
  useEffect(() => {
    const loadAll = async () => {
      try {
        setLoading(true);

        const [txRes, compRes, settingsRes] = await Promise.all([
          api.get("/transactions", { params: { limit: 500, skip: 0 } }),
          api.get("/companies"),
          api.get("/system-settings"),
        ]);

        const txData = txRes.data?.data || txRes.data || [];
        const pending = txData.filter(isPendingInvoice);
        setTransactions(pending);

        setCompanies(compRes.data?.data || compRes.data || []);
        setSettings(
          settingsRes.data?.data || settingsRes.data || settingsRes || null
        );
      } catch (error) {
        console.error(error);
        toast.error("Failed to load notification data.");
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, []);

  const selectedTx = useMemo(
    () => transactions.find((t) => t._id === selectedId) || null,
    [transactions, selectedId]
  );

  const selectedCompany = useMemo(() => {
    if (!selectedTx || !companies.length) return null;
    return (
      companies.find((c) => c._id === selectedTx.companyId) || {
        name: selectedTx.companyName,
      }
    );
  }, [selectedTx, companies]);

  const messagePreview = useMemo(
    () =>
      buildMessage({
        transaction: selectedTx,
        company: selectedCompany,
        settings,
        language,
        templateId,
      }),
    [selectedTx, selectedCompany, settings, language, templateId]
  );

  const handleToggleChannel = (key) => {
    setChannels((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSendOrSchedule = async () => {
    if (!selectedTx) {
      toast.error("Please select an invoice first.");
      return;
    }

    if (!channels.email && !channels.sms && !channels.whatsapp) {
      toast.error("Select at least one channel (Email / SMS / WhatsApp).");
      return;
    }

    let scheduleAt = null;
    if (scheduleMode === "later") {
      if (!scheduleDate || !scheduleTime) {
        toast.error("Select schedule date and time.");
        return;
      }
      scheduleAt = new Date(`${scheduleDate}T${scheduleTime}:00`);
      if (Number.isNaN(scheduleAt.getTime())) {
        toast.error("Invalid schedule date/time.");
        return;
      }
    }

    try {
      // For now we just send to backend as a placeholder.
      // You can later implement actual gateways / cron using this data.
      await api.post("/notifications/reminders", {
        transactionId: selectedTx._id,
        channels,
        language,
        templateId,
        scheduleMode,
        scheduleAt,
      });

      if (scheduleMode === "now") {
        toast.success("Reminder queued to send (stub endpoint).");
      } else {
        toast.success("Reminder schedule saved successfully (stub).");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to schedule reminder.");
    }
  };

  const handleMarkPaid = async () => {
    if (!selectedTx) {
      toast.error("Select an invoice first.");
      return;
    }

    try {
      const payload = {
        ...selectedTx,
        paymentStatus: "PAID",
        // keep invoiceNo and other fields unchanged
      };
      delete payload._id;
      delete payload.createdAt;
      delete payload.updatedAt;

      await api.put(`/transactions/${selectedTx._id}`, payload);

      toast.success("Invoice marked as PAID. Reminders will stop.");
      setTransactions((prev) => prev.filter((t) => t._id !== selectedTx._id));
      setSelectedId(null);
    } catch (error) {
      console.error(error);
      toast.error("Failed to update payment status.");
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-50">
            <Bell className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-emerald-900">
              Payment Notifications
            </h1>
            <p className="text-sm text-gray-500">
              Send and schedule payment reminders for unpaid and partial
              invoices.
            </p>
          </div>
        </div>
        {loading && (
          <span className="text-xs text-gray-400">Loading data…</span>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* LEFT: pending invoices list */}
        <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-gray-700">
                Invoices with pending payment
              </h2>
            </div>
            <span className="text-xs text-gray-400">
              {transactions.length} pending
            </span>
          </div>

          {transactions.length === 0 && !loading ? (
            <div className="p-4 text-sm text-gray-500">
              No UNPAID or PARTIAL invoices with due dates were found. Payment
              reminders are only available for such invoices.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[420px]">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">
                      Invoice
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">
                      Company
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">
                      Status
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">
                      Due Date
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">
                      Amount
                    </th>
                    <th className="px-4 py-2 text-center font-medium text-gray-500">
                      Select
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr
                      key={t._id}
                      className={`border-t border-gray-50 hover:bg-emerald-50/40 cursor-pointer ${
                        selectedId === t._id ? "bg-emerald-50/70" : ""
                      }`}
                      onClick={() => setSelectedId(t._id)}
                    >
                      <td className="px-4 py-2 whitespace-nowrap text-xs font-mono text-gray-700">
                        {t.invoiceNo}
                        <div className="text-[11px] text-gray-400">
                          {formatDate(t.date)}
                        </div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-gray-700">
                        {t.companyName}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            t.paymentStatus === "UNPAID"
                              ? "bg-red-50 text-red-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {t.paymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-gray-700">
                        {formatDate(t.dueDate)}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-right text-gray-800">
                        {Number(t.totalAmount || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <input
                          type="radio"
                          checked={selectedId === t._id}
                          onChange={() => setSelectedId(t._id)}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RIGHT: reminder configuration */}
        <div className="space-y-4">
          {/* Summary card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-semibold text-gray-700">
                Reminder details
              </h2>
            </div>

            {selectedTx ? (
              <>
                <div className="text-sm text-gray-700">
                  <div className="font-semibold">
                    {selectedCompany?.name || selectedTx.companyName}
                  </div>
                  {selectedCompany?.phone && (
                    <div className="text-xs text-gray-500">
                      {selectedCompany.phone}
                    </div>
                  )}
                  {selectedCompany?.email && (
                    <div className="text-xs text-gray-500">
                      {selectedCompany.email}
                    </div>
                  )}
                </div>

                <div className="text-xs text-gray-500 space-y-1">
                  <div>
                    Invoice:{" "}
                    <span className="font-mono">{selectedTx.invoiceNo}</span>
                  </div>
                  <div>
                    Due: {formatDate(selectedTx.dueDate)} • Amount:{" "}
                    {Number(selectedTx.totalAmount || 0).toFixed(2)}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500">
                Select an invoice from the left to configure a reminder.
              </p>
            )}
          </div>

          {/* Template / language / channels */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Languages className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm font-semibold text-gray-700">
                  Message template
                </h2>
              </div>
            </div>

            {/* language */}
            <div className="flex gap-2 mb-2">
              {LANGUAGE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setLanguage(opt.id)}
                  className={`px-3 py-1.5 text-xs rounded-full border ${
                    language === opt.id
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* template select */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                Template
              </label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                {TEMPLATE_OPTIONS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {language === "ur" ? t.labelUr : t.labelEn}
                  </option>
                ))}
              </select>
            </div>

            {/* channels */}
            <div className="space-y-1">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Channels
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleChannel("email")}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs border ${
                    channels.email
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-gray-200 bg-white text-gray-600"
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleChannel("sms")}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs border ${
                    channels.sms
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-gray-200 bg-white text-gray-600"
                  }`}
                >
                  <Phone className="w-3.5 h-3.5" />
                  SMS
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleChannel("whatsapp")}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs border ${
                    channels.whatsapp
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-gray-200 bg-white text-gray-600"
                  }`}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  WhatsApp
                </button>
              </div>
            </div>
          </div>

          {/* Schedule + actions */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-semibold text-gray-700">
                Schedule &amp; actions
              </h2>
            </div>

            {/* schedule */}
            <div className="space-y-2">
              <div className="flex gap-3 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    className="text-emerald-600 focus:ring-emerald-500"
                    checked={scheduleMode === "now"}
                    onChange={() => setScheduleMode("now")}
                  />
                  <span className="text-gray-700">Send now</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    className="text-emerald-600 focus:ring-emerald-500"
                    checked={scheduleMode === "later"}
                    onChange={() => setScheduleMode("later")}
                  />
                  <span className="text-gray-700">Schedule</span>
                </label>
              </div>

              {scheduleMode === "later" && (
                <div className="flex flex-wrap gap-2 mt-1">
                  <input
                    type="date"
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                  />
                  <input
                    type="time"
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* actions */}
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={handleSendOrSchedule}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
              >
                <Bell className="w-4 h-4" />
                {scheduleMode === "now" ? "Send reminder" : "Schedule reminder"}
              </button>

              <button
                type="button"
                onClick={handleMarkPaid}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Mark as PAID
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-2">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Message preview ({language === "ur" ? "اردو" : "English"})
            </div>

            {!selectedTx ? (
              <p className="text-sm text-gray-500">
                Select an invoice to see the generated email / SMS text.
              </p>
            ) : (
              <>
                <div className="border border-gray-100 rounded-xl p-3 bg-gray-50 text-xs whitespace-pre-wrap max-h-40 overflow-y-auto">
                  <div className="font-semibold mb-1">
                    Email subject: {messagePreview.subject}
                  </div>
                  <div className="text-gray-700">{messagePreview.body}</div>
                </div>
                <div className="border border-gray-100 rounded-xl p-3 bg-gray-50 text-xs text-gray-700 whitespace-pre-wrap">
                  <span className="font-semibold">SMS / WhatsApp:</span>{" "}
                  {messagePreview.sms}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
