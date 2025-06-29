// backend/middleware/validation.js
const { body, param, query, validationResult } = require("express-validator");

// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((error) => ({
        field: error.path,
        message: error.msg,
        value: error.value,
      })),
    });
  }
  next();
};

// Auth validation rules
const validateRegister = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
  body("name")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),
  body("phone")
    .optional()
    .matches(/^[0-9]{10}$/)
    .withMessage("Phone number must be exactly 10 digits"),
  body("role")
    .isIn(["student", "mess_admin"])
    .withMessage("Role must be either student or mess_admin"),

  // Student-specific validations
  body("selectedFacilityId")
    .if(body("role").equals("student"))
    .notEmpty()
    .withMessage("Facility selection is required for students"),
  body("selectedMessId")
    .if(body("role").equals("student"))
    .notEmpty()
    .withMessage("Mess selection is required for students"),
  body("course")
    .if(body("role").equals("student"))
    .optional()
    .isLength({ max: 100 })
    .withMessage("Course name cannot exceed 100 characters"),
  body("year")
    .if(body("role").equals("student"))
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage("Year must be between 1 and 5"),

  // Mess admin specific validations
  body("adminFacilityId")
    .if(
      (value, { req }) =>
        req.body.role === "mess_admin" && !req.body.facilityName
    )
    .notEmpty()
    .withMessage("Facility selection is required for mess admin"),
  body("adminMessId")
    .if(
      (value, { req }) =>
        req.body.role === "mess_admin" && !req.body.facilityName
    )
    .notEmpty()
    .withMessage("Mess selection is required for mess admin"),
  body("facilityName")
    .if(
      (value, { req }) =>
        req.body.role === "mess_admin" && req.body.facilityName
    )
    .notEmpty()
    .withMessage("Facility name is required when creating new facility"),
  body("facilityType")
    .if(
      (value, { req }) =>
        req.body.role === "mess_admin" && req.body.facilityName
    )
    .isIn(["college", "hostel"])
    .withMessage("Facility type must be either college or hostel"),
  body("messName")
    .if(
      (value, { req }) =>
        req.body.role === "mess_admin" && req.body.facilityName
    )
    .notEmpty()
    .withMessage("Mess name is required when creating new facility"),

  handleValidationErrors,
];

const validateLogin = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("password").notEmpty().withMessage("Password is required"),
  handleValidationErrors,
];

const validatePasswordUpdate = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),
  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("New password must be at least 6 characters long"),
  handleValidationErrors,
];

// Menu item validation rules
const validateMenuItem = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Menu item name must be between 2 and 100 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),
  body("category")
    .isIn([
      "starter",
      "main_course",
      "dessert",
      "beverage",
      "snack",
      "bread",
      "rice",
      "dal",
      "vegetable",
      "pickle",
      "salad",
    ])
    .withMessage("Invalid category"),
  body("mealType")
    .isIn(["breakfast", "lunch", "dinner", "snack"])
    .withMessage("Invalid meal type"),
  body("cuisineType")
    .optional()
    .isIn([
      "indian",
      "chinese",
      "continental",
      "south_indian",
      "north_indian",
      "italian",
      "mexican",
      "other",
    ])
    .withMessage("Invalid cuisine type"),
  body("isVegetarian")
    .optional()
    .isBoolean()
    .withMessage("isVegetarian must be a boolean"),
  body("isVegan")
    .optional()
    .isBoolean()
    .withMessage("isVegan must be a boolean"),
  body("isJain").optional().isBoolean().withMessage("isJain must be a boolean"),
  body("allergens")
    .optional()
    .isArray()
    .withMessage("Allergens must be an array"),
  body("allergens.*")
    .optional()
    .isIn([
      "nuts",
      "dairy",
      "gluten",
      "soy",
      "eggs",
      "seafood",
      "sesame",
      "mustard",
    ])
    .withMessage("Invalid allergen"),
  body("spiceLevel")
    .optional()
    .isIn(["mild", "medium", "spicy", "very_spicy"])
    .withMessage("Invalid spice level"),
  body("preparationTime")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Preparation time must be a positive integer"),
  body("cost")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Cost must be a positive number"),
  handleValidationErrors,
];

