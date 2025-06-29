// backend/middleware/timeRestriction.js
const validateMealTime = (req, res, next) => {
  try {
    const { mealType } = req.body;
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour + currentMinute / 60;

    // Define meal time windows
    const mealTimes = {
      breakfast: { start: 8, end: 11 }, // 8 AM - 11 AM
      lunch: { start: 12, end: 16 }, // 12 PM - 4 PM
      dinner: { start: 19, end: 23 }, // 7 PM - 11 PM
    };

    if (!mealType || !mealTimes[mealType.toLowerCase()]) {
      return res.status(400).json({
        success: false,
        message: "Invalid meal type. Must be breakfast, lunch, or dinner",
      });
    }

    const meal = mealTimes[mealType.toLowerCase()];

    if (currentTime < meal.start || currentTime > meal.end) {
      const startTime = formatTime(meal.start);
      const endTime = formatTime(meal.end);

      return res.status(400).json({
        success: false,
        message: `You can only review ${mealType} between ${startTime} and ${endTime}`,
      });
    }

    next();
  } catch (error) {
    console.error("Time validation error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during time validation",
    });
  }
};

// Helper function to format time
const formatTime = (hour) => {
  if (hour === 0) return "12:00 AM";
  if (hour < 12) return `${hour}:00 AM`;
  if (hour === 12) return "12:00 PM";
  return `${hour - 12}:00 PM`;
};

module.exports = { validateMealTime };
