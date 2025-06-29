// backend/models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    role: {
      type: String,
      enum: ["student", "mess_admin"],
      required: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Common profile fields
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    phone: {
      type: String,
      trim: true,
      match: [/^[0-9]{10}$/, "Please enter a valid 10-digit phone number"],
    },
    profilePhoto: {
      url: String,
      public_id: String,
    },

    // NEW: College/Hostel ID fields
    collegeId: {
      type: String,
      trim: true,
      maxlength: [50, "College ID cannot exceed 50 characters"],
    },
    hostelId: {
      type: String,
      trim: true,
      maxlength: [50, "Hostel ID cannot exceed 50 characters"],
    },
    // New facility-based fields for students
    selectedFacility: {
      facilityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Facility",
      },
      facilityName: String,
      facilityType: {
        type: String,
        enum: ["college", "hostel"],
      },
    },
    selectedMess: {
      messId: String,
      messName: String,
    },
    course: {
      type: String,
      trim: true,
    },
    year: {
      type: Number,
      min: 1,
      max: 5,
    },

    // Mess Admin specific fields
    adminFacility: {
      facilityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Facility",
      },
      facilityName: String,
      facilityType: {
        type: String,
        enum: ["college", "hostel"],
      },
    },
    adminMess: {
      messId: String,
      messName: String,
    },

    // Verification tokens
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,

    // NEW: OTP fields for forgot password
    passwordResetOTP: String,
    passwordResetOTPExpires: Date,

    // Activity tracking
    lastLogin: Date,
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ "selectedMess.messId": 1 });
userSchema.index({ "adminMess.messId": 1 });
userSchema.index({ "selectedFacility.facilityId": 1 });
userSchema.index({ "adminFacility.facilityId": 1 });
userSchema.index({ collegeId: 1 }, { sparse: true });
userSchema.index({ hostelId: 1 }, { sparse: true });

// Virtual for account lock status
userSchema.virtual("isLocked").get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Virtual for active facility (works for both student and admin)
userSchema.virtual("activeFacility").get(function () {
  if (this.role === "student") {
    return this.selectedFacility;
  } else if (this.role === "mess_admin") {
    return this.adminFacility;
  }
  return null;
});

// Virtual for active mess (works for both student and admin)
userSchema.virtual("activeMess").get(function () {
  if (this.role === "student") {
    return this.selectedMess;
  } else if (this.role === "mess_admin") {
    return this.adminMess;
  }
  return null;
});

// Pre-save middleware to hash password
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to increment login attempts
userSchema.methods.incLoginAttempts = function () {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 },
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };

  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = {
      lockUntil: Date.now() + 2 * 60 * 60 * 1000, // 2 hours
    };
  }

  return this.updateOne(updates);
};

// Method to reset login attempts
userSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 },
  });
};

// Method to set student facility and mess
userSchema.methods.setFacilityAndMess = function (facilityData, messData) {
  if (this.role !== "student") {
    throw new Error("Only students can set facility and mess");
  }

  this.selectedFacility = {
    facilityId: facilityData.facilityId,
    facilityName: facilityData.facilityName,
    facilityType: facilityData.facilityType,
  };

  this.selectedMess = {
    messId: messData.messId,
    messName: messData.messName,
  };
};

// Method to set admin facility and mess
userSchema.methods.setAdminFacilityAndMess = function (facilityData, messData) {
  if (this.role !== "mess_admin") {
    throw new Error("Only mess admins can set admin facility and mess");
  }

  this.adminFacility = {
    facilityId: facilityData.facilityId,
    facilityName: facilityData.facilityName,
    facilityType: facilityData.facilityType,
  };

  this.adminMess = {
    messId: messData.messId,
    messName: messData.messName,
  };
};

// Static method to find active users
userSchema.statics.findActive = function () {
  return this.find({ isActive: true });
};

// Static method to find students by mess
userSchema.statics.findStudentsByMess = function (messId) {
  return this.find({
    role: "student",
    "selectedMess.messId": messId,
    isActive: true,
  });
};

// Static method to find mess admins by mess
userSchema.statics.findAdminsByMess = function (messId) {
  return this.find({
    role: "mess_admin",
    "adminMess.messId": messId,
    isActive: true,
  });
};

// Static method to find users by facility
userSchema.statics.findByFacility = function (facilityId, role = null) {
  const query = { isActive: true };

  if (role === "student") {
    query.role = "student";
    query["selectedFacility.facilityId"] = facilityId;
  } else if (role === "mess_admin") {
    query.role = "mess_admin";
    query["adminFacility.facilityId"] = facilityId;
  } else {
    // Both roles
    query.$or = [
      { role: "student", "selectedFacility.facilityId": facilityId },
      { role: "mess_admin", "adminFacility.facilityId": facilityId },
    ];
  }

  return this.find(query);
};

module.exports = mongoose.model("User", userSchema);
