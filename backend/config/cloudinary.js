// backend/config/cloudinary.js
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage configuration for menu item images
const menuItemStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "messmeter/menu-items",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [
      { width: 800, height: 600, crop: "fill", quality: "auto" },
      { fetch_format: "auto" },
    ],
    public_id: (req, file) => {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      return `menu_item_${timestamp}_${random}`;
    },
  },
});

// Storage configuration for profile photos
const profileStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "messmeter/profiles",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [
      {
        width: 400,
        height: 400,
        crop: "fill",
        quality: "auto",
        gravity: "face",
      },
      { fetch_format: "auto" },
    ],
    public_id: (req, file) => {
      const userId = req.user?.id || "anonymous";
      const timestamp = Date.now();
      return `profile_${userId}_${timestamp}`;
    },
  },
});

// Storage configuration for rating photos
const ratingStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "messmeter/ratings",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [
      { width: 600, height: 400, crop: "fill", quality: "auto" },
      { fetch_format: "auto" },
    ],
    public_id: (req, file) => {
      const userId = req.user?.id || "anonymous";
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 6);
      return `rating_${userId}_${timestamp}_${random}`;
    },
  },
});

// Multer configurations
const uploadMenuItemImage = multer({
  storage: menuItemStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 5,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

const uploadProfilePhoto = multer({
  storage: profileStorage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

const uploadRatingPhotos = multer({
  storage: ratingStorage,
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB per file
    files: 3, // Max 3 photos per rating
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

// Helper function to delete image from Cloudinary
const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error("Error deleting image from Cloudinary:", error);
    throw error;
  }
};

// Helper function to get optimized image URL
const getOptimizedImageUrl = (publicId, options = {}) => {
  const {
    width = "auto",
    height = "auto",
    crop = "fill",
    quality = "auto",
    format = "auto",
  } = options;

  return cloudinary.url(publicId, {
    width,
    height,
    crop,
    quality,
    fetch_format: format,
  });
};

// Helper function to upload base64 image
const uploadBase64Image = async (base64String, folder, publicId) => {
  try {
    const result = await cloudinary.uploader.upload(base64String, {
      folder: `messmeter/${folder}`,
      public_id: publicId,
      transformation: [
        { width: 600, height: 400, crop: "fill", quality: "auto" },
        { fetch_format: "auto" },
      ],
    });
    return result;
  } catch (error) {
    console.error("Error uploading base64 image:", error);
    throw error;
  }
};

module.exports = {
  cloudinary,
  uploadMenuItemImage,
  uploadProfilePhoto,
  uploadRatingPhotos,
  deleteImage,
  getOptimizedImageUrl,
  uploadBase64Image,
};
