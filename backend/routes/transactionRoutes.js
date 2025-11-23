// backend/routes/transactionRoutes.js
const express = require("express");
const router = express.Router();
const transactionController = require("../controllers/transactionController");

/**
 * /api/transactions
 *  GET    /           -> list (with filters)
 *  GET    /summary/today
 *  GET    /:id
 *  POST   /
 *  PUT    /:id
 *  DELETE /:id
 */

// List with query params
router.get("/", transactionController.getTransactions);

// Today summary (optional, for dashboard/reports)
router.get("/summary/today", transactionController.getTodaySummary);

// Single
router.get("/:id", transactionController.getTransactionById);

// Create
router.post("/", transactionController.createTransaction);

// Update
router.put("/:id", transactionController.updateTransaction);

// Delete
router.delete("/:id", transactionController.deleteTransaction);

module.exports = router;
