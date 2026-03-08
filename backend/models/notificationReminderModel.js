const mongoose = require("mongoose");

const NotificationReminderSchema = new mongoose.Schema(
  {
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      required: true,
    },
    invoiceNo: { type: String, default: "" },
    companyName: { type: String, default: "" },
    channels: {
      email: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      whatsapp: { type: Boolean, default: false },
    },
    language: { type: String, enum: ["en", "ur"], default: "en" },
    templateId: { type: String, enum: ["soft", "strong"], default: "soft" },
    scheduleMode: { type: String, enum: ["now", "later"], default: "now" },
    scheduleAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["QUEUED", "SCHEDULED", "SENT", "FAILED"],
      default: "QUEUED",
    },
  },
  { timestamps: true }
);

NotificationReminderSchema.index({ transactionId: 1, createdAt: -1 });

module.exports = mongoose.model(
  "NotificationReminder",
  NotificationReminderSchema
);

