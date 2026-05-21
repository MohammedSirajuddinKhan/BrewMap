const { verifyToken } = require("../utils/jwt");
const User = require("../models/User");
const { AppError } = require("./errorMiddleware");

// Attach user info to req and res.locals when a valid token is present
async function attachUser(req, res, next) {
  res.locals.user = null;
  try {
    const token =
      req.cookies?.token || req.headers.authorization?.split(" ")?.[1];
    if (!token) return next();
    const payload = verifyToken(token);
    if (!payload?.id) return next();
    const user = await User.findById(payload.id).select("-password").lean();
    if (!user) return next();
    req.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
    res.locals.user = req.user;
    return next();
  } catch (err) {
    res.locals.user = null;
    return next();
  }
}

// Protect routes: for API return JSON error, for pages redirect to login
function requireAuth(req, res, next) {
  if (req.user && req.user.id) return next();
  if (req.originalUrl.startsWith("/api"))
    return next(new AppError("Authentication required", 401));
  return res.redirect("/auth/login");
}

module.exports = { attachUser, requireAuth };
