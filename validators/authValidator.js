const { body } = require("express-validator");

const registerValidator = [
  body("name")
    .isLength({ min: 2 })
    .withMessage("Name must be at least 2 characters"),
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be 8+ characters"),
];

const loginValidator = [
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),
  body("password").exists().withMessage("Password is required"),
];

module.exports = { registerValidator, loginValidator };
