// backend/routes/ratingRoutes.js
const express = require("express");
const {
  submitRating,
  getMenuItemRatings,
  getMyRatingHistory,
  voteOnRating,
  updateRating,
  deleteRating,
  getFacilityStats,
  getRecentFeedback
} = require("../controllers/rating");
const {
  authenticate,
  authorize,
  optionalAuth,
  checkStudentAccess,
  checkFacilityAccess,
} = require("../middleware/auth");
const {
  validateRating,
  validateVote,
  validateMongoId,
  validatePaginationQuery,
  validateRatingQuery,
  sanitizeInput,
} = require("../middleware/validation");
const { validateMealTime } = require("../middleware/timeRestriction");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({ success: true, message: "Ratings API working" });
});

// Apply sanitization to all routes
router.use(sanitizeInput);

// Public routes (with optional auth)
router.get(
  "/item/:menuItemId",
  validateMongoId("menuItemId"),
  validatePaginationQuery,
  validateRatingQuery,
  optionalAuth,
  getMenuItemRatings
);

// Add this route BEFORE the protected routes section:
router.get(
  "/recent",
  optionalAuth,
  validatePaginationQuery,
  validateRatingQuery,
  getRecentFeedback
);

// Protected routes for students
router.use(authenticate);

// Student rating submission with time restriction
router.post(
  "/",
  authorize("student"),
  validateMealTime, // Add time restriction middleware here
  validateRating,
  submitRating
);

// Student rating management
router.get(
  "/my-history",
  authorize("student"),
  validatePaginationQuery,
  validateRatingQuery,
  getMyRatingHistory
);

router.put(
  "/:ratingId",
  authorize("student"),
  validateMongoId("ratingId"),
  checkStudentAccess,
  updateRating
);

router.delete(
  "/:ratingId",
  authorize("student"),
  validateMongoId("ratingId"),
  checkStudentAccess,
  deleteRating
);

// Rating interaction (voting)
router.post(
  "/:ratingId/vote",
  authorize("student"),
  validateMongoId("ratingId"),
  validateVote,
  voteOnRating
);

// Mess admin analytics
router.get(
  "/stats/facility",
  authorize("mess_admin"),
  checkFacilityAccess,
  validateRatingQuery,
  getFacilityStats
);

module.exports = router;
