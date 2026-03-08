const express = require("express");
const acc = require("../controllers/accountingController");

const router = express.Router();

router.get("/daybook", acc.getDaybook);
router.get("/ledger", acc.getLedger);
router.get("/trial-balance", acc.getTrialBalance);
router.get("/cash", acc.getCashSummary);
router.get("/expenses-report", acc.getExpensesReport);
router.get("/pl", acc.getProfitLoss);
router.get("/balance", acc.getBalanceSheet);
router.get("/party-ledger", acc.getPartyLedger);
router.get("/outstanding/receivables", acc.getOutstandingReceivables);
router.get("/outstanding/payables", acc.getOutstandingPayables);
router.get("/accounts", acc.getAccounts);
router.post("/accounts", acc.createAccount);
router.get("/journal", acc.getJournalEntries);
router.post("/journal/post", acc.postManualJournal);
router.post("/journal/:id/reverse", acc.reverseJournalEntry);
router.post("/backfill", acc.runBackfill);

router.get("/expenses", acc.listExpenses);
router.post("/expenses", acc.createExpense);
router.put("/expenses/:id", acc.updateExpense);
router.delete("/expenses/:id", acc.deleteExpense);

module.exports = router;
