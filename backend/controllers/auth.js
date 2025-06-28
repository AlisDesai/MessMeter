// backend/controllers/auth.js
const User = require("../models/User");
const Facility = require("../models/Facility");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });
};

// Set token cookie
const sendTokenResponse = (user, statusCode, res, message = "Success") => {
  const token = generateToken(user._id);

  const options = {
    expires: new Date(
      Date.now() + (process.env.JWT_COOKIE_EXPIRE || 7) * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  };

  // Remove password from output
  user.password = undefined;

  res
    .status(statusCode)
    .cookie("token", token, options)
    .json({
      success: true,
      message,
      token,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified,
          isActive: user.isActive,
          profilePhoto: user.profilePhoto,
          ...(user.role === "student" && {
            studentId: user.studentId,
            selectedFacility: user.selectedFacility,
            selectedMess: user.selectedMess,
            course: user.course,
            year: user.year,
            collegeId: user.collegeId,
            hostelId: user.hostelId,
          }),
          ...(user.role === "mess_admin" && {
            adminFacility: user.adminFacility,
            adminMess: user.adminMess,
          }),
        },
      },
    });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const {
      email,
      password,
      name,
      phone,
      role,
      // Student fields
      selectedFacilityId,
      selectedMessId,
      course,
      year,
      collegeId,
      hostelId,
      // Mess admin fields
      adminFacilityId,
      adminMessId,
      // New facility/mess creation for admin
      facilityName,
      facilityType,
      messName,
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    // Create user object
    const userData = {
      email,
      password,
      name,
      phone,
      role,
    };

    let facilityData = null;
    let messData = null;

    // Handle role-specific fields
    if (role === "student") {
      userData.course = course;
      userData.year = year;

      // Get facility and mess details for student
      if (selectedFacilityId && selectedMessId) {
        const facility = await Facility.findById(selectedFacilityId);
        if (!facility) {
          return res.status(400).json({
            success: false,
            message: "Selected facility not found",
          });
        }

        const mess = facility.messes.find((m) => m.messId === selectedMessId);
        if (!mess) {
          return res.status(400).json({
            success: false,
            message: "Selected mess not found",
          });
        }

        userData.selectedFacility = {
          facilityId: facility._id,
          facilityName: facility.name,
          facilityType: facility.type,
        };

        userData.selectedMess = {
          messId: mess.messId,
          messName: mess.name,
        };

        // Handle college/hostel IDs based on facility type
        if (facility.type === "college" && collegeId) {
          userData.collegeId = collegeId.trim();
        } else if (facility.type === "hostel" && hostelId) {
          userData.hostelId = hostelId.trim();
        }
      }
    } else if (role === "mess_admin") {
      // Handle admin registration
      if (adminFacilityId && adminMessId) {
        // Admin selecting existing facility/mess
        const facility = await Facility.findById(adminFacilityId);
        if (!facility) {
          return res.status(400).json({
            success: false,
            message: "Selected facility not found",
          });
        }

        const mess = facility.messes.find((m) => m.messId === adminMessId);
        if (!mess) {
          return res.status(400).json({
            success: false,
            message: "Selected mess not found",
          });
        }

        userData.adminFacility = {
          facilityId: facility._id,
          facilityName: facility.name,
          facilityType: facility.type,
        };

        userData.adminMess = {
          messId: mess.messId,
          messName: mess.name,
        };
      } else if (facilityName && facilityType && messName) {
        // Admin creating new facility/mess

        // Check if facility name already exists
        const existingFacility = await Facility.findOne({
          name: { $regex: new RegExp(`^${facilityName}$`, "i") },
          isActive: true,
        });

        let facility;
        let messId;

        if (existingFacility) {
          // Add mess to existing facility
          try {
            messId = existingFacility.addMess({
              name: messName,
              description: `${messName} - Managed by ${name}`,
              operatingHours: {
                breakfast: { start: "08:00", end: "11:00" },
                lunch: { start: "12:00", end: "16:00" },
                dinner: { start: "19:00", end: "23:00" },
              },
            });
            await existingFacility.save();
            facility = existingFacility;
          } catch (error) {
            return res.status(400).json({
              success: false,
              message: error.message,
            });
          }
        } else {
          // Create new facility with mess
          messId = `${facilityName
            .toLowerCase()
            .replace(/\s+/g, "_")}_${messName
            .toLowerCase()
            .replace(/\s+/g, "_")}_${Date.now()}`;

          facility = await Facility.create({
            name: facilityName,
            type: facilityType,
            messes: [
              {
                name: messName,
                messId,
                description: `${messName} - Managed by ${name}`,
                operatingHours: {
                  breakfast: { start: "08:00", end: "11:00" },
                  lunch: { start: "12:00", end: "16:00" },
                  dinner: { start: "19:00", end: "23:00" },
                },
              },
            ],
          });
        }

        const mess = facility.messes.find((m) => m.messId === messId);

        userData.adminFacility = {
          facilityId: facility._id,
          facilityName: facility.name,
          facilityType: facility.type,
        };

        userData.adminMess = {
          messId: mess.messId,
          messName: mess.name,
        };
      } else {
        return res.status(400).json({
          success: false,
          message:
            "Mess admin must either select existing facility/mess or create new ones",
        });
      }
    }

    // Create user
    const user = await User.create(userData);

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    user.emailVerificationToken = crypto
      .createHash("sha256")
      .update(verificationToken)
      .digest("hex");
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await user.save({ validateBeforeSave: false });

    // TODO: Send verification email
    // await sendVerificationEmail(user.email, verificationToken);

    sendTokenResponse(
      user,
      201,
      res,
      "User registered successfully. Please verify your email."
    );
  } catch (error) {
    console.error("Registration error:", error);

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
      message: "Registration failed. Please try again.",
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(423).json({
        success: false,
        message:
          "Account temporarily locked due to too many failed login attempts",
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account has been deactivated",
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      // Increment login attempts
      await user.incLoginAttempts();
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Reset login attempts on successful login
    if (user.loginAttempts > 0) {
      await user.resetLoginAttempts();
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    sendTokenResponse(user, 200, res, "Login successful");
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed. Please try again.",
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
  try {
    res.cookie("token", "none", {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({
      success: false,
      message: "Could not fetch user data",
    });
  }
};

// @desc    Update user details
// @route   PUT /api/auth/updatedetails
// @access  Private
const updateDetails = async (req, res) => {
  try {
    const fieldsToUpdate = {
      name: req.body.name,
      phone: req.body.phone,
    };

    // Role-specific field updates
    if (req.user.role === "student") {
      if (req.body.course) fieldsToUpdate.course = req.body.course;
      if (req.body.year) fieldsToUpdate.year = req.body.year;
      if (req.body.collegeId) fieldsToUpdate.collegeId = req.body.collegeId;
      if (req.body.hostelId) fieldsToUpdate.hostelId = req.body.hostelId;
    }

    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: { user },
    });
  } catch (error) {
    console.error("Update details error:", error);

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
      message: "Could not update profile",
    });
  }
};

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private
const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide current and new password",
      });
    }

    const user = await User.findById(req.user.id).select("+password");

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    user.password = newPassword;
    await user.save();

    sendTokenResponse(user, 200, res, "Password updated successfully");
  } catch (error) {
    console.error("Update password error:", error);
    res.status(500).json({
      success: false,
      message: "Could not update password",
    });
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgotpassword
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No user found with that email",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    user.passwordResetToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    await user.save({ validateBeforeSave: false });

    // TODO: Send reset email
    // await sendPasswordResetEmail(user.email, resetToken);

    res.status(200).json({
      success: true,
      message: "Password reset email sent",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Email could not be sent",
    });
  }
};

// @desc    Reset password
// @route   PUT /api/auth/resetpassword/:resettoken
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { password } = req.body;

    // Hash the token from URL
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(req.params.resettoken)
      .digest("hex");

    const user = await User.findOne({
      passwordResetToken: resetPasswordToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    // Set new password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save();

    sendTokenResponse(user, 200, res, "Password reset successful");
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Password reset failed",
    });
  }
};

// @desc    Verify email
// @route   GET /api/auth/verify/:token
// @access  Public
const verifyEmail = async (req, res) => {
  try {
    const verificationToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    const user = await User.findOne({
      emailVerificationToken: verificationToken,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification token",
      });
    }

    user.isVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;

    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({
      success: false,
      message: "Email verification failed",
    });
  }
};

module.exports = {
  register,
  login,
  logout,
  getMe,
  updateDetails,
  updatePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
};
