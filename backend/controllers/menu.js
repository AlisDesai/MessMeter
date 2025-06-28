// backend/controllers/menu.js
const MenuItem = require("../models/MenuItem");
const DailyMenu = require("../models/DailyMenu");
const Rating = require("../models/Rating");

// @desc    Get today's menu for students
// @route   GET /api/menu/today
// @access  Public (with optional auth)
const getTodayMenu = async (req, res) => {
  try {
    const { facilityId, messType, mealType } = req.query;

    if (!facilityId || !messType) {
      return res.status(400).json({
        success: false,
        message: "Facility ID and mess type are required",
      });
    }

    const query = { facilityId, messType };
    if (mealType) query.mealType = mealType;

    const todayMenus = await DailyMenu.findTodayMenus(facilityId, messType);

    if (!todayMenus || todayMenus.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No menu found for today",
      });
    }

    // Filter by mealType if specified
    const filteredMenus = mealType
      ? todayMenus.filter((menu) => menu.mealType === mealType)
      : todayMenus;

    res.status(200).json({
      success: true,
      count: filteredMenus.length,
      data: filteredMenus,
    });
  } catch (error) {
    console.error("Get today menu error:", error);
    res.status(500).json({
      success: false,
      message: "Could not fetch today's menu",
    });
  }
};

// @desc    Get menu items for mess admin
// @route   GET /api/menu/items
// @access  Private (Mess Admin)
const getMenuItems = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      search,
      isActive = true,
    } = req.query;
    const facilityId = req.user.facilityId;
    const messType = req.user.messType;

    // Build query
    const query = { facilityId, messType };
    if (category) query.category = category;
    if (isActive !== undefined) query.isActive = isActive === "true";
    if (search) {
      query.$text = { $search: search };
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: search
        ? { score: { $meta: "textScore" } }
        : { averageRating: -1, totalRatings: -1 },
      populate: {
        path: "createdBy",
        select: "name",
      },
    };

    const menuItems = await MenuItem.paginate(query, options);

    res.status(200).json({
      success: true,
      data: menuItems,
    });
  } catch (error) {
    console.error("Get menu items error:", error);
    res.status(500).json({
      success: false,
      message: "Could not fetch menu items",
    });
  }
};

// @desc    Create new menu item
// @route   POST /api/menu/items
// @access  Private (Mess Admin)
const createMenuItem = async (req, res) => {
  try {
    const menuItemData = {
      ...req.body,
      createdBy: req.user.id,
      facilityId: req.user.facilityId,
      messType: req.user.messType,
    };

    const menuItem = await MenuItem.create(menuItemData);

    res.status(201).json({
      success: true,
      message: "Menu item created successfully",
      data: menuItem,
    });
  } catch (error) {
    console.error("Create menu item error:", error);

    if (error.name === "ValidationError") {
      const message = Object.values(error.errors)
        .map((err) => err.message)
        .join(", ");
      return res.status(400).json({
        success: false,
        message: `Validation error: ${message}`,
      });
    }

    res.status(500).json({
      success: false,
      message: "Could not create menu item",
    });
  }
};

// @desc    Update menu item
// @route   PUT /api/menu/items/:id
// @access  Private (Mess Admin)
const updateMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const facilityId = req.user.facilityId;
    const messType = req.user.messType;

    const menuItem = await MenuItem.findOne({
      _id: id,
      facilityId,
      messType,
    });

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
    }

    // Update fields
    Object.keys(req.body).forEach((key) => {
      if (req.body[key] !== undefined) {
        menuItem[key] = req.body[key];
      }
    });

    menuItem.lastUpdated = new Date();
    await menuItem.save();

    res.status(200).json({
      success: true,
      message: "Menu item updated successfully",
      data: menuItem,
    });
  } catch (error) {
    console.error("Update menu item error:", error);

    if (error.name === "ValidationError") {
      const message = Object.values(error.errors)
        .map((err) => err.message)
        .join(", ");
      return res.status(400).json({
        success: false,
        message: `Validation error: ${message}`,
      });
    }

    res.status(500).json({
      success: false,
      message: "Could not update menu item",
    });
  }
};

