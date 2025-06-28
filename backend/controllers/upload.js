// backend/controllers/upload.js
const {
  deleteImage,
  uploadBase64Image,
  getOptimizedImageUrl,
  cloudinary, 
} = require("../config/cloudinary");
const User = require("../models/User");
const MenuItem = require("../models/MenuItem");

// @desc    Upload menu item images
// @route   POST /api/upload/menu-item/:itemId
// @access  Private (Mess Admin)
const uploadMenuItemImages = async (req, res) => {
  try {
    const { itemId } = req.params;
    const facilityId = req.user.facilityId;
    const messType = req.user.messType;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No images uploaded",
      });
    }

    // Verify menu item exists and belongs to user's facility
    const menuItem = await MenuItem.findOne({
      _id: itemId,
      facilityId,
      messType,
    });

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
    }

    // Process uploaded images
    const uploadedImages = req.files.map((file) => ({
      url: file.path,
      public_id: file.filename,
      uploadedBy: req.user.id,
      uploadedAt: new Date(),
    }));

    // Add images to menu item
    menuItem.images.push(...uploadedImages);
    await menuItem.save();

    res.status(200).json({
      success: true,
      message: "Images uploaded successfully",
      data: {
        uploadedImages,
        totalImages: menuItem.images.length,
      },
    });
  } catch (error) {
    console.error("Upload menu item images error:", error);
    res.status(500).json({
      success: false,
      message: "Could not upload images",
    });
  }
};

// @desc    Upload profile photo
// @route   POST /api/upload/profile
// @access  Private
const uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image uploaded",
      });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Delete old profile photo if exists
    if (user.profilePhoto && user.profilePhoto.public_id) {
      try {
        await deleteImage(user.profilePhoto.public_id);
      } catch (deleteError) {
        console.error("Error deleting old profile photo:", deleteError);
      }
    }

    // Update user profile photo
    user.profilePhoto = {
      url: req.file.path,
      public_id: req.file.filename,
    };

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile photo uploaded successfully",
      data: {
        profilePhoto: user.profilePhoto,
      },
    });
  } catch (error) {
    console.error("Upload profile photo error:", error);
    res.status(500).json({
      success: false,
      message: "Could not upload profile photo",
    });
  }
};

// @desc    Upload rating photos
// @route   POST /api/upload/rating
// @access  Private (Student)
const uploadRatingPhotos = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No images uploaded",
      });
    }

    const uploadedPhotos = req.files.map((file, index) => ({
      url: file.path,
      public_id: file.filename,
      caption: req.body[`caption_${index}`] || "",
      uploadedAt: new Date(),
    }));

    res.status(200).json({
      success: true,
      message: "Rating photos uploaded successfully",
      data: {
        photos: uploadedPhotos,
      },
    });
  } catch (error) {
    console.error("Upload rating photos error:", error);
    res.status(500).json({
      success: false,
      message: "Could not upload rating photos",
    });
  }
};

// @desc    Upload base64 image
// @route   POST /api/upload/base64
// @access  Private
const uploadBase64 = async (req, res) => {
  try {
    const { image, folder, filename } = req.body;

    if (!image || !folder) {
      return res.status(400).json({
        success: false,
        message: "Image data and folder are required",
      });
    }

    // Validate base64 format
    if (!image.startsWith("data:image/")) {
      return res.status(400).json({
        success: false,
        message: "Invalid image format",
      });
    }

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const publicId = filename || `upload_${timestamp}_${random}`;

    const result = await uploadBase64Image(image, folder, publicId);

    res.status(200).json({
      success: true,
      message: "Image uploaded successfully",
      data: {
        url: result.secure_url,
        public_id: result.public_id,
        width: result.width,
        height: result.height,
      },
    });
  } catch (error) {
    console.error("Upload base64 error:", error);
    res.status(500).json({
      success: false,
      message: "Could not upload image",
    });
  }
};

// @desc    Delete image
// @route   DELETE /api/upload/:publicId
// @access  Private
const deleteUploadedImage = async (req, res) => {
  try {
    const { publicId } = req.params;
    const { itemId, type } = req.query;

    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: "Public ID is required",
      });
    }

    // Delete from Cloudinary
    const result = await deleteImage(publicId);

    if (result.result !== "ok") {
      return res.status(400).json({
        success: false,
        message: "Failed to delete image from cloud storage",
      });
    }

    // Remove from database if type and itemId provided
    if (type === "menu-item" && itemId) {
      const menuItem = await MenuItem.findOne({
        _id: itemId,
        facilityId: req.user.facilityId,
        messType: req.user.messType,
      });

      if (menuItem) {
        menuItem.images = menuItem.images.filter(
          (img) => img.public_id !== publicId
        );
        await menuItem.save();
      }
    } else if (type === "profile") {
      const user = await User.findById(req.user.id);
      if (
        user &&
        user.profilePhoto &&
        user.profilePhoto.public_id === publicId
      ) {
        user.profilePhoto = undefined;
        await user.save();
      }
    }

    res.status(200).json({
      success: true,
      message: "Image deleted successfully",
    });
  } catch (error) {
    console.error("Delete image error:", error);
    res.status(500).json({
      success: false,
      message: "Could not delete image",
    });
  }
};

// @desc    Get optimized image URL
// @route   GET /api/upload/optimize/:publicId
// @access  Public
const getOptimizedImage = async (req, res) => {
  try {
    const { publicId } = req.params;
    const { width, height, crop, quality, format } = req.query;

    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: "Public ID is required",
      });
    }

    const optimizedUrl = getOptimizedImageUrl(publicId, {
      width: width || "auto",
      height: height || "auto",
      crop: crop || "fill",
      quality: quality || "auto",
      format: format || "auto",
    });

    res.status(200).json({
      success: true,
      data: {
        optimizedUrl,
        originalPublicId: publicId,
      },
    });
  } catch (error) {
    console.error("Get optimized image error:", error);
    res.status(500).json({
      success: false,
      message: "Could not generate optimized image URL",
    });
  }
};

// @desc    Get upload signature for client-side uploads
// @route   POST /api/upload/signature
// @access  Private
const getUploadSignature = async (req, res) => {
  try {
    const { folder, publicId } = req.body;
    const timestamp = Math.round(new Date().getTime() / 1000);

    const params = {
      timestamp,
      folder: `messmeter/${folder || "general"}`,
      ...(publicId && { public_id: publicId }),
    };

    const signature = cloudinary.utils.api_sign_request(
      params,
      process.env.CLOUDINARY_API_SECRET
    );

    res.status(200).json({
      success: true,
      data: {
        signature,
        timestamp,
        apiKey: process.env.CLOUDINARY_API_KEY,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        folder: params.folder,
      },
    });
  } catch (error) {
    console.error("Get upload signature error:", error);
    res.status(500).json({
      success: false,
      message: "Could not generate upload signature",
    });
  }
};

module.exports = {
  uploadMenuItemImages,
  uploadProfilePhoto,
  uploadRatingPhotos,
  uploadBase64,
  deleteUploadedImage,
  getOptimizedImage,
  getUploadSignature,
};