// Daily menu validation rules
const validateDailyMenu = [
  body("date").isISO8601().toDate().withMessage("Please provide a valid date"),
  body("mealType")
    .isIn(["breakfast", "lunch", "dinner", "snack"])
    .withMessage("Invalid meal type"),
  body("menuItems")
    .optional()
    .isArray()
    .withMessage("Menu items must be an array"),
  body("menuItems.*.item").isMongoId().withMessage("Invalid menu item ID"),
  body("menuItems.*.estimatedQuantity")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Estimated quantity must be a positive integer"),
  body("menuItems.*.costPerServing")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Cost per serving must be a positive number"),
  body("servingTime.start")
    .isISO8601()
    .toDate()
    .withMessage("Please provide a valid serving start time"),
  body("servingTime.end")
    .isISO8601()
    .toDate()
    .withMessage("Please provide a valid serving end time")
    .custom((endTime, { req }) => {
      if (new Date(endTime) <= new Date(req.body.servingTime.start)) {
        throw new Error("Serving end time must be after start time");
      }
      return true;
    }),
  body("expectedStudents")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Expected students must be a non-negative integer"),
  body("specialOccasion.name")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Special occasion name cannot exceed 100 characters"),
  body("specialOccasion.description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Special occasion description cannot exceed 500 characters"),
  handleValidationErrors,
];

// Rating validation rules
const validateRating = [
  body("menuItemId").isMongoId().withMessage("Invalid menu item ID"),
  body("dailyMenuId").isMongoId().withMessage("Invalid daily menu ID"),
  body("overallRating")
    .isInt({ min: 1, max: 5 })
    .withMessage("Overall rating must be between 1 and 5"),
  body("categoryRatings.taste")
    .isInt({ min: 1, max: 5 })
    .withMessage("Taste rating must be between 1 and 5"),
  body("categoryRatings.quantity")
    .isInt({ min: 1, max: 5 })
    .withMessage("Quantity rating must be between 1 and 5"),
  body("categoryRatings.freshness")
    .isInt({ min: 1, max: 5 })
    .withMessage("Freshness rating must be between 1 and 5"),
  body("categoryRatings.value")
    .isInt({ min: 1, max: 5 })
    .withMessage("Value rating must be between 1 and 5"),
  body("review.text")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Review text cannot exceed 500 characters"),
  body("review.isAnonymous")
    .optional()
    .isBoolean()
    .withMessage("isAnonymous must be a boolean"),
  body("photos").optional().isArray().withMessage("Photos must be an array"),
  body("photos.*.url").optional().isURL().withMessage("Invalid photo URL"),
  body("photos.*.caption")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Photo caption cannot exceed 200 characters"),
  body("emojiReaction")
    .optional()
    .isIn(["😍", "😊", "😐", "😞", "🤢", "👍", "👎", "🔥", "❄️", "🌶️"])
    .withMessage("Invalid emoji reaction"),
  body("mealType")
    .isIn(["breakfast", "lunch", "dinner", "snack"])
    .withMessage("Invalid meal type"),
  body("mealDate")
    .isISO8601()
    .toDate()
    .withMessage("Please provide a valid meal date"),
  body("ratingMethod")
    .optional()
    .isIn(["swipe", "tap", "detailed_form"])
    .withMessage("Invalid rating method"),
  body("timeSpent")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Time spent must be a non-negative integer"),
  body("deviceInfo")
    .optional()
    .isIn(["mobile", "tablet", "desktop"])
    .withMessage("Invalid device info"),
  body("facilityId")
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage("Facility ID cannot be empty"),
  body("messType")
    .optional()
    .isIn(["college_mess", "hostel_mess"])
    .withMessage("Invalid mess type"),
  handleValidationErrors,
];

// Parameter validation rules
const validateMongoId = (paramName = "id") => [
  param(paramName).isMongoId().withMessage(`Invalid ${paramName}`),
  handleValidationErrors,
];

const validateItemStatus = [
  body("status")
    .isIn(["not_started", "in_progress", "ready", "served_out"])
    .withMessage("Invalid preparation status"),
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Notes cannot exceed 200 characters"),
  handleValidationErrors,
];

const validateVote = [
  body("voteType")
    .isIn(["up", "down"])
    .withMessage('Vote type must be either "up" or "down"'),
  handleValidationErrors,
];

// Query validation rules
const validatePaginationQuery = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  handleValidationErrors,
];

