const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { attachUser, requireAuth } = require("../middleware/authMiddleware");

router.use(attachUser);

router.get("/dashboard", requireAuth, userController.dashboard);
router.get("/profile", requireAuth, userController.getProfile);

module.exports = router;
