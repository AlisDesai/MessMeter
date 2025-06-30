const express = require("express");
const {
  getAllFacilities,
  getFacilityMesses,
  createFacility,
  addMessToFacility,
  updateMess,
  getFacilityByMessName,
  checkFacilityName,
  checkMessName,
} = require("../controllers/facility"); // Fixed: removed "Controller"
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

// Public routes
router.get("/", getAllFacilities);
router.get("/messes", getFacilityMesses);
router.get("/check-name", checkFacilityName);
router.get("/check-mess", checkMessName);
router.get("/by-mess", getFacilityByMessName);

// Protected routes - Admin only
router.use(authenticate);
router.use(authorize("mess_admin"));

router.post("/", createFacility);
router.post("/add-mess", addMessToFacility);
router.put("/mess", updateMess);

module.exports = router;
