const express = require("express");
const hr = require("../controllers/hrController");

const router = express.Router();

// Employees
router.get("/employees", hr.listEmployees);
router.post("/employees", hr.createEmployee);
router.put("/employees/:id", hr.updateEmployee);
router.delete("/employees/:id", hr.deleteEmployee);

// Jobs
router.get("/jobs", hr.listJobs);
router.post("/jobs", hr.createJob);
router.put("/jobs/:id", hr.updateJob);
router.delete("/jobs/:id", hr.deleteJob);

// Applicants
router.get("/applicants", hr.listApplicants);
router.post("/applicants", hr.createApplicant);
router.put("/applicants/:id", hr.updateApplicant);
router.delete("/applicants/:id", hr.deleteApplicant);

// Leaves
router.get("/leaves", hr.listLeaves);
router.post("/leaves", hr.createLeave);
router.put("/leaves/:id", hr.updateLeave);
router.delete("/leaves/:id", hr.deleteLeave);

// Advances
router.get("/advances", hr.listAdvances);
router.post("/advances", hr.createAdvance);
router.put("/advances/:id", hr.updateAdvance);
router.delete("/advances/:id", hr.deleteAdvance);

// Payroll
router.get("/payrolls", hr.listPayrolls);
router.post("/payrolls", hr.createPayroll);
router.put("/payrolls/:id", hr.updatePayroll);
router.delete("/payrolls/:id", hr.deletePayroll);

module.exports = router;
