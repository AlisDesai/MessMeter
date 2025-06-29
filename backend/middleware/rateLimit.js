// backend/middleware/rateLimit.js
const rateLimit = require("express-rate-limit");

// General API rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
    retryAfter: 15 * 60, // 15 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many requests from this IP, please try again later.",
      retryAfter: Math.round(req.rateLimit.resetTime / 1000),
    });
  },
});

// Auth routes rate limiting (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth requests per windowMs
  message: {
    success: false,
    message:
      "Too many authentication attempts, please try again after 15 minutes.",
    retryAfter: 15 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message:
        "Too many authentication attempts, please try again after 15 minutes.",
      retryAfter: Math.round(req.rateLimit.resetTime / 1000),
    });
  },
});

// Password related operations (very strict)
const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit each IP to 3 password operations per windowMs
  message: {
    success: false,
    message: "Too many password attempts, please try again after 15 minutes.",
    retryAfter: 15 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many password attempts, please try again after 15 minutes.",
      retryAfter: Math.round(req.rateLimit.resetTime / 1000),
    });
  },
});

// Upload rate limiting
const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20, // Limit each IP to 20 uploads per windowMs
  message: {
    success: false,
    message: "Too many upload attempts, please try again later.",
    retryAfter: 10 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many upload attempts, please try again later.",
      retryAfter: Math.round(req.rateLimit.resetTime / 1000),
    });
  },
});

// Rating submission rate limiting
const ratingLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Limit each IP to 10 ratings per windowMs
  message: {
    success: false,
    message: "Too many rating submissions, please slow down.",
    retryAfter: 5 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise fall back to IP
    return req.user?.id || req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many rating submissions, please slow down.",
      retryAfter: Math.round(req.rateLimit.resetTime / 1000),
    });
  },
});

// Search/Query rate limiting
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 search requests per minute
  message: {
    success: false,
    message: "Too many search requests, please slow down.",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many search requests, please slow down.",
      retryAfter: Math.round(req.rateLimit.resetTime / 1000),
    });
  },
});

// Analytics rate limiting (for mess admins)
const analyticsLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // Limit each IP to 50 analytics requests per windowMs
  message: {
    success: false,
    message: "Too many analytics requests, please try again later.",
    retryAfter: 5 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many analytics requests, please try again later.",
      retryAfter: Math.round(req.rateLimit.resetTime / 1000),
    });
  },
});

// Create custom rate limiter
const createRateLimiter = (options) => {
  const {
    windowMs = 15 * 60 * 1000,
    max = 100,
    message = "Too many requests",
    skipSuccessfulRequests = false,
    useUserId = false,
  } = options;

  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message,
      retryAfter: Math.round(windowMs / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    keyGenerator: useUserId ? (req) => req.user?.id || req.ip : undefined,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message,
        retryAfter: Math.round(req.rateLimit.resetTime / 1000),
      });
    },
  });
};

// Sliding window rate limiter (more memory intensive but more accurate)
const slidingWindowLimiter = (windowMs, maxRequests) => {
  const requests = new Map();

  return (req, res, next) => {
    const key = req.user?.id || req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get existing requests for this key
    let userRequests = requests.get(key) || [];

    // Remove old requests outside the window
    userRequests = userRequests.filter((timestamp) => timestamp > windowStart);

    // Check if limit exceeded
    if (userRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: "Rate limit exceeded",
        retryAfter: Math.round((userRequests[0] + windowMs - now) / 1000),
      });
    }

    // Add current request
    userRequests.push(now);
    requests.set(key, userRequests);

    // Cleanup old entries periodically
    if (Math.random() < 0.01) {
      // 1% chance
      for (const [k, timestamps] of requests.entries()) {
        const filtered = timestamps.filter((ts) => ts > windowStart);
        if (filtered.length === 0) {
          requests.delete(k);
        } else {
          requests.set(k, filtered);
        }
      }
    }

    next();
  };
};

// Progressive rate limiting (increases delay for repeated violations)
const progressiveLimiter = (baseDelay = 1000) => {
  const violations = new Map();

  return (req, res, next) => {
    const key = req.user?.id || req.ip;
    const now = Date.now();

    const userViolations = violations.get(key) || {
      count: 0,
      lastViolation: 0,
    };

    // Reset count if enough time has passed
    if (now - userViolations.lastViolation > 60000) {
      // 1 minute
      userViolations.count = 0;
    }

    // Check if user should be delayed
    if (userViolations.count > 0) {
      const delay = baseDelay * Math.pow(2, userViolations.count - 1);
      const waitUntil = userViolations.lastViolation + delay;

      if (now < waitUntil) {
        return res.status(429).json({
          success: false,
          message: "Progressive rate limit active",
          retryAfter: Math.round((waitUntil - now) / 1000),
        });
      }
    }

    // Middleware to track violations
    const originalSend = res.send;
    res.send = function (data) {
      if (res.statusCode === 429) {
        userViolations.count++;
        userViolations.lastViolation = now;
        violations.set(key, userViolations);
      }
      return originalSend.call(this, data);
    };

    next();
  };
};

// IP whitelist rate limiter
const whitelistLimiter = (whitelist = []) => {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;

    // Skip rate limiting for whitelisted IPs
    if (whitelist.includes(clientIP)) {
      return next();
    }

    // Apply default rate limiting
    return apiLimiter(req, res, next);
  };
};

module.exports = {
  apiLimiter,
  authLimiter,
  passwordLimiter,
  uploadLimiter,
  ratingLimiter,
  searchLimiter,
  analyticsLimiter,
  createRateLimiter,
  slidingWindowLimiter,
  progressiveLimiter,
  whitelistLimiter,
};