// @desc    Delete menu item
// @route   DELETE /api/menu/items/:id
// @access  Private (Mess Admin)
const deleteMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const facilityId = req.user.facilityId;
    const messType = req.user.messType;

    const menuItem = await MenuItem.findOne({
      _id: id,
      facilityId,
      messType,
    });

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
    }

    // Soft delete by setting isActive to false
    menuItem.isActive = false;
    await menuItem.save();

    res.status(200).json({
      success: true,
      message: "Menu item deleted successfully",
    });
  } catch (error) {
    console.error("Delete menu item error:", error);
    res.status(500).json({
      success: false,
      message: "Could not delete menu item",
    });
  }
};

// @desc    Create daily menu
// @route   POST /api/menu/daily
// @access  Private (Mess Admin)
const createDailyMenu = async (req, res) => {
  try {
    const {
      date,
      mealType,
      menuItems,
      servingTime,
      expectedStudents,
      specialOccasion,
      announcements,
    } = req.body;

    const facilityId = req.user.facilityId;
    const messType = req.user.messType;

    // Check if daily menu already exists
    const existingMenu = await DailyMenu.findOne({
      date: new Date(date),
      mealType,
      facilityId,
      messType,
    });

    if (existingMenu) {
      return res.status(400).json({
        success: false,
        message: "Daily menu already exists for this date and meal type",
      });
    }

    // Validate menu items exist and belong to facility
    if (menuItems && menuItems.length > 0) {
      const itemIds = menuItems.map((item) => item.item);
      const validItems = await MenuItem.find({
        _id: { $in: itemIds },
        facilityId,
        messType,
        isActive: true,
      });

      if (validItems.length !== itemIds.length) {
        return res.status(400).json({
          success: false,
          message: "Some menu items are invalid or not available",
        });
      }
    }

    const dailyMenu = await DailyMenu.create({
      date: new Date(date),
      mealType,
      facilityId,
      messType,
      menuItems: menuItems || [],
      servingTime,
      expectedStudents,
      specialOccasion,
      announcements: announcements || [],
      createdBy: req.user.id,
      status: "draft",
    });

    await dailyMenu.populate("menuItems.item");

    res.status(201).json({
      success: true,
      message: "Daily menu created successfully",
      data: dailyMenu,
    });
  } catch (error) {
    console.error("Create daily menu error:", error);

    if (error.name === "ValidationError") {
      const message = Object.values(error.errors)
        .map((err) => err.message)
        .join(", ");
      return res.status(400).json({
        success: false,
        message: `Validation error: ${message}`,
      });
    }

    res.status(500).json({
      success: false,
      message: "Could not create daily menu",
    });
  }
};

// @desc    Update daily menu
// @route   PUT /api/menu/daily/:id
// @access  Private (Mess Admin)
const updateDailyMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const facilityId = req.user.facilityId;
    const messType = req.user.messType;

    const dailyMenu = await DailyMenu.findOne({
      _id: id,
      facilityId,
      messType,
    });

    if (!dailyMenu) {
      return res.status(404).json({
        success: false,
        message: "Daily menu not found",
      });
    }

    // Update allowed fields
    const allowedUpdates = [
      "menuItems",
      "servingTime",
      "expectedStudents",
      "specialOccasion",
      "announcements",
      "status",
      "chefDetails",
      "budgetInfo",
      "qualityChecks",
    ];

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        dailyMenu[field] = req.body[field];
      }
    });

    dailyMenu.lastModifiedBy = req.user.id;
    await dailyMenu.save();
    await dailyMenu.populate("menuItems.item");

    res.status(200).json({
      success: true,
      message: "Daily menu updated successfully",
      data: dailyMenu,
    });
  } catch (error) {
    console.error("Update daily menu error:", error);
    res.status(500).json({
      success: false,
      message: "Could not update daily menu",
    });
  }
};

