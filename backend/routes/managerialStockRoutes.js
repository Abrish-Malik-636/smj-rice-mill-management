const express = require("express");
const router = express.Router();
const { getAll, create, update, delete: deleteItem } = require("../controllers/managerialStockController");

router.route("/").get(getAll).post(create);
router.route("/:id").put(update).delete(deleteItem);

module.exports = router;
