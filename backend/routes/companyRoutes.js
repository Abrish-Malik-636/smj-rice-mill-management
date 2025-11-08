const express = require("express");
const router = express.Router();
const {
  getCompanies,
  createCompany,
  deleteCompany,
} = require("../controllers/companyController");

router.route("/").get(getCompanies).post(createCompany);
router.route("/:id").delete(deleteCompany);

module.exports = router;
