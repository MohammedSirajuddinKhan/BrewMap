const Review = require("../models/Review");
const Cafe = require("../models/Cafe");
const { cloudinary } = require("../utils/cloudinary");
const { AppError } = require("../middleware/errorMiddleware");

exports.createReview = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).redirect("/auth/login");
    const { cafeId, rating, title, comment } = req.body;
    if (!cafeId || !rating)
      return next(new AppError("Missing cafeId or rating", 400));

    const images = (req.filesUploaded || []).map((i) => ({
      url: i.url,
      public_id: i.public_id,
    }));

    const review = await Review.create({
      user: userId,
      cafe: cafeId,
      rating,
      title,
      comment,
      images,
    });

    // Optionally update cafe aggregate rating (simple approach)
    const agg = await Review.aggregate([
      { $match: { cafe: review.cafe } },
      {
        $group: {
          _id: "$cafe",
          avgRating: { $avg: "$rating" },
          count: { $sum: 1 },
        },
      },
    ]);
    if (agg && agg[0]) {
      await Cafe.findByIdAndUpdate(review.cafe, {
        rating: agg[0].avgRating,
        ratingsTotal: agg[0].count,
      });
    }

    res.redirect(`/cafes/details/${cafeId}`);
  } catch (err) {
    next(err);
  }
};

exports.editReview = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const id = req.params.id;
    const review = await Review.findById(id);
    if (!review) return next(new AppError("Review not found", 404));
    if (String(review.user) !== String(userId))
      return next(new AppError("Unauthorized", 403));

    const { rating, title, comment } = req.body;
    if (rating) review.rating = rating;
    if (title) review.title = title;
    if (comment) review.comment = comment;
    if (req.filesUploaded && req.filesUploaded.length) {
      review.images = (review.images || []).concat(
        req.filesUploaded.map((i) => ({ url: i.url, public_id: i.public_id })),
      );
    }
    await review.save();
    res.redirect(`/cafes/details/${review.cafe}`);
  } catch (err) {
    next(err);
  }
};

exports.deleteReview = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const id = req.params.id;
    const review = await Review.findById(id);
    if (!review) return next(new AppError("Review not found", 404));
    if (String(review.user) !== String(userId))
      return next(new AppError("Unauthorized", 403));

    // remove cloudinary assets
    for (const img of review.images || []) {
      if (img.public_id) {
        try {
          await cloudinary.uploader.destroy(img.public_id);
        } catch (e) {
          console.warn("Failed to delete cloud asset", e);
        }
      }
    }

    await review.remove();
    // Recompute cafe rating
    const agg = await Review.aggregate([
      { $match: { cafe: review.cafe } },
      {
        $group: {
          _id: "$cafe",
          avgRating: { $avg: "$rating" },
          count: { $sum: 1 },
        },
      },
    ]);
    if (agg && agg[0]) {
      await Cafe.findByIdAndUpdate(review.cafe, {
        rating: agg[0].avgRating,
        ratingsTotal: agg[0].count,
      });
    } else {
      await Cafe.findByIdAndUpdate(review.cafe, { rating: 0, ratingsTotal: 0 });
    }

    res.redirect(`/cafes/details/${review.cafe}`);
  } catch (err) {
    next(err);
  }
};
