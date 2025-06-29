// backend/middleware/errorHandler.js
const mongoose = require("mongoose");

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  console.error(err);

  // Mongoose bad ObjectId
  if (err.name === "CastError") {
    const message = "Invalid ID format";
    error = {
      statusCode: 400,
      message,
    };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    let message = "Duplicate field value entered";

    // Extract field name from error
    const field = Object.keys(err.keyValue)[0];
    if (field === "email") {
      message = "Email is already registered";
    } else if (field === "studentId") {
      message = "Student ID is already registered";
    } else if (field.includes("one_rating_per_meal_per_day")) {
      message = "You have already rated this meal today";
    } else if (field.includes("unique_daily_menu")) {
      message = "Daily menu already exists for this date and meal type";
    }

    error = {
      statusCode: 400,
      message,
    };
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const message = Object.values(err.errors)
      .map((val) => val.message)
      .join(", ");
    error = {
      statusCode: 400,
      message: `Validation Error: ${message}`,
    };
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    const message = "Invalid token";
    error = {
      statusCode: 401,
      message,
    };
  }

  if (err.name === "TokenExpiredError") {
    const message = "Token expired";
    error = {
      statusCode: 401,
      message,
    };
  }

  // Multer errors
  if (err.code === "LIMIT_FILE_SIZE") {
    const message = "File size too large";
    error = {
      statusCode: 400,
      message,
    };
  }

  if (err.code === "LIMIT_FILE_COUNT") {
    const message = "Too many files uploaded";
    error = {
      statusCode: 400,
      message,
    };
  }

  // MongoDB connection errors
  if (err.name === "MongooseServerSelectionError") {
    const message = "Database connection failed";
    error = {
      statusCode: 500,
      message,
    };
  }

  // Rate limiting error
  if (err.status === 429) {
    const message = "Too many requests, please try again later";
    error = {
      statusCode: 429,
      message,
    };
  }

  // Default to 500 server error
  const statusCode = error.statusCode || 500;
  const message = error.message || "Server Error";

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && {
      error: err,
      stack: err.stack,
    }),
  });
};

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
  console.log(`Unhandled Rejection: ${err.message}`);
  console.log("Shutting down server due to unhandled promise rejection");
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.log(`Uncaught Exception: ${err.message}`);
  console.log("Shutting down server due to uncaught exception");
  process.exit(1);
});

// 404 handler
const notFound = (req, res, next) => {
  const error = new Error(`Not found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

module.exports = {
  errorHandler,
  notFound,
};
