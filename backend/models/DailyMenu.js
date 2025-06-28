// backend/models/DailyMenu.js
const mongoose = require("mongoose");

const dailyMenuSchema = new mongoose.Schema(
  {
    // Date and meal information
    date: {
      type: Date,
      required: [true, "Menu date is required"],
      default: () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today;
      },
    },

    mealType: {
      type: String,
      enum: ["breakfast", "lunch", "dinner", "snack"],
      required: [true, "Meal type is required"],
    },

    // Facility information
    facilityId: {
      type: String,
      required: [true, "Facility ID is required"],
      trim: true,
    },

    messType: {
      type: String,
      enum: ["college_mess", "hostel_mess"],
      required: [true, "Mess type is required"],
    },

    // Menu items for this meal
    menuItems: [
      {
        item: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "MenuItem",
          required: true,
        },
        isAvailable: {
          type: Boolean,
          default: true,
        },
        servingSize: String,
        specialNotes: String,
        estimatedQuantity: Number, // Expected servings
        actualQuantity: Number, // Actual servings prepared
        remainingQuantity: Number, // Left over
        costPerServing: Number,
        preparationStatus: {
          type: String,
          enum: ["not_started", "in_progress", "ready", "served_out"],
          default: "not_started",
        },
        preparationTime: {
          startTime: Date,
          estimatedReady: Date,
          actualReady: Date,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Meal timing
    servingTime: {
      start: {
        type: Date,
        required: [true, "Serving start time is required"],
      },
      end: {
        type: Date,
        required: [true, "Serving end time is required"],
      },
    },

    // Menu metadata
    totalItems: {
      type: Number,
      default: 0,
    },

    cuisineTypes: [
      {
        type: String,
        enum: [
          "indian",
          "chinese",
          "continental",
          "south_indian",
          "north_indian",
          "italian",
          "mexican",
          "other",
        ],
      },
    ],

    dietaryOptions: {
      hasVegetarian: { type: Boolean, default: true },
      hasVegan: { type: Boolean, default: false },
      hasJain: { type: Boolean, default: false },
      hasGlutenFree: { type: Boolean, default: false },
    },

    // Chef and preparation info
    chefDetails: {
      headChef: String,
      assistantChefs: [String],
      totalStaff: Number,
    },

    // Cost and budget tracking
    budgetInfo: {
      estimatedCost: Number,
      actualCost: Number,
      costPerStudent: Number,
      budgetVariance: Number,
    },

    // Student engagement
    expectedStudents: {
      type: Number,
      min: 0,
    },

    actualStudents: {
      type: Number,
      min: 0,
      default: 0,
    },

    // Rating aggregation (calculated from Rating model)
    ratingStats: {
      totalRatings: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0, min: 0, max: 5 },
      categoryAverages: {
        taste: { type: Number, default: 0, min: 0, max: 5 },
        quantity: { type: Number, default: 0, min: 0, max: 5 },
        freshness: { type: Number, default: 0, min: 0, max: 5 },
        value: { type: Number, default: 0, min: 0, max: 5 },
      },
      participationRate: { type: Number, default: 0 }, // percentage
      lastUpdated: Date,
    },

    // Menu status
    status: {
      type: String,
      enum: ["draft", "published", "active", "completed", "cancelled"],
      default: "draft",
    },

    // Special occasions or themes
    specialOccasion: {
      name: String,
      description: String,
      isSpecial: { type: Boolean, default: false },
    },

    // Admin information
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creator ID is required"],
    },

    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Announcements and notifications
    announcements: [
      {
        title: {
          type: String,
          required: true,
          maxlength: 100,
        },
        message: {
          type: String,
          required: true,
          maxlength: 500,
        },
        type: {
          type: String,
          enum: ["info", "warning", "success", "error"],
          default: "info",
        },
        isActive: {
          type: Boolean,
          default: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        expiresAt: Date,
      },
    ],

    // Quality control
    qualityChecks: [
      {
        checkType: {
          type: String,
          enum: [
            "taste_test",
            "temperature_check",
            "hygiene_check",
            "quantity_check",
          ],
          required: true,
        },
        result: {
          type: String,
          enum: ["passed", "failed", "warning"],
          required: true,
        },
        notes: String,
        checkedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        checkedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Weather and external factors
    externalFactors: {
      weather: {
        type: String,
        enum: ["sunny", "rainy", "cloudy", "hot", "cold", "humid"],
      },
      studentEvents: String, // Any special events affecting student count
      holidays: Boolean,
      examPeriod: Boolean,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes for uniqueness and performance
dailyMenuSchema.index(
  {
    date: 1,
    mealType: 1,
    facilityId: 1,
    messType: 1,
  },
  {
    unique: true,
    name: "unique_daily_menu",
  }
);

dailyMenuSchema.index({ facilityId: 1, messType: 1, date: -1 });
dailyMenuSchema.index({ status: 1, date: 1 });
dailyMenuSchema.index({ createdBy: 1, date: -1 });
dailyMenuSchema.index({ "servingTime.start": 1, "servingTime.end": 1 });

// Virtual for menu completion percentage
dailyMenuSchema.virtual("completionPercentage").get(function () {
  if (this.menuItems.length === 0) return 0;
  const readyItems = this.menuItems.filter(
    (item) =>
      item.preparationStatus === "ready" ||
      item.preparationStatus === "served_out"
  ).length;
  return Math.round((readyItems / this.menuItems.length) * 100);
});

// Virtual for estimated vs actual cost variance
dailyMenuSchema.virtual("costVariance").get(function () {
  if (!this.budgetInfo.estimatedCost || !this.budgetInfo.actualCost)
    return null;
  return (
    ((this.budgetInfo.actualCost - this.budgetInfo.estimatedCost) /
      this.budgetInfo.estimatedCost) *
    100
  );
});

// Virtual for meal timing status
dailyMenuSchema.virtual("timingStatus").get(function () {
  const now = new Date();
  const start = this.servingTime.start;
  const end = this.servingTime.end;

  if (now < start) return "upcoming";
  if (now >= start && now <= end) return "active";
  return "completed";
});

// Pre-save middleware to update metadata
dailyMenuSchema.pre("save", function (next) {
  // Update total items count
  this.totalItems = this.menuItems.filter((item) => item.isAvailable).length;

  // Update cuisine types based on menu items
  if (this.isModified("menuItems") && this.populated("menuItems.item")) {
    const cuisines = new Set();
    this.menuItems.forEach((menuItem) => {
      if (menuItem.item && menuItem.item.cuisineType) {
        cuisines.add(menuItem.item.cuisineType);
      }
    });
    this.cuisineTypes = Array.from(cuisines);
  }

  // Update dietary options
  if (this.isModified("menuItems") && this.populated("menuItems.item")) {
    this.dietaryOptions.hasVegetarian = this.menuItems.some(
      (item) => item.item && item.item.isVegetarian
    );
    this.dietaryOptions.hasVegan = this.menuItems.some(
      (item) => item.item && item.item.isVegan
    );
    this.dietaryOptions.hasJain = this.menuItems.some(
      (item) => item.item && item.item.isJain
    );
  }

  next();
});

// Method to add menu item
dailyMenuSchema.methods.addMenuItem = function (itemId, options = {}) {
  const existingItem = this.menuItems.find(
    (item) => item.item.toString() === itemId.toString()
  );

  if (existingItem) {
    throw new Error("Menu item already exists in this meal");
  }

  this.menuItems.push({
    item: itemId,
    isAvailable: options.isAvailable !== false,
    servingSize: options.servingSize,
    specialNotes: options.specialNotes,
    estimatedQuantity: options.estimatedQuantity,
    costPerServing: options.costPerServing,
  });
};

// Method to update item status
dailyMenuSchema.methods.updateItemStatus = function (
  itemId,
  status,
  notes = ""
) {
  const menuItem = this.menuItems.find(
    (item) => item.item.toString() === itemId.toString()
  );

  if (!menuItem) {
    throw new Error("Menu item not found");
  }

  menuItem.preparationStatus = status;
  if (notes) menuItem.specialNotes = notes;

  if (status === "ready") {
    menuItem.preparationTime.actualReady = new Date();
  }
};

// Method to calculate participation rate
dailyMenuSchema.methods.updateParticipationRate = function () {
  if (this.expectedStudents > 0) {
    this.ratingStats.participationRate = Math.round(
      (this.ratingStats.totalRatings / this.expectedStudents) * 100
    );
  }
};

// Static method to get current active menus
dailyMenuSchema.statics.findActiveMenus = function (facilityId, messType) {
  const now = new Date();
  return this.find({
    facilityId,
    messType,
    status: "active",
    "servingTime.start": { $lte: now },
    "servingTime.end": { $gte: now },
  }).populate("menuItems.item");
};

// Static method to get today's menus
dailyMenuSchema.statics.findTodayMenus = function (facilityId, messType) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return this.find({
    facilityId,
    messType,
    date: { $gte: today, $lt: tomorrow },
  })
    .populate("menuItems.item")
    .sort({ "servingTime.start": 1 });
};

// Static method to get menu analytics
dailyMenuSchema.statics.getMenuAnalytics = function (
  facilityId,
  messType,
  dateRange
) {
  return this.aggregate([
    {
      $match: {
        facilityId,
        messType,
        date: { $gte: dateRange.start, $lte: dateRange.end },
        status: { $in: ["completed", "active"] },
      },
    },
    {
      $group: {
        _id: "$mealType",
        totalMenus: { $sum: 1 },
        avgRating: { $avg: "$ratingStats.averageRating" },
        avgParticipation: { $avg: "$ratingStats.participationRate" },
        totalStudents: { $sum: "$actualStudents" },
        avgCostPerStudent: { $avg: "$budgetInfo.costPerStudent" },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);
};

module.exports = mongoose.model("DailyMenu", dailyMenuSchema);
