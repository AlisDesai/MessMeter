// backend/controllers/rating.js
const mongoose = require("mongoose");
const Rating = require("../models/Rating");
const MenuItem = require("../models/MenuItem");
const DailyMenu = require("../models/DailyMenu");
const User = require("../models/User");

// @desc    Submit rating for a meal
// @route   POST /api/ratings
// @access  Private (Student)
const submitRating = async (req, res) => {
  try {
    const {
      menuItemId,
      dailyMenuId,
      overallRating,
      categoryRatings,
      review,
      photos,
      emojiReaction,
      mealType,
      mealDate,
      ratingMethod,
      timeSpent,
      deviceInfo,
      location,
    } = req.body;

    const studentId = req.user.id;
    const facilityId =
      req.user.adminFacility?.facilityId ||
      req.user.selectedFacility?.facilityId ||
      req.body.facilityId;
    const messType =
      req.user.adminFacility?.facilityType === "college"
        ? "college_mess"
        : "hostel_mess";

    // Check if student has already rated this meal today
    const existingRating = await Rating.findOne({
      student: studentId,
      menuItem: menuItemId,
      mealDate: new Date(mealDate),
      mealType,
    });

    if (existingRating) {
      return res.status(400).json({
        success: false,
        message: "You have already rated this meal today",
      });
    }

    // Verify menu item and daily menu exist
    const [menuItem, dailyMenu] = await Promise.all([
      MenuItem.findById(menuItemId),
      DailyMenu.findById(dailyMenuId),
    ]);

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
    }

    if (!dailyMenu) {
      return res.status(404).json({
        success: false,
        message: "Daily menu not found",
      });
    }

    // Create rating
    const rating = await Rating.create({
      student: studentId,
      menuItem: menuItemId,
      dailyMenu: dailyMenuId,
      overallRating,
      categoryRatings,
      review: review
        ? {
            text: review.text,
            isAnonymous: review.isAnonymous || false,
          }
        : undefined,
      photos: photos || [],
      emojiReaction,
      mealType,
      mealDate: new Date(mealDate),
      facilityId,
      messType,
      ratingMethod: ratingMethod || "tap",
      timeSpent,
      deviceInfo: deviceInfo || "mobile",
      location,
    });

    // Update menu item ratings
    await menuItem.updateRatings({
      overall: overallRating,
      taste: categoryRatings.taste,
      quantity: categoryRatings.quantity,
      freshness: categoryRatings.freshness,
      value: categoryRatings.value,
    });
    await menuItem.save();

    // Update daily menu stats
    dailyMenu.ratingStats.totalRatings += 1;
    const totalScore =
      dailyMenu.ratingStats.averageRating *
        (dailyMenu.ratingStats.totalRatings - 1) +
      overallRating;
    dailyMenu.ratingStats.averageRating =
      totalScore / dailyMenu.ratingStats.totalRatings;

    // Update category averages
    ["taste", "quantity", "freshness", "value"].forEach((category) => {
      const categoryData = dailyMenu.ratingStats.categoryAverages;
      if (!categoryData[category]) categoryData[category] = 0;
      const categoryTotal =
        categoryData[category] * (dailyMenu.ratingStats.totalRatings - 1) +
        categoryRatings[category];
      categoryData[category] =
        categoryTotal / dailyMenu.ratingStats.totalRatings;
    });

    dailyMenu.ratingStats.lastUpdated = new Date();
    dailyMenu.updateParticipationRate();
    await dailyMenu.save();

    await rating.populate("student", "name profilePhoto");

    res.status(201).json({
      success: true,
      message: "Rating submitted successfully",
      data: rating,
    });
  } catch (error) {
    console.error("Submit rating error:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "You have already rated this meal today",
      });
    }

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
      message: "Could not submit rating",
    });
  }
};

