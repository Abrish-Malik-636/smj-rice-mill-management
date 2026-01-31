const ExpenseCategory = require("../models/expenseCategoryModel");

// Helper function to normalize text for duplicate checking
const normalizeText = (text) => {
  return text ? text.toLowerCase().trim().replace(/\s+/g, " ") : "";
};

// Check for similar category names
const checkSimilarCategory = async (name, excludeId = null) => {
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
  
  return await ExpenseCategory.findOne(query);
};

// GET all expense categories
exports.getExpenseCategories = async (req, res) => {
  try {
    const categories = await ExpenseCategory.find().sort({ name: 1 });
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// CREATE expense category
exports.createExpenseCategory = async (req, res) => {
  try {
    if (!req.body.name || req.body.name.trim() === "") {
      return res
        .status(400)
        .json({ success: false, message: "Category name is required" });
    }

    // Check for duplicates before creating
    const similar = await checkSimilarCategory(req.body.name);
    if (similar) {
      return res.status(400).json({
        success: false,
        message: `Expense category with similar name already exists: "${similar.name}"`,
      });
    }

    if (!req.body.type || req.body.type.trim() === "") {
      return res.status(400).json({ success: false, message: "Category type is required for financial reporting" });
    }
    const categoryData = {
      name: req.body.name.trim(),
      code: req.body.code?.trim() || "",
      type: req.body.type.trim(),
      description: req.body.description?.trim() || "",
    };

    const category = await ExpenseCategory.create(categoryData);
    res.status(201).json({ success: true, data: category });
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

// UPDATE expense category
exports.updateExpenseCategory = async (req, res) => {
  try {
    // Check for duplicates if name is being updated
    if (req.body.name) {
      const similar = await checkSimilarCategory(req.body.name, req.params.id);
      if (similar) {
        return res.status(400).json({
          success: false,
          message: `Expense category with similar name already exists: "${similar.name}"`,
        });
      }
    }

    const updateData = {};
    if (req.body.name !== undefined) updateData.name = req.body.name.trim();
    if (req.body.code !== undefined) updateData.code = req.body.code.trim() || "";
    if (req.body.type !== undefined) updateData.type = req.body.type.trim();
    if (req.body.description !== undefined) updateData.description = req.body.description.trim() || "";

    const updated = await ExpenseCategory.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Expense category not found" });
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

// DELETE expense category
exports.deleteExpenseCategory = async (req, res) => {
  try {
    const deleted = await ExpenseCategory.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Expense category not found" });
    }

    res.json({ success: true, message: "Expense category deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
