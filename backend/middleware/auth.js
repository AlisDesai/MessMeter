// backend/middleware/auth.js
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
  } else if (req.cookies && req.cookies.token) {
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

    // Add facility information to req.user for easy access
    // CORRECTED: Ensure facilityId always refers to the actual ID.
    if (req.user.role === "mess_admin") {
      req.user.facilityId = req.user.adminFacility?.facilityId; 
      req.user.messType = req.user.adminFacility?.facilityType === "hostel" ? "hostel_mess" : "college_mess";
    } else if (req.user.role === "student") {
      req.user.facilityId = req.user.selectedFacility?.facilityId;
      req.user.messType = req.user.selectedFacility?.facilityType === "hostel" ? "hostel_mess" : "college_mess";
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
      
      // Add facility information for optional auth too
      // CORRECTED: Ensure facilityId always refers to the actual ID.
      if (req.user && req.user.role === "mess_admin") {
        req.user.facilityId = req.user.adminFacility?.facilityId;
        req.user.messType = req.user.adminFacility?.facilityType === "hostel" ? "hostel_mess" : "college_mess";
      } else if (req.user && req.user.role === "student") {
        req.user.facilityId = req.user.selectedFacility?.facilityId;
        req.user.messType = req.user.selectedFacility?.facilityType === "hostel" ? "hostel_mess" : "college_mess";
      }
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
    const hasFacility = req.user.facilityId || 
                         req.user.adminFacility?.facilityId || 
                         req.user.adminFacility?.facilityName || // This line still allows facilityName for the initial check, but facilityId is used in the middleware itself.
                         req.user.selectedFacility?.facilityId || 
                         req.user.selectedFacility?.facilityName; // This line still allows facilityName for the initial check, but facilityId is used in the middleware itself.

    if (!hasFacility) {
      return res.status(400).json({
        success: false,
        message: "Facility ID and mess type are required",
      });
    }

    // For mess admin, check if they have mess type
    if (req.user.role === "mess_admin") {
      const hasMessAccess = req.user.messType || 
                            req.user.adminMess?.messId || 
                            req.user.adminFacility?.facilityType;

      if (!hasMessAccess) {
        return res.status(400).json({
          success: false,
          message: "Facility ID and mess type are required",
        });
      }
    }

    next();
  } catch (error) {
    console.error("Error in checkFacilityAccess:", error);
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