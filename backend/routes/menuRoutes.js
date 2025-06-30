// backend/routes/menuRoutes.js
const express = require("express");
const {
  getTodayMenu,
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  createDailyMenu,
  updateDailyMenu,
  getDailyMenus,
  publishDailyMenu,
  addItemToDailyMenu,
  updateItemStatus,
} = require("../controllers/menu");
const {
  authenticate,
  authorize,
  optionalAuth,
  checkFacilityAccess,
} = require("../middleware/auth");

const router = express.Router();

// Public routes (with optional auth for personalization)
router.get("/today", optionalAuth, getTodayMenu);

// Protected routes for mess admins
router.use(authenticate);
router.use(authorize("mess_admin"));
router.use(checkFacilityAccess);

// Menu items management
router.route("/items").get(getMenuItems).post(createMenuItem);

router.route("/items/:id").put(updateMenuItem).delete(deleteMenuItem);

// Daily menu management
router.route("/daily").get(getDailyMenus).post(createDailyMenu);

router.route("/daily/:id").put(updateDailyMenu);

router.put("/daily/:id/publish", publishDailyMenu);

// Daily menu items management
router.post("/daily/:id/items", addItemToDailyMenu);
router.put("/daily/:id/items/:itemId/status", updateItemStatus);

module.exports = router;
