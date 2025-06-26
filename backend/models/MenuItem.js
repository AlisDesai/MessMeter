// backend/models/MenuItem.js
const mongoose = require("mongoose");

const menuItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Menu item name is required"],
      trim: true,
      maxlength: [100, "Menu item name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: [
        "starter",
        "main_course",
        "dessert",
        "beverage",
        "snack",
        "bread",
        "rice",
        "dal",
        "vegetable",
        "pickle",
        "salad",
      ],
      lowercase: true,
    },
    mealType: {
      type: String,
      required: [true, "Meal type is required"],
      enum: ["breakfast", "lunch", "dinner", "snack"],
      lowercase: true,
    },
    cuisineType: {
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
      default: "indian",
      lowercase: true,
    },
    isVegetarian: {
      type: Boolean,
      default: true,
    },
    isVegan: {
      type: Boolean,
      default: false,
    },
    isJain: {
      type: Boolean,
      default: false,
    },
    allergens: [
      {
        type: String,
        enum: [
          "nuts",
          "dairy",
          "gluten",
          "soy",
          "eggs",
          "seafood",
          "sesame",
          "mustard",
        ],
        lowercase: true,
      },
    ],
    spiceLevel: {
      type: String,
      enum: ["mild", "medium", "spicy", "very_spicy"],
      default: "medium",
    },
    images: [
      {
        url: {
          type: String,
          required: true,
        },
        public_id: {
          type: String,
          required: true,
        },
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    nutritionalInfo: {
      calories: Number,
      protein: Number,
      carbs: Number,
      fat: Number,
      fiber: Number,
      sugar: Number,
    },
    ingredients: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        quantity: String,
        unit: String,
      },
    ],
    preparationTime: {
      type: Number, // in minutes
      min: 1,
    },
    servingSize: {
      type: String,
      trim: true,
    },
    cost: {
      type: Number,
      min: 0,
    },
    // Admin and facility info
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    facilityId: {
      type: String,
      required: [true, "Facility ID is required"],
      trim: true,
    },
    messType: {
      type: String,
      enum: ["college_mess", "hostel_mess"],
      required: true,
    },
    // Rating aggregation
    totalRatings: {
      type: Number,
      default: 0,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    categoryRatings: {
      taste: {
        average: { type: Number, default: 0, min: 0, max: 5 },
        count: { type: Number, default: 0 },
      },
      quantity: {
        average: { type: Number, default: 0, min: 0, max: 5 },
        count: { type: Number, default: 0 },
      },
      freshness: {
        average: { type: Number, default: 0, min: 0, max: 5 },
        count: { type: Number, default: 0 },
      },
      value: {
        average: { type: Number, default: 0, min: 0, max: 5 },
        count: { type: Number, default: 0 },
      },
    },
    // Status and availability
    isActive: {
      type: Boolean,
      default: true,
    },
    availability: {
      isAvailable: { type: Boolean, default: true },
      reason: String, // 'out_of_stock', 'seasonal', 'preparation_issue'
      estimatedAvailableAt: Date,
    },
    // Scheduling
    servingDays: [
      {
        type: String,
        enum: [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ],
      },
    ],
    isSpecialItem: {
      type: Boolean,
      default: false,
    },
    specialOccasion: String,
    // Analytics tracking
    totalOrders: {
      type: Number,
      default: 0,
    },
    popularityScore: {
      type: Number,
      default: 0,
    },
    lastServedDate: Date,
    // Menu planning
    frequency: {
      type: String,
      enum: ["daily", "weekly", "monthly", "occasional", "seasonal"],
      default: "weekly",
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
menuItemSchema.index({ facilityId: 1, messType: 1, mealType: 1 });
menuItemSchema.index({ category: 1, isActive: 1 });
menuItemSchema.index({ averageRating: -1, totalRatings: -1 });
menuItemSchema.index({ isVegetarian: 1, isVegan: 1, isJain: 1 });
menuItemSchema.index({ createdBy: 1, createdAt: -1 });
menuItemSchema.index({ name: "text", description: "text" });

// Virtual for rating summary
menuItemSchema.virtual("ratingSummary").get(function () {
  return {
    overall: {
      average: this.averageRating,
      count: this.totalRatings,
    },
    categories: this.categoryRatings,
  };
});

// Virtual for dietary info
menuItemSchema.virtual("dietaryInfo").get(function () {
  return {
    vegetarian: this.isVegetarian,
    vegan: this.isVegan,
    jain: this.isJain,
    allergens: this.allergens,
    spiceLevel: this.spiceLevel,
  };
});

// Method to update rating averages
menuItemSchema.methods.updateRatings = function (newRating) {
  // Update overall rating
  const totalScore = this.averageRating * this.totalRatings + newRating.overall;
  this.totalRatings += 1;
  this.averageRating = totalScore / this.totalRatings;

  // Update category ratings
  ["taste", "quantity", "freshness", "value"].forEach((category) => {
    if (newRating[category] !== undefined) {
      const categoryData = this.categoryRatings[category];
      const totalCategoryScore =
        categoryData.average * categoryData.count + newRating[category];
      categoryData.count += 1;
      categoryData.average = totalCategoryScore / categoryData.count;
    }
  });

  this.lastUpdated = new Date();
};

// Method to check availability
menuItemSchema.methods.checkAvailability = function () {
  if (!this.isActive) return false;
  if (!this.availability.isAvailable) {
    // Check if estimated availability time has passed
    if (
      this.availability.estimatedAvailableAt &&
      new Date() >= this.availability.estimatedAvailableAt
    ) {
      this.availability.isAvailable = true;
      this.availability.reason = undefined;
      this.availability.estimatedAvailableAt = undefined;
    }
  }
  return this.availability.isAvailable;
};

// Static method to find by facility and meal type
menuItemSchema.statics.findByFacilityAndMeal = function (
  facilityId,
  messType,
  mealType
) {
  return this.find({
    facilityId,
    messType,
    mealType,
    isActive: true,
    "availability.isAvailable": true,
  }).sort({ popularityScore: -1, averageRating: -1 });
};

// Static method to find popular items
menuItemSchema.statics.findPopular = function (
  facilityId,
  messType,
  limit = 10
) {
  return this.find({
    facilityId,
    messType,
    isActive: true,
    totalRatings: { $gte: 5 },
  })
    .sort({ averageRating: -1, totalRatings: -1 })
    .limit(limit);
};

// Static method to find by dietary preferences
menuItemSchema.statics.findByDiet = function (
  facilityId,
  messType,
  dietaryOptions = {}
) {
  const query = { facilityId, messType, isActive: true };

  if (dietaryOptions.vegetarian) query.isVegetarian = true;
  if (dietaryOptions.vegan) query.isVegan = true;
  if (dietaryOptions.jain) query.isJain = true;
  if (dietaryOptions.excludeAllergens) {
    query.allergens = { $nin: dietaryOptions.excludeAllergens };
  }
  if (dietaryOptions.spiceLevel) {
    query.spiceLevel = dietaryOptions.spiceLevel;
  }

  return this.find(query);
};

// Pre-save middleware to update popularity score
menuItemSchema.pre("save", function (next) {
  if (this.isModified("totalRatings") || this.isModified("averageRating")) {
    // Calculate popularity score based on rating and total ratings
    this.popularityScore =
      this.averageRating * 0.7 + Math.min(this.totalRatings / 100, 1) * 0.3;
  }
  next();
});

module.exports = mongoose.model("MenuItem", menuItemSchema);