// @desc    Get daily menus for admin
// @route   GET /api/menu/daily
// @access  Private (Mess Admin)
const getDailyMenus = async (req, res) => {
  try {
    const { date, mealType, status, page = 1, limit = 10 } = req.query;
    const facilityId = req.user.facilityId;
    const messType = req.user.messType;

    const query = { facilityId, messType };

    if (date) {
      const searchDate = new Date(date);
      searchDate.setHours(0, 0, 0, 0);
      const nextDate = new Date(searchDate);
      nextDate.setDate(nextDate.getDate() + 1);
      query.date = { $gte: searchDate, $lt: nextDate };
    }

    if (mealType) query.mealType = mealType;
    if (status) query.status = status;

    const dailyMenus = await DailyMenu.find(query)
      .populate("menuItems.item")
      .populate("createdBy", "name")
      .sort({ date: -1, "servingTime.start": 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await DailyMenu.countDocuments(query);

    res.status(200).json({
      success: true,
      count: dailyMenus.length,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
      data: dailyMenus,
    });
  } catch (error) {
    console.error("Get daily menus error:", error);
    res.status(500).json({
      success: false,
      message: "Could not fetch daily menus",
    });
  }
};

// @desc    Publish daily menu
// @route   PUT /api/menu/daily/:id/publish
// @access  Private (Mess Admin)
const publishDailyMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const facilityId = req.user.facilityId;
    const messType = req.user.messType;

    const dailyMenu = await DailyMenu.findOne({
      _id: id,
      facilityId,
      messType,
    });

    if (!dailyMenu) {
      return res.status(404).json({
        success: false,
        message: "Daily menu not found",
      });
    }

    if (dailyMenu.status === "published" || dailyMenu.status === "active") {
      return res.status(400).json({
        success: false,
        message: "Menu is already published",
      });
    }

    if (dailyMenu.menuItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot publish menu without items",
      });
    }

    dailyMenu.status = "published";
    dailyMenu.lastModifiedBy = req.user.id;
    await dailyMenu.save();

    res.status(200).json({
      success: true,
      message: "Daily menu published successfully",
      data: dailyMenu,
    });
  } catch (error) {
    console.error("Publish daily menu error:", error);
    res.status(500).json({
      success: false,
      message: "Could not publish daily menu",
    });
  }
};

// @desc    Add item to daily menu
// @route   POST /api/menu/daily/:id/items
// @access  Private (Mess Admin)
const addItemToDailyMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      itemId,
      servingSize,
      estimatedQuantity,
      costPerServing,
      specialNotes,
    } = req.body;
    const facilityId = req.user.facilityId;
    const messType = req.user.messType;

    const dailyMenu = await DailyMenu.findOne({
      _id: id,
      facilityId,
      messType,
    });

    if (!dailyMenu) {
      return res.status(404).json({
        success: false,
        message: "Daily menu not found",
      });
    }

    // Verify menu item exists and belongs to facility
    const menuItem = await MenuItem.findOne({
      _id: itemId,
      facilityId,
      messType,
      isActive: true,
    });

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found or not available",
      });
    }

    dailyMenu.addMenuItem(itemId, {
      servingSize,
      estimatedQuantity,
      costPerServing,
      specialNotes,
    });

    await dailyMenu.save();
    await dailyMenu.populate("menuItems.item");

    res.status(200).json({
      success: true,
      message: "Item added to daily menu successfully",
      data: dailyMenu,
    });
  } catch (error) {
    console.error("Add item to daily menu error:", error);

    if (error.message.includes("already exists")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Could not add item to daily menu",
    });
  }
};

// @desc    Update item status in daily menu
// @route   PUT /api/menu/daily/:id/items/:itemId/status
// @access  Private (Mess Admin)
const updateItemStatus = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { status, notes } = req.body;
    const facilityId = req.user.facilityId;
    const messType = req.user.messType;

    const dailyMenu = await DailyMenu.findOne({
      _id: id,
      facilityId,
      messType,
    });

    if (!dailyMenu) {
      return res.status(404).json({
        success: false,
        message: "Daily menu not found",
      });
    }

    dailyMenu.updateItemStatus(itemId, status, notes);
    await dailyMenu.save();

    res.status(200).json({
      success: true,
      message: "Item status updated successfully",
      data: dailyMenu,
    });
  } catch (error) {
    console.error("Update item status error:", error);

    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Could not update item status",
    });
  }
};

module.exports = {
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
};
