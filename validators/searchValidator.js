const { query, validationResult } = require("express-validator");

const searchRules = [
  query("q")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 120 })
    .withMessage("Search text is too long")
    .customSanitizer((value) => String(value || "").replace(/\s+/g, " ")),
  query("lat").optional({ checkFalsy: true }).isFloat().toFloat(),
  query("lng").optional({ checkFalsy: true }).isFloat().toFloat(),
  query("radius")
    .optional({ checkFalsy: true })
    .isInt({ min: 100, max: 50000 })
    .toInt(),
  query("wifi").optional({ checkFalsy: true }).isBoolean().toBoolean(),
  query("vegan").optional({ checkFalsy: true }).isBoolean().toBoolean(),
  query("outdoorSeating")
    .optional({ checkFalsy: true })
    .isBoolean()
    .toBoolean(),
  query("codingFriendly")
    .optional({ checkFalsy: true })
    .isBoolean()
    .toBoolean(),
  query("quiet").optional({ checkFalsy: true }).isBoolean().toBoolean(),
  query("fastInternet").optional({ checkFalsy: true }).isBoolean().toBoolean(),
];

function handleSearchValidation(mode = "page") {
  return (req, res, next) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) return next();

    const firstMessage =
      errors.array({ onlyFirstError: true })[0]?.msg ||
      "Invalid search parameters";
    const queryValue = String(req.query.q || "")
      .replace(/\s+/g, " ")
      .trim();

    console.warn("Search validation failed:", firstMessage);

    if (mode === "json") {
      return res.status(200).json({
        results: [],
        message: firstMessage,
      });
    }

    return res.status(200).render("pages/search", {
      results: [],
      query: queryValue,
      searchError: firstMessage,
    });
  };
}

module.exports = { searchRules, handleSearchValidation };
