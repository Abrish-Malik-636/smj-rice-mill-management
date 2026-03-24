const mongoose = require("mongoose");

const accountingFilterTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    reportKey: { type: String, required: true, trim: true }, // e.g. ledger, pl, trial
    companyId: { type: String, default: "", trim: true },
    filters: { type: mongoose.Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, default: true },
    createdBy: { type: String, default: "user", trim: true },
  },
  { timestamps: true }
);

accountingFilterTemplateSchema.index({ reportKey: 1, companyId: 1, name: 1 });

module.exports = mongoose.model("AccountingFilterTemplate", accountingFilterTemplateSchema);

