const express = require("express");
const router = express.Router();
const {
  getProductTypes,
  createProductType,
  updateProductType,
  deleteProductType,
} = require("../controllers/productTypeController");

router.route("/").get(getProductTypes).post(createProductType);

router.route("/:id").put(updateProductType).delete(deleteProductType);

module.exports = router;
