// backend/models/Facility.js
const mongoose = require("mongoose");

const facilitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Facility name is required"],
      trim: true,
      unique: true,
      maxlength: [100, "Facility name cannot exceed 100 characters"],
    },
    type: {
      type: String,
      enum: ["college", "hostel"],
      required: [true, "Facility type is required"],
    },
    location: {
      address: String,
      city: String,
      state: String,
      pincode: String,
    },
    contactInfo: {
      phone: String,
      email: String,
      website: String,
    },
    messes: [
      {
        name: {
          type: String,
          required: [true, "Mess name is required"],
          trim: true,
          maxlength: [100, "Mess name cannot exceed 100 characters"],
        },
        messId: {
          type: String,
          required: true,
          unique: true,
          trim: true,
        },
        description: String,
        capacity: Number,
        operatingHours: {
          breakfast: {
            start: String, // "07:00"
            end: String, // "10:00"
          },
          lunch: {
            start: String, // "12:00"
            end: String, // "15:00"
          },
          dinner: {
            start: String, // "19:00"
            end: String, // "22:00"
          },
        },
        isActive: {
          type: Boolean,
          default: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
facilitySchema.index({ name: 1, type: 1 });
facilitySchema.index({ "messes.messId": 1 });
facilitySchema.index({ "messes.name": 1 });
facilitySchema.index({ type: 1, isActive: 1 });

// Virtual for active messes count
facilitySchema.virtual("activeMessesCount").get(function () {
  return this.messes.filter((mess) => mess.isActive).length;
});

// Method to add new mess
facilitySchema.methods.addMess = function (messData) {
  const messId = `${this.name
    .toLowerCase()
    .replace(/\s+/g, "_")}_${messData.name
    .toLowerCase()
    .replace(/\s+/g, "_")}_${Date.now()}`;

  // Check if mess name already exists in this facility
  const existingMess = this.messes.find(
    (mess) =>
      mess.name.toLowerCase() === messData.name.toLowerCase() && mess.isActive
  );

  if (existingMess) {
    throw new Error("Mess with this name already exists in this facility");
  }

  this.messes.push({
    ...messData,
    messId,
    createdAt: new Date(),
  });

  return messId;
};

// Method to update mess
facilitySchema.methods.updateMess = function (messId, updateData) {
  const mess = this.messes.find((m) => m.messId === messId);
  if (!mess) {
    throw new Error("Mess not found");
  }

  Object.keys(updateData).forEach((key) => {
    if (updateData[key] !== undefined) {
      mess[key] = updateData[key];
    }
  });

  return mess;
};

// Method to deactivate mess
facilitySchema.methods.deactivateMess = function (messId) {
  const mess = this.messes.find((m) => m.messId === messId);
  if (!mess) {
    throw new Error("Mess not found");
  }

  mess.isActive = false;
  return mess;
};

// Static method to find facilities by type
facilitySchema.statics.findByType = function (type) {
  return this.find({ type, isActive: true }).select("name type messes");
};

// Static method to find facility by mess ID
facilitySchema.statics.findByMessId = function (messId) {
  return this.findOne({
    "messes.messId": messId,
    "messes.isActive": true,
    isActive: true,
  });
};

// Static method to get all active facilities with their messes
facilitySchema.statics.getAllWithMesses = function () {
  return this.aggregate([
    { $match: { isActive: true } },
    { $unwind: "$messes" },
    { $match: { "messes.isActive": true } },
    {
      $group: {
        _id: {
          facilityId: "$_id",
          facilityName: "$name",
          facilityType: "$type",
        },
        messes: {
          $push: {
            messId: "$messes.messId",
            messName: "$messes.name",
            description: "$messes.description",
            capacity: "$messes.capacity",
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        facilityId: "$_id.facilityId",
        facilityName: "$_id.facilityName",
        facilityType: "$_id.facilityType",
        messes: 1,
      },
    },
    { $sort: { facilityName: 1 } },
  ]);
};

// Static method to check if mess name is unique within facility
facilitySchema.statics.isMessNameUnique = async function (
  facilityId,
  messName,
  excludeMessId = null
) {
  const facility = await this.findById(facilityId);
  if (!facility) return false;

  const existingMess = facility.messes.find(
    (mess) =>
      mess.name.toLowerCase() === messName.toLowerCase() &&
      mess.isActive &&
      (excludeMessId ? mess.messId !== excludeMessId : true)
  );

  return !existingMess;
};

module.exports = mongoose.model("Facility", facilitySchema);
