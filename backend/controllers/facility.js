// backend/controllers/facility.js
const Facility = require("../models/Facility");

// @desc Get all facilities with their messes
// @route GET /api/facilities
// @access Public
const getAllFacilities = async (req, res) => {
  try {
    const facilities = await Facility.find({ isActive: true })
      .select("name type messes createdAt")
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: facilities.length,
      data: facilities,
    });
  } catch (error) {
    console.error("Get facilities error:", error);
    res.status(500).json({
      success: false,
      message: "Could not fetch facilities",
    });
  }
};

// @desc Get messes for a specific facility
// @route GET /api/facilities/messes?facility=SJ%20Hall
// @access Public
const getFacilityMesses = async (req, res) => {
  try {
    const { facility } = req.query;

    if (!facility) {
      return res.status(400).json({
        success: false,
        message: "Facility name is required",
      });
    }

    const facilityDoc = await Facility.findOne({
      name: facility,
      isActive: true,
    }).select("name messes");

    if (!facilityDoc) {
      return res.status(404).json({
        success: false,
        message: "Facility not found",
      });
    }

    const activeMesses = facilityDoc.messes.filter((mess) => mess.isActive);

    res.status(200).json({
      success: true,
      data: activeMesses,
    });
  } catch (error) {
    console.error("Get facility messes error:", error);
    res.status(500).json({
      success: false,
      message: "Could not fetch messes",
    });
  }
};

// @desc Create a new facility
// @route POST /api/facilities
// @access Private (Admin)
const createFacility = async (req, res) => {
  try {
    const { name, type, messName, description, location } = req.body;

    // Check if facility name already exists
    const existingFacility = await Facility.findOne({ name });
    if (existingFacility) {
      return res.status(400).json({
        success: false,
        message: "Facility with this name already exists",
      });
    }

    // Create facility with initial mess
    const facility = await Facility.create({
      name,
      type,
      description,
      location,
      messes: [
        {
          name: messName,
          description: `Main mess for ${name}`,
          capacity: 200, // Default capacity
          operatingHours: {
            breakfast: { start: "07:00", end: "10:00" },
            lunch: { start: "12:00", end: "15:00" },
            dinner: { start: "19:00", end: "22:00" },
          },
          isActive: true,
        },
      ],
      createdBy: req.user.id,
    });

    res.status(201).json({
      success: true,
      message: "Facility created successfully",
      data: facility,
    });
  } catch (error) {
    console.error("Create facility error:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Facility with this name already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Could not create facility",
    });
  }
};

// @desc Add mess to existing facility
// @route POST /api/facilities/add-mess
// @access Private (Admin)
const addMessToFacility = async (req, res) => {
  try {
    const { facilityName, messName, description, capacity, operatingHours } =
      req.body;

    const facility = await Facility.findOne({ name: facilityName });
    if (!facility) {
      return res.status(404).json({
        success: false,
        message: "Facility not found",
      });
    }

    // Check if mess name already exists in this facility
    const existingMess = facility.messes.find((mess) => mess.name === messName);
    if (existingMess) {
      return res.status(400).json({
        success: false,
        message: "Mess with this name already exists in this facility",
      });
    }

    // Add new mess
    facility.messes.push({
      name: messName,
      description: description || `${messName} at ${facilityName}`,
      capacity: capacity || 150,
      operatingHours: operatingHours || {
        breakfast: { start: "07:00", end: "10:00" },
        lunch: { start: "12:00", end: "15:00" },
        dinner: { start: "19:00", end: "22:00" },
      },
      isActive: true,
    });

    await facility.save();

    res.status(201).json({
      success: true,
      message: "Mess added successfully",
      data: facility,
    });
  } catch (error) {
    console.error("Add mess error:", error);
    res.status(500).json({
      success: false,
      message: "Could not add mess",
    });
  }
};

// @desc Update mess details
// @route PUT /api/facilities/mess
// @access Private (Admin)
const updateMess = async (req, res) => {
  try {
    const { facilityName, messName, updates } = req.body;

    const facility = await Facility.findOne({ name: facilityName });
    if (!facility) {
      return res.status(404).json({
        success: false,
        message: "Facility not found",
      });
    }

    const mess = facility.messes.find((m) => m.name === messName);
    if (!mess) {
      return res.status(404).json({
        success: false,
        message: "Mess not found",
      });
    }

    // Update mess fields
    Object.keys(updates).forEach((key) => {
      if (updates[key] !== undefined) {
        mess[key] = updates[key];
      }
    });

    await facility.save();

    res.status(200).json({
      success: true,
      message: "Mess updated successfully",
      data: mess,
    });
  } catch (error) {
    console.error("Update mess error:", error);
    res.status(500).json({
      success: false,
      message: "Could not update mess",
    });
  }
};

// @desc Get facility by mess name
// @route GET /api/facilities/by-mess?messName=SJ%20Mess
// @access Public
const getFacilityByMessName = async (req, res) => {
  try {
    const { messName } = req.query;

    if (!messName) {
      return res.status(400).json({
        success: false,
        message: "Mess name is required",
      });
    }

    const facility = await Facility.findOne({
      "messes.name": messName,
      "messes.isActive": true,
      isActive: true,
    });

    if (!facility) {
      return res.status(404).json({
        success: false,
        message: "Facility not found for this mess",
      });
    }

    const mess = facility.messes.find((m) => m.name === messName && m.isActive);

    res.status(200).json({
      success: true,
      data: {
        facility: {
          name: facility.name,
          type: facility.type,
        },
        mess,
      },
    });
  } catch (error) {
    console.error("Get facility by mess error:", error);
    res.status(500).json({
      success: false,
      message: "Could not fetch facility",
    });
  }
};

// @desc Check if facility name is available
// @route GET /api/facilities/check-name?name=SJ%20Hall
// @access Public
const checkFacilityName = async (req, res) => {
  try {
    const { name } = req.query;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Facility name is required",
      });
    }

    const existing = await Facility.findOne({ name });

    res.status(200).json({
      success: true,
      available: !existing,
      message: existing
        ? "Facility name already exists"
        : "Facility name is available",
    });
  } catch (error) {
    console.error("Check facility name error:", error);
    res.status(500).json({
      success: false,
      message: "Could not check facility name",
    });
  }
};

// @desc Check if mess name is available in facility
// @route GET /api/facilities/check-mess?facility=SJ%20Hall&mess=SJ%20Mess
// @access Public
const checkMessName = async (req, res) => {
  try {
    const { facility, mess } = req.query;

    if (!facility || !mess) {
      return res.status(400).json({
        success: false,
        message: "Both facility and mess names are required",
      });
    }

    const facilityDoc = await Facility.findOne({ name: facility });
    if (!facilityDoc) {
      return res.status(404).json({
        success: false,
        message: "Facility not found",
      });
    }

    const existingMess = facilityDoc.messes.find((m) => m.name === mess);

    res.status(200).json({
      success: true,
      available: !existingMess,
      message: existingMess
        ? "Mess name already exists in this facility"
        : "Mess name is available",
    });
  } catch (error) {
    console.error("Check mess name error:", error);
    res.status(500).json({
      success: false,
      message: "Could not check mess name",
    });
  }
};

module.exports = {
  getAllFacilities,
  getFacilityMesses,
  createFacility,
  addMessToFacility,
  updateMess,
  getFacilityByMessName,
  checkFacilityName,
  checkMessName,
};
