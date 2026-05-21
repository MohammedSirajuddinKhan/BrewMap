const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { body } = require("express-validator");
const rateLimit = require("express-rate-limit");

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 6,
  message: "Too many auth attempts, try again later",
});

router.get("/login", authController.renderLogin);
router.get("/register", authController.renderRegister);
router.get("/forgot", authController.renderForgot);
router.get("/reset/:token", authController.renderReset);

router.post(
  "/register",
  authLimiter,
  [
    body("name").isLength({ min: 2 }).trim(),
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 8 }),
  ],
  authController.register,
);

router.post(
  "/login",
  authLimiter,
  [body("email").isEmail(), body("password").exists()],
  authController.login,
);

router.get("/logout", authController.logout);

router.post(
  "/forgot",
  authLimiter,
  [body("email").isEmail()],
  authController.forgotPassword,
);
router.post("/reset/:token", authController.resetPassword);

module.exports = router;
