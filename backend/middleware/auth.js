const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Protect routes
const authenticate = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    // Set token from Bearer token in header
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.token) {
    // Set token from cookie
    token = req.cookies.token;
  }

  // Make sure token exists
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Not authorized to access this route",
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from token
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Not authorized to access this route",
    });
  }
};

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`,
      });
    }
    next();
  };
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.token) {
    token = req.cookies.token;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
    } catch (error) {
      // Ignore errors for optional auth
    }
  }

  next();
};

// Check if user can access their own resources
const checkStudentAccess = async (req, res, next) => {
  try {
    const { ratingId } = req.params;

    // For now, just pass through - add your logic here later
    // You can add checks like: rating belongs to current user, etc.
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error checking student access",
    });
  }
};

// Check if user has access to facility resources
const checkFacilityAccess = async (req, res, next) => {
  try {
    // Check if user has facility assigned
    if (
      !req.user.adminFacility?.facilityId &&
      !req.user.selectedFacility?.facilityId
    ) {
      return res.status(403).json({
        success: false,
        message: "No facility assigned to user",
      });
    }

    // For mess admin, check if they have access to the facility
    if (req.user.role === "mess_admin" && !req.user.adminMess?.messId) {
      return res.status(403).json({
        success: false,
        message: "No mess type assigned to user",
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error checking facility access",
    });
  }
};

module.exports = {
  authenticate,
  authorize,
  optionalAuth,
  checkStudentAccess,
  checkFacilityAccess,
};
