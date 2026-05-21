const express = require("express");
const router = express.Router();
const cafeController = require("../controllers/cafeController");
const { attachUser, requireAuth } = require("../middleware/authMiddleware");
const {
  upload,
  uploadToCloud,
  uploadMultipleToCloud,
} = require("../utils/upload");
const { body, query } = require("express-validator");

router.use(attachUser);

router.get("/details/:placeId", cafeController.details);

router.get(
  "/nearby",
  [query("lat").isFloat(), query("lng").isFloat()],
  cafeController.search,
);

router.get(
  "/text",
  [query("q").isString().trim().notEmpty()],
  cafeController.search,
);

// Upload a single image for cafe (owner/admin)
router.post(
  "/:id/images",
  requireAuth,
  upload.single("image"),
  uploadToCloud,
  cafeController.addImage,
);

// Remove image by public_id
router.delete("/:id/images", requireAuth, cafeController.removeImage);

module.exports = router;
