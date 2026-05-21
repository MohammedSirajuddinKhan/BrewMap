const User = require("../models/User");
const Favorite = require("../models/Favorite");
const Collection = require("../models/Collection");
const Cafe = require("../models/Cafe");
const { AppError } = require("../middleware/errorMiddleware");

exports.dashboard = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.redirect("/auth/login");
    const favorites = await Favorite.find({ user: userId })
      .populate("cafe")
      .limit(20);
    const collections = await Collection.find({ user: userId }).limit(20);
    res.render("pages/favorites", { favorites, collections });
  } catch (err) {
    next(new AppError(err.message));
  }
};

exports.getProfile = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.redirect("/auth/login");
    const user = await User.findById(userId).lean();
    res.render("pages/profile", { user });
  } catch (err) {
    next(new AppError(err.message));
  }
};
