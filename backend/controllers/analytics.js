// backend/controllers/analytics.js
const Rating = require("../models/Rating");
const DailyMenu = require("../models/DailyMenu");
const MenuItem = require("../models/MenuItem");
const User = require("../models/User");
const {
  parseDateRange,
  calculateRatingAverage,
  getRatingDistribution,
} = require("../utils/helpers");

// @desc    Get dashboard overview for mess admin
// @route   GET /api/analytics/dashboard
// @access  Private (Mess Admin)
const getDashboardOverview = async (req, res) => {
  try {
    const facilityId = req.user.facilityId;
    const messType = req.user.messType;
    const { dateRange } = req.query;

    const { start, end } = parseDateRange(dateRange, 7); // Default 7 days

    // Get basic stats
    const [totalRatings, totalMenus, activeMenuItems, totalStudents] =
      await Promise.all([
        Rating.countDocuments({
          facilityId,
          messType,
          mealDate: { $gte: start, $lte: end },
          isActive: true,
        }),
        DailyMenu.countDocuments({
          facilityId,
          messType,
          date: { $gte: start, $lte: end },
        }),
        MenuItem.countDocuments({
          facilityId,
          messType,
          isActive: true,
        }),
        User.countDocuments({
          role: "student",
          isActive: true,
          $or: [{ collegeId: facilityId }, { hostelId: facilityId }],
        }),
      ]);

    // Get average ratings by meal type
    const mealTypeStats = await Rating.aggregate([
      {
        $match: {
          facilityId,
          messType,
          mealDate: { $gte: start, $lte: end },
          isActive: true,
        },
      },
      {
        $group: {
          _id: "$mealType",
          avgRating: { $avg: "$overallRating" },
          totalRatings: { $sum: 1 },
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

    // Get daily rating trends
    const dailyTrends = await Rating.aggregate([
      {
        $match: {
          facilityId,
          messType,
          mealDate: { $gte: start, $lte: end },
          isActive: true,
        },
      },
      {
        $group: {
          _id: "$mealDate",
          avgRating: { $avg: "$overallRating" },
          totalRatings: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Get top rated items
    const topRatedItems = await MenuItem.find({
      facilityId,
      messType,
      isActive: true,
      totalRatings: { $gte: 5 },
    })
      .sort({ averageRating: -1, totalRatings: -1 })
      .limit(5)
      .select("name averageRating totalRatings category");

    // Get participation rate
    const participationData = await DailyMenu.aggregate([
      {
        $match: {
          facilityId,
          messType,
          date: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          avgParticipation: { $avg: "$ratingStats.participationRate" },
          totalExpectedStudents: { $sum: "$expectedStudents" },
          totalActualStudents: { $sum: "$actualStudents" },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalRatings,
          totalMenus,
          activeMenuItems,
          totalStudents,
          dateRange: { start, end },
        },
        mealTypeStats,
        dailyTrends,
        topRatedItems,
        participationRate: participationData[0]?.avgParticipation || 0,
      },
    });
  } catch (error) {
    console.error("Get dashboard overview error:", error);
    res.status(500).json({
      success: false,
      message: "Could not fetch dashboard data",
    });
  }
};

// @desc    Get detailed meal analytics
// @route   GET /api/analytics/meals
// @access  Private (Mess Admin)
const getMealAnalytics = async (req, res) => {
  try {
    const facilityId = req.user.facilityId;
    const messType = req.user.messType;
    const { dateRange, mealType } = req.query;

    const { start, end } = parseDateRange(dateRange, 30);

    const matchConditions = {
      facilityId,
      messType,
      mealDate: { $gte: start, $lte: end },
      isActive: true,
    };

    if (mealType) {
      matchConditions.mealType = mealType;
    }

    // Get meal performance analytics
    const mealAnalytics = await Rating.aggregate([
      { $match: matchConditions },
      {
        $group: {
          _id: {
            date: "$mealDate",
            mealType: "$mealType",
          },
          avgOverallRating: { $avg: "$overallRating" },
          avgTaste: { $avg: "$categoryRatings.taste" },
          avgQuantity: { $avg: "$categoryRatings.quantity" },
          avgFreshness: { $avg: "$categoryRatings.freshness" },
          avgValue: { $avg: "$categoryRatings.value" },
          totalRatings: { $sum: 1 },
          ratings: { $push: "$overallRating" },
        },
      },
      {
        $addFields: {
          ratingDistribution: {
            $reduce: {
              input: "$ratings",
              initialValue: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
              in: {
                $mergeObjects: [
                  "$$value",
                  {
                    $switch: {
                      branches: [
                        {
                          case: { $eq: [{ $round: "$$this" }, 1] },
                          then: { 1: { $add: ["$$value.1", 1] } },
                        },
                        {
                          case: { $eq: [{ $round: "$$this" }, 2] },
                          then: { 2: { $add: ["$$value.2", 1] } },
                        },
                        {
                          case: { $eq: [{ $round: "$$this" }, 3] },
                          then: { 3: { $add: ["$$value.3", 1] } },
                        },
                        {
                          case: { $eq: [{ $round: "$$this" }, 4] },
                          then: { 4: { $add: ["$$value.4", 1] } },
                        },
                        {
                          case: { $eq: [{ $round: "$$this" }, 5] },
                          then: { 5: { $add: ["$$value.5", 1] } },
                        },
                      ],
                      default: {},
                    },
                  },
                ],
              },
            },
          },
        },
      },
      {
        $sort: { "_id.date": -1, "_id.mealType": 1 },
      },
    ]);

    // Get category performance comparison
    const categoryComparison = await Rating.aggregate([
      { $match: matchConditions },
      {
        $group: {
          _id: "$mealType",
          taste: { $avg: "$categoryRatings.taste" },
          quantity: { $avg: "$categoryRatings.quantity" },
          freshness: { $avg: "$categoryRatings.freshness" },
          value: { $avg: "$categoryRatings.value" },
        },
      },
    ]);

    // Get best and worst performing meals
    const performanceExtremes = await Rating.aggregate([
      { $match: matchConditions },
      {
        $group: {
          _id: {
            date: "$mealDate",
            mealType: "$mealType",
          },
          avgRating: { $avg: "$overallRating" },
          totalRatings: { $sum: 1 },
        },
      },
      { $match: { totalRatings: { $gte: 3 } } },
      {
        $facet: {
          best: [{ $sort: { avgRating: -1 } }, { $limit: 5 }],
          worst: [{ $sort: { avgRating: 1 } }, { $limit: 5 }],
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        mealAnalytics,
        categoryComparison,
        bestPerformingMeals: performanceExtremes[0]?.best || [],
        worstPerformingMeals: performanceExtremes[0]?.worst || [],
        dateRange: { start, end },
      },
    });
  } catch (error) {
    console.error("Get meal analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Could not fetch meal analytics",
    });
  }
};

// @desc    Get menu item performance
// @route   GET /api/analytics/menu-items
// @access  Private (Mess Admin)
const getMenuItemAnalytics = async (req, res) => {
  try {
    const facilityId = req.user.facilityId;
    const messType = req.user.messType;
    const { dateRange, category, sortBy = "rating" } = req.query;

    const { start, end } = parseDateRange(dateRange, 30);

    // Build aggregation pipeline
    const pipeline = [
      {
        $lookup: {
          from: "ratings",
          localField: "_id",
          foreignField: "menuItem",
          as: "recentRatings",
          pipeline: [
            {
              $match: {
                facilityId,
                messType,
                mealDate: { $gte: start, $lte: end },
                isActive: true,
              },
            },
          ],
        },
      },
      {
        $match: {
          facilityId,
          messType,
          isActive: true,
          ...(category && { category }),
        },
      },
      {
        $addFields: {
          recentRatingCount: { $size: "$recentRatings" },
          recentAvgRating: {
            $cond: {
              if: { $gt: [{ $size: "$recentRatings" }, 0] },
              then: { $avg: "$recentRatings.overallRating" },
              else: 0,
            },
          },
          recentCategoryRatings: {
            taste: {
              $cond: {
                if: { $gt: [{ $size: "$recentRatings" }, 0] },
                then: { $avg: "$recentRatings.categoryRatings.taste" },
                else: 0,
              },
            },
            quantity: {
              $cond: {
                if: { $gt: [{ $size: "$recentRatings" }, 0] },
                then: { $avg: "$recentRatings.categoryRatings.quantity" },
                else: 0,
              },
            },
            freshness: {
              $cond: {
                if: { $gt: [{ $size: "$recentRatings" }, 0] },
                then: { $avg: "$recentRatings.categoryRatings.freshness" },
                else: 0,
              },
            },
            value: {
              $cond: {
                if: { $gt: [{ $size: "$recentRatings" }, 0] },
                then: { $avg: "$recentRatings.categoryRatings.value" },
                else: 0,
              },
            },
          },
        },
      },
      {
        $project: {
          name: 1,
          category: 1,
          cuisineType: 1,
          averageRating: 1,
          totalRatings: 1,
          recentRatingCount: 1,
          recentAvgRating: 1,
          recentCategoryRatings: 1,
          popularityScore: 1,
          isVegetarian: 1,
          lastServedDate: 1,
        },
      },
    ];

    // Add sorting
    const sortOption = {};
    switch (sortBy) {
      case "rating":
        sortOption.recentAvgRating = -1;
        break;
      case "popularity":
        sortOption.popularityScore = -1;
        break;
      case "recent":
        sortOption.recentRatingCount = -1;
        break;
      default:
        sortOption.recentAvgRating = -1;
    }
    pipeline.push({ $sort: sortOption });

    const menuItemStats = await MenuItem.aggregate(pipeline);

    // Get category breakdown
    const categoryBreakdown = await MenuItem.aggregate([
      {
        $match: {
          facilityId,
          messType,
          isActive: true,
        },
      },
      {
        $group: {
          _id: "$category",
          itemCount: { $sum: 1 },
          avgRating: { $avg: "$averageRating" },
          totalRatings: { $sum: "$totalRatings" },
        },
      },
      {
        $sort: { avgRating: -1 },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        menuItems: menuItemStats,
        categoryBreakdown,
        dateRange: { start, end },
      },
    });
  } catch (error) {
    console.error("Get menu item analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Could not fetch menu item analytics",
    });
  }
};

// @desc    Get student engagement analytics
// @route   GET /api/analytics/engagement
// @access  Private (Mess Admin)
const getEngagementAnalytics = async (req, res) => {
  try {
    const facilityId = req.user.facilityId;
    const messType = req.user.messType;
    const { dateRange } = req.query;

    const { start, end } = parseDateRange(dateRange, 30);

    // Get overall engagement metrics
    const engagementMetrics = await Rating.aggregate([
      {
        $match: {
          facilityId,
          messType,
          mealDate: { $gte: start, $lte: end },
          isActive: true,
        },
      },
      {
        $group: {
          _id: null,
          totalRatings: { $sum: 1 },
          uniqueStudents: { $addToSet: "$student" },
          avgTimeSpent: { $avg: "$timeSpent" },
          reviewsWithText: {
            $sum: {
              $cond: [{ $ne: ["$review.text", null] }, 1, 0],
            },
          },
          reviewsWithPhotos: {
            $sum: {
              $cond: [{ $gt: [{ $size: "$photos" }, 0] }, 1, 0],
            },
          },
          ratingMethodBreakdown: {
            $push: "$ratingMethod",
          },
        },
      },
      {
        $addFields: {
          uniqueStudentCount: { $size: "$uniqueStudents" },
          textReviewRate: {
            $multiply: [
              { $divide: ["$reviewsWithText", "$totalRatings"] },
              100,
            ],
          },
          photoReviewRate: {
            $multiply: [
              { $divide: ["$reviewsWithPhotos", "$totalRatings"] },
              100,
            ],
          },
        },
      },
    ]);

    // Get engagement trends by day
    const dailyEngagement = await Rating.aggregate([
      {
        $match: {
          facilityId,
          messType,
          mealDate: { $gte: start, $lte: end },
          isActive: true,
        },
      },
      {
        $group: {
          _id: "$mealDate",
          totalRatings: { $sum: 1 },
          uniqueStudents: { $addToSet: "$student" },
          avgRating: { $avg: "$overallRating" },
        },
      },
      {
        $addFields: {
          uniqueStudentCount: { $size: "$uniqueStudents" },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Get most active students
    const activeStudents = await Rating.aggregate([
      {
        $match: {
          facilityId,
          messType,
          mealDate: { $gte: start, $lte: end },
          isActive: true,
        },
      },
      {
        $group: {
          _id: "$student",
          totalRatings: { $sum: 1 },
          avgRating: { $avg: "$overallRating" },
          reviewsCount: {
            $sum: {
              $cond: [{ $ne: ["$review.text", null] }, 1, 0],
            },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "student",
        },
      },
      {
        $unwind: "$student",
      },
      {
        $project: {
          name: "$student.name",
          totalRatings: 1,
          avgRating: 1,
          reviewsCount: 1,
        },
      },
      {
        $sort: { totalRatings: -1 },
      },
      {
        $limit: 10,
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: engagementMetrics[0] || {},
        dailyEngagement,
        activeStudents,
        dateRange: { start, end },
      },
    });
  } catch (error) {
    console.error("Get engagement analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Could not fetch engagement analytics",
    });
  }
};

// @desc    Export analytics data
// @route   GET /api/analytics/export
// @access  Private (Mess Admin)
const exportAnalytics = async (req, res) => {
  try {
    const facilityId = req.user.facilityId;
    const messType = req.user.messType;
    const { dateRange, type = "ratings" } = req.query;

    const { start, end } = parseDateRange(dateRange, 30);

    let data = [];
    let filename = "";

    switch (type) {
      case "ratings":
        data = await Rating.find({
          facilityId,
          messType,
          mealDate: { $gte: start, $lte: end },
          isActive: true,
        })
          .populate("student", "name studentId")
          .populate("menuItem", "name category")
          .select("overallRating categoryRatings mealType mealDate review")
          .lean();
        filename = `ratings_${facilityId}_${Date.now()}.json`;
        break;

      case "menu-performance":
        data = await MenuItem.find({
          facilityId,
          messType,
          isActive: true,
        })
          .select("name category averageRating totalRatings popularityScore")
          .lean();
        filename = `menu_performance_${facilityId}_${Date.now()}.json`;
        break;

      default:
        return res.status(400).json({
          success: false,
          message: "Invalid export type",
        });
    }

    res.status(200).json({
      success: true,
      data: {
        exportData: data,
        metadata: {
          type,
          dateRange: { start, end },
          recordCount: data.length,
          generatedAt: new Date(),
          facilityId,
          messType,
        },
      },
    });
  } catch (error) {
    console.error("Export analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Could not export analytics data",
    });
  }
};

module.exports = {
  getDashboardOverview,
  getMealAnalytics,
  getMenuItemAnalytics,
  getEngagementAnalytics,
  exportAnalytics,
};
