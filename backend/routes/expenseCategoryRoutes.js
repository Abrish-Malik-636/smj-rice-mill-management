const express = require("express");
const router = express.Router();

const {
  getExpenseCategories,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
} = require("../controllers/expenseCategoryController");

router.route("/").get(getExpenseCategories).post(createExpenseCategory);
router.route("/:id").put(updateExpenseCategory).delete(deleteExpenseCategory);

module.exports = router;
