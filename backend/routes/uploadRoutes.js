// backend/routes/uploadRoutes.js
const express = require("express");
const {
  uploadMenuItemImages,
  uploadProfilePhoto: uploadProfilePhotoController,
  uploadRatingPhotos: uploadRatingPhotosController,
  uploadBase64,
  deleteUploadedImage,
  getOptimizedImage,
  getUploadSignature,
} = require("../controllers/upload");
const {
  authenticate,
  authorize,
  checkFacilityAccess,
} = require("../middleware/auth");
const {
  validateFileUpload,
  validateMongoId,
  sanitizeInput,
} = require("../middleware/validation");
const {
  uploadMenuItemImage,
  uploadProfilePhoto: uploadProfilePhotoMulter,
  uploadRatingPhotos: uploadRatingPhotosMulter,
} = require("../config/cloudinary");

const router = express.Router();

// Apply sanitization to all routes
router.use(sanitizeInput);

// Public routes
router.get("/optimize/:publicId", getOptimizedImage);

// Protected routes
router.use(authenticate);

// Placeholder routes
router.get("/", (req, res) => {
  res.json({ success: true, message: "Upload API working" });
});

// Profile photo upload (all authenticated users)
router.post(
  "/profile",
  uploadProfilePhotoMulter.single("profilePhoto"),
  validateFileUpload,
  uploadProfilePhotoController
);

// Menu item images upload (mess admin only)
router.post(
  "/menu-item/:itemId",
  authorize("mess_admin"),
  checkFacilityAccess,
  validateMongoId("itemId"),
  uploadMenuItemImage.array("images", 5),
  validateFileUpload,
  uploadMenuItemImages
);

// Rating photos upload (students only)
router.post(
  "/rating",
  authorize("student"),
  uploadRatingPhotosMulter.array("photos", 3),
  validateFileUpload,
  uploadRatingPhotosController
);

// Base64 image upload
router.post("/base64", uploadBase64);

// Delete image
router.delete("/:publicId", deleteUploadedImage);

// Get upload signature for client-side uploads
router.post("/signature", getUploadSignature);

module.exports = router;
