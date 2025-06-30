// backend/utils/validators.js
const validator = require("validator");
const mongoose = require("mongoose");

// Email validation
const validateEmail = (email) => {
  if (!email) return { isValid: false, message: "Email is required" };

  if (!validator.isEmail(email)) {
    return { isValid: false, message: "Please provide a valid email address" };
  }

  if (email.length > 254) {
    return { isValid: false, message: "Email address is too long" };
  }

  return { isValid: true };
};

// Password validation
const validatePassword = (password) => {
  if (!password) return { isValid: false, message: "Password is required" };

  if (password.length < 6) {
    return {
      isValid: false,
      message: "Password must be at least 6 characters long",
    };
  }

  if (password.length > 128) {
    return { isValid: false, message: "Password is too long" };
  }

  // Check for at least one uppercase, one lowercase, and one number
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    return {
      isValid: false,
      message:
        "Password must contain at least one uppercase letter, one lowercase letter, and one number",
    };
  }

  // Check for common weak passwords
  const commonPasswords = [
    "password",
    "123456",
    "password123",
    "admin",
    "qwerty",
  ];
  if (commonPasswords.includes(password.toLowerCase())) {
    return { isValid: false, message: "Password is too common" };
  }

  return { isValid: true };
};

// Phone number validation (Indian format)
const validatePhone = (phone) => {
  if (!phone) return { isValid: true }; // Optional field

  // Remove spaces and special characters
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, "");

  // Check Indian mobile number format
  if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
    return {
      isValid: false,
      message: "Please provide a valid 10-digit Indian mobile number",
    };
  }

  return { isValid: true, cleanValue: cleanPhone };
};

// Name validation
const validateName = (name) => {
  if (!name) return { isValid: false, message: "Name is required" };

  const trimmedName = name.trim();

  if (trimmedName.length < 2) {
    return {
      isValid: false,
      message: "Name must be at least 2 characters long",
    };
  }

  if (trimmedName.length > 50) {
    return { isValid: false, message: "Name cannot exceed 50 characters" };
  }

  // Allow letters, spaces, hyphens, and apostrophes
  if (!/^[a-zA-Z\s\-'\.]+$/.test(trimmedName)) {
    return {
      isValid: false,
      message:
        "Name can only contain letters, spaces, hyphens, and apostrophes",
    };
  }

  return { isValid: true, cleanValue: trimmedName };
};

// Student ID validation
const validateStudentId = (studentId) => {
  if (!studentId) return { isValid: false, message: "Student ID is required" };

  const trimmedId = studentId.trim();

  if (trimmedId.length < 3 || trimmedId.length > 20) {
    return {
      isValid: false,
      message: "Student ID must be between 3 and 20 characters",
    };
  }

  // Allow alphanumeric characters, hyphens, and underscores
  if (!/^[a-zA-Z0-9\-_]+$/.test(trimmedId)) {
    return {
      isValid: false,
      message:
        "Student ID can only contain letters, numbers, hyphens, and underscores",
    };
  }

  return { isValid: true, cleanValue: trimmedId.toUpperCase() };
};

// MongoDB ObjectId validation
const validateObjectId = (id) => {
  if (!id) return { isValid: false, message: "ID is required" };

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return { isValid: false, message: "Invalid ID format" };
  }

  return { isValid: true };
};

// Rating validation (1-5 scale)
const validateRating = (rating) => {
  if (rating === undefined || rating === null) {
    return { isValid: false, message: "Rating is required" };
  }

  const numRating = Number(rating);

  if (isNaN(numRating)) {
    return { isValid: false, message: "Rating must be a number" };
  }

  if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
    return {
      isValid: false,
      message: "Rating must be an integer between 1 and 5",
    };
  }

  return { isValid: true, cleanValue: numRating };
};

// Date validation
const validateDate = (date) => {
  if (!date) return { isValid: false, message: "Date is required" };

  const dateObj = new Date(date);

  if (isNaN(dateObj.getTime())) {
    return { isValid: false, message: "Invalid date format" };
  }

  // Check if date is not too far in the past or future
  const now = new Date();
  const oneYearAgo = new Date(
    now.getFullYear() - 1,
    now.getMonth(),
    now.getDate()
  );
  const oneYearFromNow = new Date(
    now.getFullYear() + 1,
    now.getMonth(),
    now.getDate()
  );

  if (dateObj < oneYearAgo || dateObj > oneYearFromNow) {
    return {
      isValid: false,
      message: "Date must be within one year from today",
    };
  }

  return { isValid: true, cleanValue: dateObj };
};

