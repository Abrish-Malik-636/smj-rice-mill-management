const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customerController");

router.get("/", customerController.listCustomers);
router.post("/", customerController.createOrUpdateCustomer);
router.delete("/:id", customerController.deleteCustomer);

module.exports = router;

