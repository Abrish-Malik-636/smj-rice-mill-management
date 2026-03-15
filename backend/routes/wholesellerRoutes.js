const express = require("express");
const router = express.Router();
const wholesellerController = require("../controllers/wholesellerController");

router.get("/", wholesellerController.listWholesellers);
router.post("/", wholesellerController.createOrUpdateWholeseller);
router.delete("/:id", wholesellerController.deleteWholeseller);

module.exports = router;

