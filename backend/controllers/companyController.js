const Company = require("../models/companyModel");

// Helper function to normalize text for duplicate checking
const normalizeText = (text) => {
  return text ? text.toLowerCase().trim().replace(/\s+/g, " ") : "";
};

// Check for similar company names
const checkSimilarCompany = async (name, excludeId = null) => {
  const normalized = normalizeText(name);
  const query = {
    $or: [
      { name: { $regex: new RegExp(`^${normalized}$`, "i") } },
      { name: { $regex: new RegExp(normalized, "i") } },
    ],
  };
  
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  
  return await Company.findOne(query);
};

// 📄 GET all companies
exports.getCompanies = async (req, res) => {
  try {
    const companies = await Company.find().sort({ name: 1 });
    res.json({ success: true, data: companies });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 📄 GET single company
exports.getCompany = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company)
      return res.status(404).json({ success: false, message: "Company not found" });
    res.json({ success: true, data: company });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 🆕 CREATE new company
exports.createCompany = async (req, res) => {
  try {
    // Check for duplicates before creating
    const similar = await checkSimilarCompany(req.body.name);
    if (similar) {
      return res.status(400).json({
        success: false,
        message: `Customer with similar name already exists: "${similar.name}"`,
      });
    }

    // Normalize data
    const companyData = {
      ...req.body,
      name: req.body.name?.trim(),
      email: req.body.email?.trim().toLowerCase(),
      phone: req.body.phone?.trim(),
      address: req.body.address?.trim(),
      partyType: req.body.partyType || "CUSTOMER",
    };

    const company = await Company.create(companyData);
    res.status(201).json({ success: true, data: company });
  } catch (error) {
    // Handle validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

// ✏️ UPDATE existing company
exports.updateCompany = async (req, res) => {
  try {
    // Check for duplicates if name is being updated
    if (req.body.name) {
      const similar = await checkSimilarCompany(req.body.name, req.params.id);
      if (similar) {
        return res.status(400).json({
          success: false,
          message: `Customer with similar name already exists: "${similar.name}"`,
        });
      }
    }

    // Normalize data
    const updateData = { ...req.body };
    if (updateData.name) updateData.name = updateData.name.trim();
    if (updateData.email) updateData.email = updateData.email.trim().toLowerCase();
    if (updateData.phone) updateData.phone = updateData.phone.trim();
    if (updateData.address) updateData.address = updateData.address.trim();
    if (updateData.partyType) updateData.partyType = updateData.partyType.trim();

    const updated = await Company.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Company not found" });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    // Handle validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

// ❌ DELETE company
exports.deleteCompany = async (req, res) => {
  try {
    const company = await Company.findByIdAndDelete(req.params.id);
    if (!company)
      return res.status(404).json({ success: false, message: "Company not found" });
    res.json({ success: true, message: "Company deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
