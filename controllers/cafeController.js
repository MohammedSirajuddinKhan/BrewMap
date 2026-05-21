const cafeService = require("../services/cafeService");
const aiService = require("../services/aiService");
const Cafe = require("../models/Cafe");
const { AppError } = require("../middleware/errorMiddleware");

const DEFAULT_SEARCH_RADIUS = 10000;

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderSearchPage(res, payload) {
  const viewData = {
    results: [],
    query: "",
    searchError: "",
    ...payload,
  };
  return new Promise((resolve, reject) => {
    res.status(200).render("pages/search", viewData, (renderErr, html) => {
      if (renderErr) return reject(renderErr);
      res.send(html);
      resolve();
    });
  });
}

function renderSearchFallback(res, query, message) {
  const safeQuery = escapeHtml(query);
  const safeMessage = escapeHtml(message);
  return res
    .status(200)
    .type("html")
    .send(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BrewMap Search</title><link rel="stylesheet" href="/css/style.css"></head><body><main class="search-page"><section class="search-toolbar glass"><form id="search-form" class="search-bar" action="/search" method="get"><input name="q" value="${safeQuery}" placeholder="Search city, pincode, or cafe" aria-label="Search cafes"><button type="submit">Search</button></form></section><div class="search-layout"><aside class="search-left glass"><div class="empty-state error-state"><div class="empty-icon">!</div><div><h3>Search unavailable</h3><p>${safeMessage}</p></div></div></aside></div></main></body></html>`,
    );
}

exports.home = async (req, res, next) => {
  try {
    // Show trending/top-rated sample from DB
    const topRated = await Cafe.find().sort({ rating: -1 }).limit(6).lean();
    const trending = await Cafe.find().sort({ createdAt: -1 }).limit(6).lean();
    res.render("pages/home", { topRated, trending });
  } catch (err) {
    next(new AppError(err.message));
  }
};

exports.search = async (req, res, next) => {
  try {
    const {
      q,
      lat,
      lng,
      radius,
      wifi,
      vegan,
      outdoorSeating,
      codingFriendly,
      quiet,
      fastInternet,
    } = req.query;
    const filters = {
      wifi: wifi === "true" || wifi === "1",
      vegan: vegan === "true" || vegan === "1",
      outdoorSeating: outdoorSeating === "true" || outdoorSeating === "1",
      codingFriendly: codingFriendly === "true" || codingFriendly === "1",
      quiet: quiet === "true" || quiet === "1",
      fastInternet: fastInternet === "true" || fastInternet === "1",
    };

    const normalizedQuery = String(q || "")
      .replace(/\s+/g, " ")
      .trim();

    if (normalizedQuery) {
      const data = await cafeService.cafeSearch(normalizedQuery, {
        radius: Number(radius) || DEFAULT_SEARCH_RADIUS,
        filters,
      });
      await renderSearchPage(res, {
        results: data || [],
        query: normalizedQuery,
      });
      return;
    }

    if (lat && lng) {
      const data = await cafeService.nearbySearch({
        lat: Number(lat),
        lng: Number(lng),
        radius: Number(radius) || DEFAULT_SEARCH_RADIUS,
        filters,
      });
      await renderSearchPage(res, { results: data || [], query: "" });
      return;
    }

    await renderSearchPage(res, { results: [], query: "" });
  } catch (err) {
    console.error(
      "Search controller error:",
      err?.stack || err?.message || err,
    );
    const query = String(req.query.q || "")
      .replace(/\s+/g, " ")
      .trim();
    const message = "Location service temporarily unavailable.";
    try {
      await renderSearchPage(res, {
        results: [],
        query,
        searchError: message,
      });
    } catch (renderErr) {
      console.error("Search render failed:", renderErr?.message || renderErr);
      return renderSearchFallback(res, query, message);
    }
  }
};

exports.details = async (req, res, next) => {
  try {
    const placeId = req.params.placeId;
    const data = await cafeService.cafeDetails(placeId);
    if (!data?.cafe) return next(new AppError("Place not found", 404));

    const cafe = await cafeService.syncCafeToDB({
      placeId: data.cafe.placeId,
      name: data.cafe.name,
      address: data.cafe.address,
      lat: data.cafe.location.coordinates[1],
      lng: data.cafe.location.coordinates[0],
      types: data.cafe.types,
      rating: data.cafe.rating,
      ratingsTotal: data.cafe.ratingsTotal,
      openNow: data.cafe.openNow,
      phone: data.cafe.phone,
      website: data.cafe.website,
      photos: data.cafe.photos,
      amenities: data.cafe.amenities,
    });
    const vibe = await aiService.generateVibeSummary(cafe);

    res.render("pages/cafe-details", {
      cafe,
      place: data.place,
      vibe,
      reverseGeocode: data.reverseGeocode,
    });
  } catch (err) {
    next(new AppError(err.message));
  }
};

exports.addImage = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).redirect("/auth/login");
    const cafeId = req.params.id;
    const cafe = await Cafe.findById(cafeId);
    if (!cafe) return next(new AppError("Cafe not found", 404));

    // Only allow creator or admin
    if (
      String(cafe.createdBy) !== String(userId) &&
      req.user.role !== "admin"
    ) {
      return next(new AppError("Unauthorized", 403));
    }

    const uploaded = req.fileUploaded
      ? [req.fileUploaded]
      : req.filesUploaded || [];
    if (uploaded.length) {
      cafe.photos = (cafe.photos || []).concat(
        uploaded.map((u) => ({ url: u.url, public_id: u.public_id })),
      );
      await cafe.save();
    }

    res.redirect(`/cafes/details/${cafe.placeId}`);
  } catch (err) {
    next(err);
  }
};

exports.removeImage = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).redirect("/auth/login");
    const cafeId = req.params.id;
    const publicId = req.body.public_id;
    const cafe = await Cafe.findById(cafeId);
    if (!cafe) return next(new AppError("Cafe not found", 404));
    if (
      String(cafe.createdBy) !== String(userId) &&
      req.user.role !== "admin"
    ) {
      return next(new AppError("Unauthorized", 403));
    }

    // remove from cloud
    if (publicId) {
      const { cloudinary } = require("../utils/cloudinary");
      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (e) {
        console.warn("Cloud delete failed", e);
      }
      cafe.photos = (cafe.photos || []).filter((p) => p.public_id !== publicId);
      await cafe.save();
    }

    res.redirect(`/cafes/details/${cafe.placeId}`);
  } catch (err) {
    next(err);
  }
};
