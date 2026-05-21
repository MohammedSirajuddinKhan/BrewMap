const express = require("express");
const router = express.Router();
const cafeController = require("../controllers/cafeController");
const { attachUser } = require("../middleware/authMiddleware");
const {
  searchRules,
  handleSearchValidation,
} = require("../validators/searchValidator");

router.use(attachUser);

router.get("/", cafeController.home);
router.get(
  "/search",
  searchRules,
  handleSearchValidation("page"),
  cafeController.search,
);

module.exports = router;
