const cafeService = require("../services/cafeService");
const { AppError } = require("../middleware/errorMiddleware");

const DEFAULT_SEARCH_RADIUS = 10000;

exports.suggest = async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.json({ results: [] });
    const results = await cafeService.nominatimSearch(q, { limit: 8 });
    res.json({ results });
  } catch (err) {
    next(new AppError(err.message, 502));
  }
};

exports.reverse = async (req, res, next) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return next(new AppError("Invalid coordinates", 400));
    }
    const result = await cafeService.nominatimReverse(lat, lng);
    res.json({ result });
  } catch (err) {
    next(new AppError(err.message, 502));
  }
};

exports.nearby = async (req, res, next) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radius = Number(req.query.radius || DEFAULT_SEARCH_RADIUS);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return next(new AppError("Invalid coordinates", 400));
    }

    const filters = {
      wifi: req.query.wifi === "true" || req.query.wifi === "1",
      vegan: req.query.vegan === "true" || req.query.vegan === "1",
      outdoorSeating:
        req.query.outdoorSeating === "true" || req.query.outdoorSeating === "1",
      codingFriendly:
        req.query.codingFriendly === "true" || req.query.codingFriendly === "1",
      quiet: req.query.quiet === "true" || req.query.quiet === "1",
      fastInternet:
        req.query.fastInternet === "true" || req.query.fastInternet === "1",
    };

    const results = await cafeService.nearbySearch({
      lat,
      lng,
      radius,
      filters,
    });
    res.json({ results });
  } catch (err) {
    next(new AppError(err.message, 502));
  }
};

exports.search = async (req, res, next) => {
  try {
    const q = String(req.query.q || "")
      .replace(/\s+/g, " ")
      .trim();
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radius = Number(req.query.radius || DEFAULT_SEARCH_RADIUS);
    const filters = {
      wifi: req.query.wifi === "true" || req.query.wifi === "1",
      vegan: req.query.vegan === "true" || req.query.vegan === "1",
      outdoorSeating:
        req.query.outdoorSeating === "true" || req.query.outdoorSeating === "1",
      codingFriendly:
        req.query.codingFriendly === "true" || req.query.codingFriendly === "1",
      quiet: req.query.quiet === "true" || req.query.quiet === "1",
      fastInternet:
        req.query.fastInternet === "true" || req.query.fastInternet === "1",
    };

    if (q) {
      const results = await cafeService.cafeSearch(q, { radius, filters });
      return res.json({ results });
    }

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const results = await cafeService.nearbySearch({
        lat,
        lng,
        radius,
        filters,
      });
      return res.json({ results });
    }

    res.json({ results: [] });
  } catch (err) {
    console.warn("Geo search failed:", err?.response?.status || err?.message);
    return res.json({
      results: [],
      message: "Location service temporarily unavailable.",
    });
  }
};
