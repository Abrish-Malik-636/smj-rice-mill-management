const express = require("express");
const router = express.Router();
const { getAll, create, update, delete: deleteItem, getOverview, consume } = require("../controllers/managerialStockController");

router.route("/").get(getAll).post(create);
router.get("/overview", getOverview);
router.post("/consume", consume);
router.route("/:id").put(update).delete(deleteItem);

module.exports = router;
