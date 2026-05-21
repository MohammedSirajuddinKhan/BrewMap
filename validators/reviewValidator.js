const { body } = require("express-validator");

const createReviewValidator = [
  body("cafeId").notEmpty().withMessage("Cafe is required"),
  body("rating")
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating must be between 1 and 5"),
  body("title").optional().isString().isLength({ max: 120 }),
  body("comment").optional().isString().isLength({ max: 2000 }),
];

const editReviewValidator = [
  body("rating").optional().isInt({ min: 1, max: 5 }),
  body("title").optional().isString().isLength({ max: 120 }),
  body("comment").optional().isString().isLength({ max: 2000 }),
];

module.exports = { createReviewValidator, editReviewValidator };
