// backend/routes/analyticsRoutes.js
const express = require("express");
const {
  getDashboardOverview,
  getMealAnalytics,
  getMenuItemAnalytics,
  getEngagementAnalytics,
  exportAnalytics,
} = require("../controllers/analytics");
const {
  authenticate,
  authorize,
  checkFacilityAccess,
} = require("../middleware/auth");
const {
  validateRatingQuery,
  sanitizeInput,
} = require("../middleware/validation");

const router = express.Router();

// Apply sanitization to all routes
router.use(sanitizeInput);

// Placeholder routes
router.get("/", (req, res) => {
  res.json({ success: true, message: "Analytics API working" });
});

// Protected routes for mess admins only
router.use(authenticate);
router.use(authorize("mess_admin"));
router.use(checkFacilityAccess);

// Analytics endpoints
router.get("/dashboard", validateRatingQuery, getDashboardOverview);
router.get("/meals", validateRatingQuery, getMealAnalytics);
router.get("/menu-items", validateRatingQuery, getMenuItemAnalytics);
router.get("/engagement", validateRatingQuery, getEngagementAnalytics);
router.get("/export", validateRatingQuery, exportAnalytics);

module.exports = router;