// URL validation
const validateUrl = (url) => {
  if (!url) return { isValid: true }; // Optional field

  if (!validator.isURL(url, { protocols: ["http", "https"] })) {
    return { isValid: false, message: "Please provide a valid URL" };
  }

  return { isValid: true };
};

// File validation
const validateFile = (file, options = {}) => {
  const {
    maxSize = 5 * 1024 * 1024, // 5MB default
    allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    required = true,
  } = options;

  if (!file) {
    return {
      isValid: !required,
      message: required ? "File is required" : undefined,
    };
  }

  if (file.size > maxSize) {
    return {
      isValid: false,
      message: `File size cannot exceed ${Math.round(
        maxSize / (1024 * 1024)
      )}MB`,
    };
  }

  if (!allowedTypes.includes(file.mimetype)) {
    return {
      isValid: false,
      message: `File type not allowed. Allowed types: ${allowedTypes.join(
        ", "
      )}`,
    };
  }

  return { isValid: true };
};

// Text content validation
const validateTextContent = (text, options = {}) => {
  const {
    minLength = 0,
    maxLength = 500,
    required = false,
    allowEmpty = true,
  } = options;

  if (!text || text.trim() === "") {
    if (required) {
      return { isValid: false, message: "Text content is required" };
    }
    if (!allowEmpty) {
      return { isValid: false, message: "Text content cannot be empty" };
    }
    return { isValid: true };
  }

  const trimmedText = text.trim();

  if (trimmedText.length < minLength) {
    return {
      isValid: false,
      message: `Text must be at least ${minLength} characters long`,
    };
  }

  if (trimmedText.length > maxLength) {
    return {
      isValid: false,
      message: `Text cannot exceed ${maxLength} characters`,
    };
  }

  // Check for potentially harmful content
  const suspiciousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(trimmedText)) {
      return {
        isValid: false,
        message: "Text contains potentially harmful content",
      };
    }
  }

  return { isValid: true, cleanValue: trimmedText };
};

// Array validation
const validateArray = (arr, options = {}) => {
  const {
    minLength = 0,
    maxLength = 100,
    required = false,
    itemValidator = null,
  } = options;

  if (!Array.isArray(arr)) {
    if (required) {
      return { isValid: false, message: "Array is required" };
    }
    return { isValid: true };
  }

  if (arr.length < minLength) {
    return {
      isValid: false,
      message: `Array must have at least ${minLength} items`,
    };
  }

  if (arr.length > maxLength) {
    return {
      isValid: false,
      message: `Array cannot have more than ${maxLength} items`,
    };
  }

  // Validate each item if validator provided
  if (itemValidator && typeof itemValidator === "function") {
    for (let i = 0; i < arr.length; i++) {
      const itemResult = itemValidator(arr[i], i);
      if (!itemResult.isValid) {
        return {
          isValid: false,
          message: `Item at index ${i}: ${itemResult.message}`,
        };
      }
    }
  }

  return { isValid: true };
};

// Sanitize input to prevent XSS
const sanitizeInput = (input) => {
  if (typeof input !== "string") return input;

  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim();
};

// Validate enum values
const validateEnum = (value, allowedValues, fieldName = "Value") => {
  if (!value) return { isValid: false, message: `${fieldName} is required` };

  if (!allowedValues.includes(value)) {
    return {
      isValid: false,
      message: `${fieldName} must be one of: ${allowedValues.join(", ")}`,
    };
  }

  return { isValid: true };
};

// Validate pagination parameters
const validatePagination = (page, limit) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 20;

  if (pageNum < 1) {
    return { isValid: false, message: "Page must be a positive integer" };
  }

  if (limitNum < 1 || limitNum > 100) {
    return { isValid: false, message: "Limit must be between 1 and 100" };
  }

  return { isValid: true, cleanValues: { page: pageNum, limit: limitNum } };
};

// Validate coordinates
const validateCoordinates = (lat, lng) => {
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);

  if (isNaN(latitude) || isNaN(longitude)) {
    return { isValid: false, message: "Invalid coordinates format" };
  }

  if (latitude < -90 || latitude > 90) {
    return { isValid: false, message: "Latitude must be between -90 and 90" };
  }

  if (longitude < -180 || longitude > 180) {
    return {
      isValid: false,
      message: "Longitude must be between -180 and 180",
    };
  }

  return { isValid: true, cleanValues: { latitude, longitude } };
};

module.exports = {
  validateEmail,
  validatePassword,
  validatePhone,
  validateName,
  validateStudentId,
  validateObjectId,
  validateRating,
  validateDate,
  validateUrl,
  validateFile,
  validateTextContent,
  validateArray,
  validateEnum,
  validatePagination,
  validateCoordinates,
  sanitizeInput,
};
