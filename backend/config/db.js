// backend/config/db.js
const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const mongoURI =
      process.env.NODE_ENV === "production"
        ? process.env.MONGODB_URI_PROD
        : process.env.MONGODB_URI;

    const conn = await mongoose.connect(mongoURI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error.message);
    throw error;
  }
};

// Setup connection event listeners
const setupConnectionEvents = () => {
  // Connection successful
  mongoose.connection.on("connected", () => {
    console.log("🔗 Mongoose connected to MongoDB");
  });

  // Connection error
  mongoose.connection.on("error", (err) => {
    console.error("❌ Mongoose connection error:", err.message);
  });

  // Connection disconnected
  mongoose.connection.on("disconnected", () => {
    console.log("📴 Mongoose disconnected from MongoDB");
  });

  // If Node process ends, close mongoose connection
  process.on("SIGINT", async () => {
    try {
      await mongoose.connection.close();
      console.log("🔒 Mongoose connection closed through app termination");
      process.exit(0);
    } catch (error) {
      console.error("❌ Error closing mongoose connection:", error.message);
      process.exit(1);
    }
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (err) => {
    console.error("💥 Unhandled Promise Rejection:", err.message);
    if (process.env.NODE_ENV === "production") {
      // Close server gracefully
      process.exit(1);
    }
  });
};

// Get human-readable connection state
const getConnectionState = (state) => {
  const states = {
    0: "Disconnected",
    1: "Connected",
    2: "Connecting",
    3: "Disconnecting",
  };
  return states[state] || "Unknown";
};

// Graceful disconnect function
const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    console.log("🔒 MongoDB connection closed gracefully");
  } catch (error) {
    console.error("❌ Error closing MongoDB connection:", error.message);
    throw error;
  }
};

// Check if database is connected
const isConnected = () => {
  return mongoose.connection.readyState === 1;
};

// Get database statistics
const getDatabaseStats = async () => {
  try {
    if (!isConnected()) {
      throw new Error("Database not connected");
    }

    const admin = mongoose.connection.db.admin();
    const stats = await admin.serverStatus();

    return {
      host: stats.host,
      version: stats.version,
      uptime: stats.uptime,
      connections: stats.connections,
      memory: stats.mem,
      network: stats.network,
    };
  } catch (error) {
    console.error("❌ Error getting database stats:", error.message);
    throw error;
  }
};

// Database health check
const healthCheck = async () => {
  try {
    if (!isConnected()) {
      return { status: "disconnected", message: "Database not connected" };
    }

    // Simple ping to check if database is responsive
    await mongoose.connection.db.admin().ping();

    return {
      status: "healthy",
      message: "Database is connected and responsive",
      database: mongoose.connection.name,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      message: error.message,
    };
  }
};

// Export functions
module.exports = {
  connectDB,
  disconnectDB,
  isConnected,
  getDatabaseStats,
  healthCheck,
  getConnectionState: () => getConnectionState(mongoose.connection.readyState),
};
