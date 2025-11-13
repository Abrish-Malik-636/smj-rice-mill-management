const ExpenseCategory = require("../models/expenseCategoryModel");

// GET all
exports.getExpenseCategories = async (req, res) => {
  try {
    const categories = await ExpenseCategory.find();
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// CREATE
exports.createExpenseCategory = async (req, res) => {
  try {
    if (!req.body.name || req.body.name.trim() === "") {
      return res
        .status(400)
        .json({ success: false, message: "Name is required" });
    }

    const category = await ExpenseCategory.create(req.body);
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// UPDATE
exports.updateExpenseCategory = async (req, res) => {
  try {
    const updated = await ExpenseCategory.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// DELETE
exports.deleteExpenseCategory = async (req, res) => {
  try {
    const deleted = await ExpenseCategory.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    res.json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
