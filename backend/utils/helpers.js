// backend/utils/helpers.js
const crypto = require("crypto");

// Generate random string
const generateRandomString = (length = 32) => {
  return crypto.randomBytes(length).toString("hex");
};

// Generate hash from string
const generateHash = (str) => {
  return crypto.createHash("sha256").update(str).digest("hex");
};

// Format date to YYYY-MM-DD
const formatDate = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Get start and end of day
const getStartOfDay = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
};

const getEndOfDay = (date) => {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
};

// Get week date range
const getWeekRange = (date = new Date()) => {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

// Get month date range
const getMonthRange = (date = new Date()) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );
  return { start, end };
};

// Calculate rating average
const calculateRatingAverage = (ratings) => {
  if (!ratings || ratings.length === 0) return 0;
  const sum = ratings.reduce((acc, rating) => acc + rating, 0);
  return Math.round((sum / ratings.length) * 100) / 100;
};

// Calculate category averages
const calculateCategoryAverages = (ratings) => {
  if (!ratings || ratings.length === 0) {
    return {
      taste: 0,
      quantity: 0,
      freshness: 0,
      value: 0,
    };
  }

  const totals = ratings.reduce(
    (acc, rating) => {
      acc.taste += rating.categoryRatings?.taste || 0;
      acc.quantity += rating.categoryRatings?.quantity || 0;
      acc.freshness += rating.categoryRatings?.freshness || 0;
      acc.value += rating.categoryRatings?.value || 0;
      return acc;
    },
    { taste: 0, quantity: 0, freshness: 0, value: 0 }
  );

  return {
    taste: Math.round((totals.taste / ratings.length) * 100) / 100,
    quantity: Math.round((totals.quantity / ratings.length) * 100) / 100,
    freshness: Math.round((totals.freshness / ratings.length) * 100) / 100,
    value: Math.round((totals.value / ratings.length) * 100) / 100,
  };
};

// Calculate participation rate
const calculateParticipationRate = (totalRatings, expectedStudents) => {
  if (!expectedStudents || expectedStudents === 0) return 0;
  return Math.round((totalRatings / expectedStudents) * 100);
};

// Get meal time slots
const getMealTimeSlots = () => {
  return {
    breakfast: { start: "06:00", end: "10:00" },
    lunch: { start: "12:00", end: "15:00" },
    dinner: { start: "19:00", end: "22:00" },
    snack: { start: "16:00", end: "18:00" },
  };
};

// Determine current meal type based on time
const getCurrentMealType = (time = new Date()) => {
  const hour = time.getHours();

  if (hour >= 6 && hour < 10) return "breakfast";
  if (hour >= 12 && hour < 15) return "lunch";
  if (hour >= 16 && hour < 18) return "snack";
  if (hour >= 19 && hour < 22) return "dinner";

  // Default based on proximity
  if (hour >= 0 && hour < 6) return "dinner"; // Late night
  if (hour >= 10 && hour < 12) return "breakfast"; // Late breakfast
  if (hour >= 15 && hour < 16) return "lunch"; // Late lunch
  if (hour >= 18 && hour < 19) return "snack"; // Late snack

  return "dinner"; // Default
};

// Format number with commas
const formatNumber = (num) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

// Calculate percentage
const calculatePercentage = (value, total) => {
  if (!total || total === 0) return 0;
  return Math.round((value / total) * 100);
};

// Get rating distribution
const getRatingDistribution = (ratings) => {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  ratings.forEach((rating) => {
    const score = Math.round(rating.overallRating || rating);
    if (score >= 1 && score <= 5) {
      distribution[score]++;
    }
  });

  return distribution;
};

// Generate pagination info
const getPaginationInfo = (page, limit, total) => {
  const currentPage = parseInt(page) || 1;
  const itemsPerPage = parseInt(limit) || 20;
  const totalPages = Math.ceil(total / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, total);

  return {
    currentPage,
    itemsPerPage,
    totalPages,
    totalItems: total,
    startIndex,
    endIndex,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
    nextPage: currentPage < totalPages ? currentPage + 1 : null,
    previousPage: currentPage > 1 ? currentPage - 1 : null,
  };
};

// Validate date range
const isValidDateRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return start <= end && !isNaN(start.getTime()) && !isNaN(end.getTime());
};

