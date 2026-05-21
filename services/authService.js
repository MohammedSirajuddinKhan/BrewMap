const User = require("../models/User");
const { signToken } = require("../utils/jwt");
const mailer = require("../utils/mailer");
const crypto = require("crypto");

async function register({ name, email, password }) {
  const user = await User.create({ name, email, password });
  const token = signToken({ id: user._id });
  return { user, token };
}

async function login({ email, password }) {
  const user = await User.findOne({ email }).select("+password");
  if (!user) throw new Error("Invalid credentials");
  const match = await user.comparePassword(password);
  if (!match) throw new Error("Invalid credentials");
  const token = signToken({ id: user._id });
  return { user, token };
}

async function forgotPassword(email) {
  const user = await User.findOne({ email });
  if (!user) throw new Error("No user with that email");
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${process.env.ORIGIN || "http://localhost:3000"}/auth/reset-password/${resetToken}`;
  const message = `You requested a password reset. Click here: ${resetUrl}`;
  await mailer.sendMail({
    to: user.email,
    subject: "Password reset",
    text: message,
  });
  return true;
}

async function resetPassword(token, newPassword) {
  const hashed = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({
    resetPasswordToken: hashed,
    resetPasswordExpires: { $gt: Date.now() },
  });
  if (!user) throw new Error("Token is invalid or has expired");
  user.password = newPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();
  const jwt = signToken({ id: user._id });
  return { user, token: jwt };
}

module.exports = { register, login, forgotPassword, resetPassword };