const validateMenuQuery = [
  query("facilityId")
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage("Facility ID cannot be empty"),
  query("messType")
    .optional()
    .isIn(["college_mess", "hostel_mess"])
    .withMessage("Invalid mess type"),
  query("mealType")
    .optional()
    .isIn(["breakfast", "lunch", "dinner", "snack"])
    .withMessage("Invalid meal type"),
  query("category")
    .optional()
    .isIn([
      "starter",
      "main_course",
      "dessert",
      "beverage",
      "snack",
      "bread",
      "rice",
      "dal",
      "vegetable",
      "pickle",
      "salad",
    ])
    .withMessage("Invalid category"),
  query("search")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Search term must be between 1 and 100 characters"),
  query("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
  handleValidationErrors,
];

const validateRatingQuery = [
  query("sortBy")
    .optional()
    .isIn(["newest", "oldest", "helpful", "rating_high", "rating_low"])
    .withMessage("Invalid sort option"),
  query("mealDate")
    .optional()
    .isISO8601()
    .toDate()
    .withMessage("Invalid meal date format"),
  query("facilityId")
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage("Facility ID cannot be empty"),
  query("dateRange")
    .optional()
    .custom((value) => {
      const dates = value.split(",");
      if (dates.length !== 2) {
        throw new Error(
          "Date range must contain exactly 2 dates separated by comma"
        );
      }
      dates.forEach((date) => {
        if (!Date.parse(date)) {
          throw new Error("Invalid date format in date range");
        }
      });
      return true;
    }),
  handleValidationErrors,
];

const validateDailyMenuQuery = [
  query("date")
    .optional()
    .isISO8601()
    .toDate()
    .withMessage("Invalid date format"),
  query("mealType")
    .optional()
    .isIn(["breakfast", "lunch", "dinner", "snack"])
    .withMessage("Invalid meal type"),
  query("status")
    .optional()
    .isIn(["draft", "published", "active", "completed", "cancelled"])
    .withMessage("Invalid status"),
  handleValidationErrors,
];

// Update validation rules
const validateUpdateDetails = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),
  body("phone")
    .optional()
    .matches(/^[0-9]{10}$/)
    .withMessage("Phone number must be exactly 10 digits"),
  body("course")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Course name cannot exceed 100 characters"),
  body("year")
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage("Year must be between 1 and 5"),
  handleValidationErrors,
];

const validateForgotPassword = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  handleValidationErrors,
];

const validateResetPassword = [
  param("resettoken")
    .isLength({ min: 1 })
    .withMessage("Reset token is required"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
  handleValidationErrors,
];

// Add menu item to daily menu validation
const validateAddItemToDailyMenu = [
  body("itemId").isMongoId().withMessage("Invalid menu item ID"),
  body("servingSize")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Serving size cannot exceed 50 characters"),
  body("estimatedQuantity")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Estimated quantity must be a positive integer"),
  body("costPerServing")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Cost per serving must be a positive number"),
  body("specialNotes")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Special notes cannot exceed 200 characters"),
  handleValidationErrors,
];

// File upload validation
const validateFileUpload = (req, res, next) => {
  if (!req.file && !req.files) {
    return res.status(400).json({
      success: false,
      message: "No file uploaded",
    });
  }

  const file = req.file || req.files[0];

  // Check file size (5MB limit)
  if (file.size > 5 * 1024 * 1024) {
    return res.status(400).json({
      success: false,
      message: "File size cannot exceed 5MB",
    });
  }

  // Check file type
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.mimetype)) {
    return res.status(400).json({
      success: false,
      message: "Only JPEG, PNG, and WebP images are allowed",
    });
  }

  next();
};

// Custom validation for date ranges
const validateDateRange = (startField, endField) => {
  return body(endField).custom((endDate, { req }) => {
    const startDate = req.body[startField];
    if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
      throw new Error(`${endField} must be after ${startField}`);
    }
    return true;
  });
};

// Sanitization helpers
const sanitizeInput = (req, res, next) => {
  // Remove any potential XSS attempts
  const sanitize = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === "string") {
        obj[key] = obj[key].replace(
          /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
          ""
        );
        obj[key] = obj[key].replace(/javascript:/gi, "");
        obj[key] = obj[key].replace(/on\w+\s*=/gi, "");
      } else if (typeof obj[key] === "object" && obj[key] !== null) {
        sanitize(obj[key]);
      }
    }
  };

  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  if (req.params) sanitize(req.params);

  next();
};

module.exports = {
  // Auth validations
  validateRegister,
  validateLogin,
  validatePasswordUpdate,
  validateUpdateDetails,
  validateForgotPassword,
  validateResetPassword,

  // Menu validations
  validateMenuItem,
  validateDailyMenu,
  validateAddItemToDailyMenu,
  validateItemStatus,

  // Rating validations
  validateRating,
  validateVote,

  // Parameter validations
  validateMongoId,

  // Query validations
  validatePaginationQuery,
  validateMenuQuery,
  validateRatingQuery,
  validateDailyMenuQuery,

  // File upload validation
  validateFileUpload,

  // Utility validations
  validateDateRange,
  sanitizeInput,
  handleValidationErrors,
};
