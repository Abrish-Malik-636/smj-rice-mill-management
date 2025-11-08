const mongoose = require("mongoose");

const companySchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: {
    type: String,
    enum: ["Supplier", "Customer", "Both"],
    required: true,
  },
  contactPerson: { type: String },
  phone: { type: String },
  email: { type: String },
  address: { type: String },
});

module.exports = mongoose.model("Company", companySchema);
