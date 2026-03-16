const express = require("express");
const hr = require("../controllers/hrController");

const router = express.Router();

router.get("/meta", hr.getMeta);

// Employees
router.get("/employees", hr.listEmployees);
router.post("/employees", hr.createEmployee);
router.put("/employees/:id", hr.updateEmployee);
router.delete("/employees/:id", hr.deleteEmployee);

// Advances
router.get("/advances", hr.listAdvances);
router.post("/advances", hr.createAdvance);
router.put("/advances/:id", hr.updateAdvance);
router.delete("/advances/:id", hr.deleteAdvance);

// Payroll
router.get("/payrolls", hr.listPayrolls);
router.post("/payrolls/generate", hr.generatePayrolls);
router.post("/payrolls/generate-one", hr.generatePayrollForEmployee);
router.post("/payrolls/:id/pay", hr.payPayroll);
router.delete("/payrolls/:id", hr.deletePayroll);

// Reports
router.get("/reports/advance-balances", hr.getAdvanceBalances);
router.get("/reports/employees", hr.getEmployeeList);
router.get("/reports/payroll-summary", hr.getMonthlyPayrollSummary);
router.get("/reports/department-salary", hr.getDepartmentSalaryReport);

module.exports = router;
