// backend/server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const path = require("path");
require("dotenv").config();

// Import database connection
const connectDB = require("./config/database");

// Import middleware
const { errorHandler, notFound } = require("./middleware/errorHandler");
const { sanitizeInput } = require("./middleware/validation");

// Import routes
const authRoutes = require("./routes/authRoutes");
const menuRoutes = require("./routes/menuRoutes");
const ratingRoutes = require("./routes/ratingRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "https:"],
        fontSrc: ["'self'", "https:", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'", "https:"],
        frameSrc: ["'none'"],
      },
    },
  })
);

// Trust proxy for accurate IP addresses
app.set("trust proxy", 1);

// CORS Configuration
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.FRONTEND_URL?.split(",") || ["https://yourdomain.com"]
        : [
            "http://localhost:3000",
            "http://localhost:5173",
            "http://localhost:3001",
          ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
    exposedHeaders: ["set-cookie"],
  })
);

app.use("/api/facilities", require("./routes/facilityRoutes"));

// Cookie parser middleware
app.use(cookieParser());

// Body Parser Middleware
app.use(
  express.json({
    limit: "10mb",
    verify: (req, res, buf) => {
      try {
        JSON.parse(buf);
      } catch (e) {
        res.status(400).json({
          success: false,
          message: "Invalid JSON format",
        });
        throw new Error("Invalid JSON");
      }
    },
  })
);

app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static files for uploads (if using local storage)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Global input sanitization
app.use(sanitizeInput);

// Health Check Route
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "MessMeter Backend API is running!",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: "1.0.0",
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    uptime: process.uptime(),
  });
});

// API Status Route
app.get("/api", (req, res) => {
  res.status(200).json({
    success: true,
    message: "MessMeter API v1.0.0",
    endpoints: {
      auth: "/api/auth",
      menu: "/api/menu",
      ratings: "/api/ratings",
      upload: "/api/upload",
      analytics: "/api/analytics",
    },
    documentation: "/api/docs",
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/ratings", ratingRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/analytics", analyticsRoutes);

// API Documentation placeholder
app.get("/api/docs", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API Documentation",
    version: "1.0.0",
    baseUrl: `${req.protocol}://${req.get("host")}/api`,
    endpoints: {
      authentication: {
        register: "POST /auth/register",
        login: "POST /auth/login",
        logout: "POST /auth/logout",
        me: "GET /auth/me",
        updateDetails: "PUT /auth/updatedetails",
        updatePassword: "PUT /auth/updatepassword",
        forgotPassword: "POST /auth/forgotpassword",
        resetPassword: "PUT /auth/resetpassword/:token",
        verifyEmail: "GET /auth/verify/:token",
      },
      menu: {
        todayMenu: "GET /menu/today",
        menuItems: "GET /menu/items (Admin)",
        createItem: "POST /menu/items (Admin)",
        updateItem: "PUT /menu/items/:id (Admin)",
        deleteItem: "DELETE /menu/items/:id (Admin)",
        dailyMenus: "GET /menu/daily (Admin)",
        createDailyMenu: "POST /menu/daily (Admin)",
        updateDailyMenu: "PUT /menu/daily/:id (Admin)",
        publishMenu: "PUT /menu/daily/:id/publish (Admin)",
      },
      ratings: {
        submitRating: "POST /ratings (Student)",
        getItemRatings: "GET /ratings/item/:menuItemId",
        myHistory: "GET /ratings/my-history (Student)",
        voteRating: "POST /ratings/:id/vote (Student)",
        updateRating: "PUT /ratings/:id (Student)",
        deleteRating: "DELETE /ratings/:id (Student)",
        facilityStats: "GET /ratings/stats/facility (Admin)",
      },
      uploads: {
        profilePhoto: "POST /upload/profile",
        menuItemImages: "POST /upload/menu-item/:id (Admin)",
        ratingPhotos: "POST /upload/rating (Student)",
        deleteImage: "DELETE /upload/:publicId",
      },
      analytics: {
        dashboard: "GET /analytics/dashboard (Admin)",
        mealAnalytics: "GET /analytics/meals (Admin)",
        menuItemAnalytics: "GET /analytics/menu-items (Admin)",
        engagement: "GET /analytics/engagement (Admin)",
        export: "GET /analytics/export (Admin)",
      },
    },
  });
});

// Serve React app in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../client/build")));

  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "../client/build", "index.html"));
  });
}

// 404 Handler for API routes
app.use("/api/*", notFound);

// Global Error Handler
app.use(errorHandler);

// Database connection events
mongoose.connection.on("connected", () => {
  console.log("✅ Mongoose connected to MongoDB");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ Mongoose connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("⚠️ Mongoose disconnected from MongoDB");
});

// Graceful Shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n👋 ${signal} received, shutting down gracefully...`);

  // Close server
  server.close(() => {
    console.log("🔴 HTTP server closed");

    // Close database connection
    mongoose.connection.close(false, () => {
      console.log("📦 Database connection closed");
      process.exit(0);
    });
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.log("⚠️ Forced shutdown");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("💥 Unhandled Rejection:", err);
  server.close(() => {
    process.exit(1);
  });
});

// Start Server
const startServer = async () => {
  try {
    // Connect to database
    await connectDB();

    // Start server
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
      console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
      console.log(`📚 API docs: http://localhost:${PORT}/api/docs`);
      console.log(`⏰ Started at: ${new Date().toISOString()}`);
    });

    // Set server timeout
    server.timeout = 30000; // 30 seconds
    server.keepAliveTimeout = 61000; // 61 seconds
    server.headersTimeout = 62000; // 62 seconds

    // Make server available for graceful shutdown
    global.server = server;
  } catch (error) {
    console.error("❌ Server startup failed:", error);
    process.exit(1);
  }
};

// Initialize server
startServer();

module.exports = app;