// @desc    Get ratings for a menu item
// @route   GET /api/ratings/item/:menuItemId
// @access  Public (with optional auth)
const getMenuItemRatings = async (req, res) => {
  try {
    const { menuItemId } = req.params;
    const {
      page = 1,
      limit = 20,
      sortBy = "newest",
      mealDate,
      facilityId,
    } = req.query;

    const options = {
      mealDate: mealDate ? new Date(mealDate) : undefined,
      facilityId,
    };

    let sortOption = { createdAt: -1 };
    if (sortBy === "helpful") {
      sortOption = { "helpfulVotes.upvotes": -1, createdAt: -1 };
    } else if (sortBy === "rating_high") {
      sortOption = { overallRating: -1, createdAt: -1 };
    } else if (sortBy === "rating_low") {
      sortOption = { overallRating: 1, createdAt: -1 };
    }

    const ratings = await Rating.findByMenuItem(menuItemId, options)
      .sort(sortOption)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Rating.countDocuments({
      menuItem: menuItemId,
      isActive: true,
      ...(options.mealDate && { mealDate: options.mealDate }),
      ...(options.facilityId && { facilityId: options.facilityId }),
    });

    // Calculate rating summary
    const ratingSummary = await Rating.aggregate([
      {
        $match: {
          menuItem: mongoose.Types.ObjectId(menuItemId),
          isActive: true,
          ...(options.mealDate && { mealDate: options.mealDate }),
          ...(options.facilityId && { facilityId: options.facilityId }),
        },
      },
      {
        $group: {
          _id: null,
          totalRatings: { $sum: 1 },
          averageOverall: { $avg: "$overallRating" },
          averageTaste: { $avg: "$categoryRatings.taste" },
          averageQuantity: { $avg: "$categoryRatings.quantity" },
          averageFreshness: { $avg: "$categoryRatings.freshness" },
          averageValue: { $avg: "$categoryRatings.value" },
          ratingDistribution: {
            $push: "$overallRating",
          },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      count: ratings.length,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
      summary: ratingSummary[0] || null,
      data: ratings,
    });
  } catch (error) {
    console.error("Get menu item ratings error:", error);
    res.status(500).json({
      success: false,
      message: "Could not fetch ratings",
    });
  }
};

// @desc    Get student's rating history
// @route   GET /api/ratings/my-history
// @access  Private (Student)
const getMyRatingHistory = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { page = 1, limit = 20, facilityId, dateRange } = req.query;

    const options = { facilityId };

    if (dateRange) {
      const [startDate, endDate] = dateRange.split(",");
      options.dateRange = {
        start: new Date(startDate),
        end: new Date(endDate),
      };
    }

    const ratings = await Rating.findByStudent(studentId, options)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Rating.countDocuments({
      student: studentId,
      isActive: true,
      ...(options.facilityId && { facilityId: options.facilityId }),
      ...(options.dateRange && {
        mealDate: {
          $gte: options.dateRange.start,
          $lte: options.dateRange.end,
        },
      }),
    });

    // Calculate user statistics
    const userStats = await Rating.aggregate([
      {
        $match: {
          student: mongoose.Types.ObjectId(studentId),
          isActive: true,
        },
      },
      {
        $group: {
          _id: null,
          totalRatings: { $sum: 1 },
          averageRating: { $avg: "$overallRating" },
          favoriteCategory: {
            $avg: {
              $max: [
                "$categoryRatings.taste",
                "$categoryRatings.quantity",
                "$categoryRatings.freshness",
                "$categoryRatings.value",
              ],
            },
          },
          ratingsThisMonth: {
            $sum: {
              $cond: [
                {
                  $gte: [
                    "$mealDate",
                    new Date(
                      new Date().getFullYear(),
                      new Date().getMonth(),
                      1
                    ),
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      count: ratings.length,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
      stats: userStats[0] || null,
      data: ratings,
    });
  } catch (error) {
    console.error("Get rating history error:", error);
    res.status(500).json({
      success: false,
      message: "Could not fetch rating history",
    });
  }
};

// @desc    Vote on rating helpfulness
// @route   POST /api/ratings/:ratingId/vote
// @access  Private (Student)
const voteOnRating = async (req, res) => {
  try {
    const { ratingId } = req.params;
    const { voteType } = req.body; // 'up' or 'down'
    const userId = req.user.id;

    if (!["up", "down"].includes(voteType)) {
      return res.status(400).json({
        success: false,
        message: 'Vote type must be "up" or "down"',
      });
    }

    const rating = await Rating.findById(ratingId);

    if (!rating) {
      return res.status(404).json({
        success: false,
        message: "Rating not found",
      });
    }

    // Check if user is trying to vote on their own rating
    if (rating.student.toString() === userId) {
      return res.status(400).json({
        success: false,
        message: "Cannot vote on your own rating",
      });
    }

    rating.addHelpfulVote(userId, voteType);
    await rating.save();

    res.status(200).json({
      success: true,
      message: "Vote recorded successfully",
      data: {
        upvotes: rating.helpfulVotes.upvotes,
        downvotes: rating.helpfulVotes.downvotes,
        helpfulnessScore: rating.helpfulnessScore,
      },
    });
  } catch (error) {
    console.error("Vote on rating error:", error);
    res.status(500).json({
      success: false,
      message: "Could not record vote",
    });
  }
};

// @desc    Update rating
// @route   PUT /api/ratings/:ratingId
// @access  Private (Student - own rating only)
const updateRating = async (req, res) => {
  try {
    const { ratingId } = req.params;
    const studentId = req.user.id;

    const rating = await Rating.findOne({
      _id: ratingId,
      student: studentId,
    });

    if (!rating) {
      return res.status(404).json({
        success: false,
        message: "Rating not found or not authorized",
      });
    }

    // Check if rating is recent (allow updates within 24 hours)
    const hoursSinceRating =
      (Date.now() - rating.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceRating > 24) {
      return res.status(400).json({
        success: false,
        message: "Rating can only be updated within 24 hours of submission",
      });
    }

    const allowedUpdates = ["categoryRatings", "review", "emojiReaction"];
    const oldOverallRating = rating.overallRating;
    const oldCategoryRatings = { ...rating.categoryRatings };

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        rating[field] = req.body[field];
      }
    });

    // Recalculate overall rating if categories changed
    if (req.body.categoryRatings) {
      const { taste, quantity, freshness, value } = req.body.categoryRatings;
      rating.overallRating = Math.round(
        (taste + quantity + freshness + value) / 4
      );
    }

    await rating.save();

    // Update menu item ratings if overall rating changed
    if (rating.overallRating !== oldOverallRating || req.body.categoryRatings) {
      const menuItem = await MenuItem.findById(rating.menuItem);
      if (menuItem) {
        // Remove old rating contribution and add new one
        const totalScore =
          menuItem.averageRating * menuItem.totalRatings -
          oldOverallRating +
          rating.overallRating;
        menuItem.averageRating = totalScore / menuItem.totalRatings;

        // Update category ratings
        ["taste", "quantity", "freshness", "value"].forEach((category) => {
          const categoryData = menuItem.categoryRatings[category];
          const oldValue = oldCategoryRatings[category];
          const newValue = rating.categoryRatings[category];
          const totalCategoryScore =
            categoryData.average * categoryData.count - oldValue + newValue;
          categoryData.average = totalCategoryScore / categoryData.count;
        });

        await menuItem.save();
      }
    }

    res.status(200).json({
      success: true,
      message: "Rating updated successfully",
      data: rating,
    });
  } catch (error) {
    console.error("Update rating error:", error);
    res.status(500).json({
      success: false,
      message: "Could not update rating",
    });
  }
};

// @desc    Delete rating
// @route   DELETE /api/ratings/:ratingId
// @access  Private (Student - own rating only)
const deleteRating = async (req, res) => {
  try {
    const { ratingId } = req.params;
    const studentId = req.user.id;

    const rating = await Rating.findOne({
      _id: ratingId,
      student: studentId,
    });

    if (!rating) {
      return res.status(404).json({
        success: false,
        message: "Rating not found or not authorized",
      });
    }

    // Check if rating is recent (allow deletion within 1 hour)
    const hoursSinceRating =
      (Date.now() - rating.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceRating > 1) {
      return res.status(400).json({
        success: false,
        message: "Rating can only be deleted within 1 hour of submission",
      });
    }

    // Soft delete
    rating.isActive = false;
    await rating.save();

    res.status(200).json({
      success: true,
      message: "Rating deleted successfully",
    });
  } catch (error) {
    console.error("Delete rating error:", error);
    res.status(500).json({
      success: false,
      message: "Could not delete rating",
    });
  }
};

// @desc    Get facility rating statistics
// @route   GET /api/ratings/stats/facility
// @access  Private (Mess Admin)
const getFacilityStats = async (req, res) => {
  try {
    const facilityId =
      req.user.adminFacility?.facilityId ||
      req.user.selectedFacility?.facilityId;
    const messType =
      req.user.adminFacility?.facilityType === "college"
        ? "college_mess"
        : "hostel_mess";
    const { dateRange, mealType } = req.query;

    let startDate, endDate;
    if (dateRange) {
      [startDate, endDate] = dateRange.split(",").map((date) => new Date(date));
    } else {
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30); // Last 30 days
    }

    const stats = await Rating.getFacilityStats(facilityId, messType, {
      start: startDate,
      end: endDate,
    });

    // Get daily trends
    const dailyTrends = await Rating.aggregate([
      {
        $match: {
          facilityId,
          messType,
          mealDate: { $gte: startDate, $lte: endDate },
          isActive: true,
          ...(mealType && { mealType }),
        },
      },
      {
        $group: {
          _id: {
            date: "$mealDate",
            mealType: "$mealType",
          },
          averageRating: { $avg: "$overallRating" },
          totalRatings: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.date": 1 },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        summary: stats,
        dailyTrends,
        dateRange: { start: startDate, end: endDate },
      },
    });
  } catch (error) {
    console.error("Get facility stats error:", error);
    res.status(500).json({
      success: false,
      message: "Could not fetch facility statistics",
    });
  }
};

module.exports = {
  submitRating,
  getMenuItemRatings,
  getMyRatingHistory,
  voteOnRating,
  updateRating,
  deleteRating,
  getFacilityStats,
};
