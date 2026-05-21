const express = require("express");
const router = express.Router();
const reviewController = require("../controllers/reviewController");
const { attachUser, requireAuth } = require("../middleware/authMiddleware");
const { upload } = require("../utils/upload");
const { uploadMultipleToCloud } = require("../utils/upload");
const {
  createReviewValidator,
  editReviewValidator,
} = require("../validators/reviewValidator");

router.use(attachUser);

router.post(
  "/",
  requireAuth,
  upload.array("images", 4),
  uploadMultipleToCloud,
  createReviewValidator,
  reviewController.createReview,
);
router.put(
  "/:id",
  requireAuth,
  upload.array("images", 4),
  uploadMultipleToCloud,
  editReviewValidator,
  reviewController.editReview,
);
router.delete("/:id", requireAuth, reviewController.deleteReview);

module.exports = router;
