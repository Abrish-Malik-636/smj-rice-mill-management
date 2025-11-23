// backend/models/transactionModel.js
const mongoose = require("mongoose");

const TransactionItemSchema = new mongoose.Schema(
  {
    productTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductType",
      required: true,
    },
    productTypeName: {
      type: String,
      required: true,
      trim: true,
    },
    numBags: {
      type: Number,
      required: true,
      min: 0,
    },
    perBagWeightKg: {
      type: Number,
      required: true,
      min: 0,
    },
    netWeightKg: {
      type: Number,
      required: true,
      min: 0,
    },
    rate: {
      type: Number,
      required: true,
      min: 0,
    },
    rateType: {
      type: String,
      enum: ["per_kg", "per_bag"],
      default: "per_kg",
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const TransactionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["PURCHASE", "SALE"],
      required: true,
    },

    invoiceNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    date: {
      type: Date,
      required: true,
    },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
    },

    paymentStatus: {
      type: String,
      enum: ["PAID", "UNPAID", "PARTIAL"],
      default: "PAID",
    },

    // 🔹 NEW: payment method for future gateway integration
    paymentMethod: {
      type: String,
      enum: ["CASH", "CARD", "BANK_TRANSFER", "CREDIT"],
      default: "CASH",
    },

    dueDate: {
      type: Date,
      default: null,
    },

    remarks: {
      type: String,
      default: "",
      trim: true,
    },

    items: {
      type: [TransactionItemSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "At least one item is required",
      },
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true }
);

TransactionSchema.index({ type: 1, date: 1 });
TransactionSchema.index({ companyId: 1, date: 1 });

module.exports = mongoose.model("Transaction", TransactionSchema);
