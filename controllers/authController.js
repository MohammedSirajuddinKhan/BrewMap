const authService = require("../services/authService");
const { cookieOptions } = require("../utils/jwt");
const { AppError } = require("../middleware/errorMiddleware");

exports.renderLogin = (req, res) => res.render("pages/login");
exports.renderRegister = (req, res) => res.render("pages/register");
exports.renderForgot = (req, res) => res.render("pages/forgot");
exports.renderReset = (req, res) => res.render("pages/reset");

const { validationResult } = require("express-validator");

exports.register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(
        new AppError(
          errors
            .array()
            .map((e) => e.msg)
            .join(", "),
          400,
        ),
      );
    }
    const { name, email, password } = req.body;
    const { user, token } = await authService.register({
      name,
      email,
      password,
    });
    res.cookie("token", token, cookieOptions);
    res.redirect("/");
  } catch (err) {
    next(new AppError(err.message, 400));
  }
};

exports.login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError("Invalid credentials", 400));
    }
    const { email, password } = req.body;
    const { user, token } = await authService.login({ email, password });
    res.cookie("token", token, cookieOptions);
    res.redirect("/");
  } catch (err) {
    next(new AppError(err.message, 401));
  }
};

exports.logout = (req, res) => {
  res.clearCookie("token");
  res.redirect("/");
};

exports.renderForgot = (req, res) => res.render("pages/login");

exports.forgotPassword = async (req, res, next) => {
  try {
    await authService.forgotPassword(req.body.email);
    res.redirect("/");
  } catch (err) {
    next(new AppError(err.message, 400));
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const token = req.params.token;
    const { token: jwtToken } = await authService.resetPassword(
      token,
      req.body.password,
    );
    res.cookie("token", jwtToken, cookieOptions);
    res.redirect("/");
  } catch (err) {
    next(new AppError(err.message, 400));
  }
};