// Get date range from query
const parseDateRange = (dateRangeStr, defaultDays = 30) => {
  if (!dateRangeStr) {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - defaultDays);
    return { start, end };
  }

  const [startStr, endStr] = dateRangeStr.split(",");
  const start = new Date(startStr);
  const end = new Date(endStr);

  if (isValidDateRange(start, end)) {
    return { start, end };
  }

  // Fallback to default range
  const defaultEnd = new Date();
  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() - defaultDays);
  return { start: defaultStart, end: defaultEnd };
};

// Sanitize filename
const sanitizeFilename = (filename) => {
  return filename.replace(/[^a-zA-Z0-9.-]/g, "_").toLowerCase();
};

// Generate unique filename
const generateUniqueFilename = (originalName) => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const extension = originalName.split(".").pop();
  const baseName = originalName.split(".")[0];

  return `${sanitizeFilename(baseName)}_${timestamp}_${random}.${extension}`;
};

// Check if user is active during meal time
const isActiveMealTime = (mealType, currentTime = new Date()) => {
  const slots = getMealTimeSlots();
  const slot = slots[mealType];

  if (!slot) return false;

  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;

  const [startHour, startMinute] = slot.start.split(":").map(Number);
  const [endHour, endMinute] = slot.end.split(":").map(Number);

  const startTimeInMinutes = startHour * 60 + startMinute;
  const endTimeInMinutes = endHour * 60 + endMinute;

  return (
    currentTimeInMinutes >= startTimeInMinutes &&
    currentTimeInMinutes <= endTimeInMinutes
  );
};

// Calculate time until next meal
const getTimeUntilNextMeal = (currentTime = new Date()) => {
  const slots = getMealTimeSlots();
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

  const mealTimes = Object.entries(slots)
    .map(([meal, slot]) => {
      const [hour, minute] = slot.start.split(":").map(Number);
      return {
        meal,
        startMinutes: hour * 60 + minute,
        ...slot,
      };
    })
    .sort((a, b) => a.startMinutes - b.startMinutes);

  // Find next meal
  for (const meal of mealTimes) {
    if (meal.startMinutes > currentMinutes) {
      const minutesUntil = meal.startMinutes - currentMinutes;
      return {
        meal: meal.meal,
        minutesUntil,
        hoursUntil: Math.floor(minutesUntil / 60),
        startTime: meal.start,
      };
    }
  }

  // Next meal is tomorrow's first meal
  const firstMeal = mealTimes[0];
  const minutesUntil = 24 * 60 - currentMinutes + firstMeal.startMinutes;

  return {
    meal: firstMeal.meal,
    minutesUntil,
    hoursUntil: Math.floor(minutesUntil / 60),
    startTime: firstMeal.start,
    isTomorrow: true,
  };
};

// Calculate menu item popularity score
const calculatePopularityScore = (
  averageRating,
  totalRatings,
  maxRatings = 100
) => {
  const ratingWeight = 0.7;
  const volumeWeight = 0.3;

  const normalizedVolume = Math.min(totalRatings / maxRatings, 1);
  const normalizedRating = averageRating / 5;

  return normalizedRating * ratingWeight + normalizedVolume * volumeWeight;
};

// Format time duration
const formatDuration = (minutes) => {
  if (minutes < 60) {
    return `${minutes} min${minutes !== 1 ? "s" : ""}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} hour${hours !== 1 ? "s" : ""}`;
  }

  return `${hours}h ${remainingMinutes}m`;
};

// Generate random color
const generateRandomColor = () => {
  const colors = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#96CEB4",
    "#FFEAA7",
    "#DDA0DD",
    "#98D8C8",
    "#F7DC6F",
    "#BB8FCE",
    "#85C1E9",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

module.exports = {
  generateRandomString,
  generateHash,
  formatDate,
  getStartOfDay,
  getEndOfDay,
  getWeekRange,
  getMonthRange,
  calculateRatingAverage,
  calculateCategoryAverages,
  calculateParticipationRate,
  getMealTimeSlots,
  getCurrentMealType,
  formatNumber,
  calculatePercentage,
  getRatingDistribution,
  getPaginationInfo,
  isValidDateRange,
  parseDateRange,
  sanitizeFilename,
  generateUniqueFilename,
  isActiveMealTime,
  getTimeUntilNextMeal,
  calculatePopularityScore,
  formatDuration,
  generateRandomColor,
};
