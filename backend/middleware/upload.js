// backend/middleware/upload.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Memory storage for processing before cloud upload
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req, file, cb) => {
  // Check file type
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

// Base multer configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB default
    files: 5,
  },
});

// Specific upload configurations
const uploadSingle = (fieldName, maxSize = 5 * 1024 * 1024) => {
  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: maxSize,
      files: 1,
    },
  }).single(fieldName);
};

const uploadMultiple = (fieldName, maxCount = 5, maxSize = 5 * 1024 * 1024) => {
  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: maxSize,
      files: maxCount,
    },
  }).array(fieldName, maxCount);
};

const uploadFields = (fields, maxSize = 5 * 1024 * 1024) => {
  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: maxSize,
      files: 10,
    },
  }).fields(fields);
};

// File validation middleware
const validateFile = (req, res, next) => {
  if (!req.file && !req.files) {
    return res.status(400).json({
      success: false,
      message: "No file uploaded",
    });
  }

  const files = req.files || [req.file];

  for (const file of files) {
    // Check file size
    if (file.size > 5 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: "File size cannot exceed 5MB",
      });
    }

    // Check file type
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: "Only JPEG, PNG, WebP, and GIF images are allowed",
      });
    }

    // Check file dimensions (if needed)
    // This would require additional image processing library
  }

  next();
};

// Image processing middleware
const processImage = async (req, res, next) => {
  try {
    if (!req.file && !req.files) {
      return next();
    }

    const files = req.files || [req.file];

    for (const file of files) {
      // Add timestamp to filename
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const extension = path.extname(file.originalname);
      const baseName = path.basename(file.originalname, extension);

      file.processedName = `${baseName}_${timestamp}_${random}${extension}`;

      // Add metadata
      file.uploadedAt = new Date();
      file.uploadedBy = req.user?.id;
    }

    next();
  } catch (error) {
    console.error("Image processing error:", error);
    res.status(500).json({
      success: false,
      message: "Error processing image",
    });
  }
};

// Cleanup temp files middleware
const cleanupFiles = (req, res, next) => {
  const cleanup = () => {
    if (req.files) {
      req.files.forEach((file) => {
        if (file.path && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    } else if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  };

  // Cleanup on response finish
  res.on("finish", cleanup);
  res.on("close", cleanup);
  res.on("error", cleanup);

  next();
};

// Handle multer errors
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case "LIMIT_FILE_SIZE":
        return res.status(400).json({
          success: false,
          message: "File size too large. Maximum size is 5MB",
        });
      case "LIMIT_FILE_COUNT":
        return res.status(400).json({
          success: false,
          message: "Too many files. Maximum allowed is 5",
        });
      case "LIMIT_UNEXPECTED_FILE":
        return res.status(400).json({
          success: false,
          message: "Unexpected file field",
        });
      default:
        return res.status(400).json({
          success: false,
          message: `Upload error: ${error.message}`,
        });
    }
  }

  if (error.message === "Only image files are allowed") {
    return res.status(400).json({
      success: false,
      message: "Only image files are allowed",
    });
  }

  next(error);
};

// Validate image dimensions
const validateImageDimensions = (
  minWidth = 100,
  minHeight = 100,
  maxWidth = 4000,
  maxHeight = 4000
) => {
  return async (req, res, next) => {
    try {
      if (!req.file && !req.files) {
        return next();
      }

      // This would require sharp or similar library for actual implementation
      // For now, we'll skip dimension validation
      next();
    } catch (error) {
      console.error("Image dimension validation error:", error);
      res.status(500).json({
        success: false,
        message: "Error validating image dimensions",
      });
    }
  };
};

// Create upload directory if it doesn't exist
const ensureUploadDir = (dirPath) => {
  return (req, res, next) => {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    next();
  };
};

// Rate limiting for uploads
const uploadRateLimit = (maxUploads = 10, windowMs = 15 * 60 * 1000) => {
  const uploadCounts = new Map();

  return (req, res, next) => {
    const clientId = req.ip + (req.user?.id || "anonymous");
    const now = Date.now();

    // Clean old entries
    for (const [key, data] of uploadCounts.entries()) {
      if (now - data.firstUpload > windowMs) {
        uploadCounts.delete(key);
      }
    }

    // Check current upload count
    const userData = uploadCounts.get(clientId);
    if (userData) {
      if (userData.count >= maxUploads) {
        return res.status(429).json({
          success: false,
          message: "Too many uploads. Please try again later.",
        });
      }
      userData.count++;
    } else {
      uploadCounts.set(clientId, {
        count: 1,
        firstUpload: now,
      });
    }

    next();
  };
};

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  uploadFields,
  validateFile,
  processImage,
  cleanupFiles,
  handleMulterError,
  validateImageDimensions,
  ensureUploadDir,
  uploadRateLimit,
};
