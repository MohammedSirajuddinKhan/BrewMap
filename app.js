const express = require("express");
const path = require("path");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const cors = require("cors");

const indexRoutes = require("./routes/indexRoutes");
const cafeRoutes = require("./routes/cafeRoutes");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const geoRoutes = require("./routes/geoRoutes");
const errorHandler = require("./middleware/errorMiddleware");

const app = express();

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Expose selected env to views
app.locals.ORIGIN = process.env.ORIGIN || "";
app.locals.NOMINATIM_BASE_URL =
  process.env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org";
app.locals.OVERPASS_API_URL =
  process.env.OVERPASS_API_URL || "https://overpass-api.de/api/interpreter";

app.set("trust proxy", process.env.VERCEL ? 1 : false);

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://unpkg.com"],
        scriptSrcAttr: ["'self'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://unpkg.com",
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://unpkg.com",
          "data:",
        ],
        imgSrc: [
          "'self'",
          "data:",
          "https://unpkg.com",
          "https://tile.openstreetmap.org",
          "https://*.tile.openstreetmap.org",
        ],
        connectSrc: [
          "'self'",
          "https://nominatim.openstreetmap.org",
          "https://overpass-api.de",
          "https://tile.openstreetmap.org",
          "https://*.tile.openstreetmap.org",
          "https://unpkg.com",
        ],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
  }),
);

// Logging
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// Rate limiting
const limiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 120 });
app.use(limiter);

app.use(cors());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());

const { attachUser } = require("./middleware/authMiddleware");
app.use(attachUser);

// Data sanitization
app.use(mongoSanitize());
app.use(xss());

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.use("/", indexRoutes);
app.use("/cafes", cafeRoutes);
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/reviews", reviewRoutes);
app.use("/api/geo", geoRoutes);

// 404
app.use((req, res, next) => {
  res.status(404).render("errors/404");
});

// Global error handler
app.use(errorHandler);

module.exports = app;
