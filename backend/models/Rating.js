// backend/models/Rating.js
const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema(
  {
    // Core rating data
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Student ID is required"],
    },
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MenuItem",
      required: [true, "Menu item ID is required"],
    },
    dailyMenu: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DailyMenu",
      required: [true, "Daily menu ID is required"],
    },

    // Overall rating (1-5 scale)
    overallRating: {
      type: Number,
      required: [true, "Overall rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"],
    },

    // Category-wise ratings
    categoryRatings: {
      taste: {
        type: Number,
        required: [true, "Taste rating is required"],
        min: [1, "Taste rating must be at least 1"],
        max: [5, "Taste rating cannot exceed 5"],
      },
      quantity: {
        type: Number,
        required: [true, "Quantity rating is required"],
        min: [1, "Quantity rating must be at least 1"],
        max: [5, "Quantity rating cannot exceed 5"],
      },
      freshness: {
        type: Number,
        required: [true, "Freshness rating is required"],
        min: [1, "Freshness rating must be at least 1"],
        max: [5, "Freshness rating cannot exceed 5"],
      },
      value: {
        type: Number,
        required: [true, "Value rating is required"],
        min: [1, "Value rating must be at least 1"],
        max: [5, "Value rating cannot exceed 5"],
      },
    },

    // Optional text review
    review: {
      text: {
        type: String,
        trim: true,
        maxlength: [500, "Review cannot exceed 500 characters"],
      },
      isAnonymous: {
        type: Boolean,
        default: false,
      },
    },

    // Photo uploads with review
    photos: [
      {
        url: {
          type: String,
          required: true,
        },
        public_id: {
          type: String,
          required: true,
        },
        caption: {
          type: String,
          maxlength: 200,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Emoji reactions for quick feedback
    emojiReaction: {
      type: String,
      enum: ["😍", "😊", "😐", "😞", "🤢", "👍", "👎", "🔥", "❄️", "🌶️"],
      required: false,
    },

    // Meal context
    mealType: {
      type: String,
      enum: ["breakfast", "lunch", "dinner", "snack"],
      required: [true, "Meal type is required"],
    },

    mealDate: {
      type: Date,
      required: [true, "Meal date is required"],
      default: () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today;
      },
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

    // Rating metadata
    ratingMethod: {
      type: String,
      enum: ["swipe", "tap", "detailed_form"],
      default: "tap",
    },

    timeSpent: {
      type: Number, // in seconds
      min: 0,
    },

    deviceInfo: {
      type: String,
      enum: ["mobile", "tablet", "desktop"],
      default: "mobile",
    },

    // Community interaction
    helpfulVotes: {
      upvotes: {
        type: Number,
        default: 0,
      },
      downvotes: {
        type: Number,
        default: 0,
      },
      voters: [
        {
          user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
          vote: {
            type: String,
            enum: ["up", "down"],
          },
          votedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
    },

    // Status and moderation
    isActive: {
      type: Boolean,
      default: true,
    },

    isFlagged: {
      type: Boolean,
      default: false,
    },

    flagReason: {
      type: String,
      enum: ["inappropriate", "spam", "fake", "offensive"],
      required: function () {
        return this.isFlagged;
      },
    },

    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    moderatedAt: Date,

    // Location context (optional)
    location: {
      seatingArea: String,
      tableNumber: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes for performance and uniqueness
ratingSchema.index(
  {
    student: 1,
    menuItem: 1,
    mealDate: 1,
    mealType: 1,
  },
  {
    unique: true,
    name: "one_rating_per_meal_per_day",
  }
);

ratingSchema.index({ facilityId: 1, messType: 1, mealDate: -1 });
ratingSchema.index({ menuItem: 1, mealDate: -1 });
ratingSchema.index({ overallRating: -1, createdAt: -1 });
ratingSchema.index({ "review.isAnonymous": 1, isActive: 1 });
ratingSchema.index({ mealDate: 1, mealType: 1, facilityId: 1 });

// Virtual for helpfulness score
ratingSchema.virtual("helpfulnessScore").get(function () {
  const total = this.helpfulVotes.upvotes + this.helpfulVotes.downvotes;
  if (total === 0) return 0;
  return (this.helpfulVotes.upvotes / total) * 100;
});

// Virtual for rating summary
ratingSchema.virtual("ratingSummary").get(function () {
  return {
    overall: this.overallRating,
    categories: this.categoryRatings,
    average:
      (this.categoryRatings.taste +
        this.categoryRatings.quantity +
        this.categoryRatings.freshness +
        this.categoryRatings.value) /
      4,
  };
});

// Pre-save middleware to calculate overall rating from categories
ratingSchema.pre("save", function (next) {
  if (this.isModified("categoryRatings") && !this.isModified("overallRating")) {
    const { taste, quantity, freshness, value } = this.categoryRatings;
    this.overallRating = Math.round((taste + quantity + freshness + value) / 4);
  }
  next();
});

// Method to add helpful vote
ratingSchema.methods.addHelpfulVote = function (userId, voteType) {
  // Remove existing vote from this user
  this.helpfulVotes.voters = this.helpfulVotes.voters.filter(
    (voter) => !voter.user.equals(userId)
  );

  // Add new vote
  this.helpfulVotes.voters.push({
    user: userId,
    vote: voteType,
    votedAt: new Date(),
  });

  // Update vote counts
  const upvotes = this.helpfulVotes.voters.filter(
    (v) => v.vote === "up"
  ).length;
  const downvotes = this.helpfulVotes.voters.filter(
    (v) => v.vote === "down"
  ).length;

  this.helpfulVotes.upvotes = upvotes;
  this.helpfulVotes.downvotes = downvotes;
};

// Static method to get ratings for a menu item
ratingSchema.statics.findByMenuItem = function (menuItemId, options = {}) {
  const query = { menuItem: menuItemId, isActive: true };

  if (options.mealDate) {
    query.mealDate = options.mealDate;
  }
  if (options.facilityId) {
    query.facilityId = options.facilityId;
  }

  return this.find(query)
    .populate("student", "name profilePhoto")
    .sort({ createdAt: -1 });
};

// Static method to get student's rating history
ratingSchema.statics.findByStudent = function (studentId, options = {}) {
  const query = { student: studentId, isActive: true };

  if (options.facilityId) {
    query.facilityId = options.facilityId;
  }
  if (options.dateRange) {
    query.mealDate = {
      $gte: options.dateRange.start,
      $lte: options.dateRange.end,
    };
  }

  return this.find(query)
    .populate("menuItem", "name category images")
    .sort({ mealDate: -1, createdAt: -1 });
};

// Static method to calculate facility statistics
ratingSchema.statics.getFacilityStats = function (
  facilityId,
  messType,
  dateRange
) {
  return this.aggregate([
    {
      $match: {
        facilityId,
        messType,
        isActive: true,
        mealDate: {
          $gte: dateRange.start,
          $lte: dateRange.end,
        },
      },
    },
    {
      $group: {
        _id: "$mealType",
        totalRatings: { $sum: 1 },
        avgOverall: { $avg: "$overallRating" },
        avgTaste: { $avg: "$categoryRatings.taste" },
        avgQuantity: { $avg: "$categoryRatings.quantity" },
        avgFreshness: { $avg: "$categoryRatings.freshness" },
        avgValue: { $avg: "$categoryRatings.value" },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);
};

module.exports = mongoose.model("Rating", ratingSchema);
