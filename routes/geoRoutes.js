const express = require("express");
const router = express.Router();
const geoController = require("../controllers/geoController");
const {
  searchRules,
  handleSearchValidation,
} = require("../validators/searchValidator");

router.get("/suggest", geoController.suggest);
router.get("/reverse", geoController.reverse);
router.get("/nearby", geoController.nearby);
router.get(
  "/search",
  searchRules,
  handleSearchValidation("json"),
  geoController.search,
);

module.exports = router;
