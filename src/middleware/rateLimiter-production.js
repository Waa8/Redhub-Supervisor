const rateLimit = require('express-rate-limit');

// General API rate limiter
const apiRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000 || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX) || 1000, // limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later',
    error: {
      type: 'RateLimitError',
      retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW) || 15) * 60),
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health' || req.path === '/health';
  }
});

// Strict rate limiter for authentication endpoints
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_AUTH_MAX) || 10, // limit each IP to 10 auth requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later',
    error: {
      type: 'AuthRateLimitError',
      retryAfter: 15 * 60, // 15 minutes
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // Don't count successful requests
});

// Very strict rate limiter for sensitive operations
const strictRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each IP to 5 requests per hour
  message: {
    success: false,
    message: 'Too many sensitive operation attempts, please try again later',
    error: {
      type: 'StrictRateLimitError',
      retryAfter: 60 * 60, // 1 hour
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

// File upload rate limiter
const uploadRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 uploads per minute
  message: {
    success: false,
    message: 'Too many file uploads, please try again later',
    error: {
      type: 'UploadRateLimitError',
      retryAfter: 60,
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Search rate limiter
const searchRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // limit each IP to 60 search requests per minute
  message: {
    success: false,
    message: 'Too many search requests, please try again later',
    error: {
      type: 'SearchRateLimitError',
      retryAfter: 60,
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Export rate limiter
const exportRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // limit each IP to 20 exports per hour
  message: {
    success: false,
    message: 'Too many export requests, please try again later',
    error: {
      type: 'ExportRateLimitError',
      retryAfter: 60 * 60,
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Dynamic rate limiter based on user role
const createRoleBasedRateLimiter = (limits) => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: (req) => {
      if (!req.user) return 100; // Default for unauthenticated users
      
      const userRole = req.user.role;
      return limits[userRole] || limits.default || 100;
    },
    keyGenerator: (req) => {
      // Use user ID if authenticated, otherwise IP
      return req.user ? `user:${req.user.id}` : req.ip;
    },
    message: {
      success: false,
      message: 'Rate limit exceeded for your user role',
      error: {
        type: 'RoleBasedRateLimitError',
        timestamp: new Date().toISOString()
      }
    },
    standardHeaders: true,
    legacyHeaders: false
  });
};

// User-specific rate limiter
const userRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute per user
  keyGenerator: (req) => {
    return req.user ? `user:${req.user.id}` : req.ip;
  },
  message: {
    success: false,
    message: 'Too many requests from this user account',
    error: {
      type: 'UserRateLimitError',
      retryAfter: 60,
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip for admins
    return req.user && req.user.role === 'admin';
  }
});

// Organization-based rate limiter
const organizationRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // 1000 requests per minute per organization
  keyGenerator: (req) => {
    return req.user && req.user.currentOrganizationId 
      ? `org:${req.user.currentOrganizationId}` 
      : req.ip;
  },
  message: {
    success: false,
    message: 'Organization rate limit exceeded',
    error: {
      type: 'OrganizationRateLimitError',
      retryAfter: 60,
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Create rate limiter for specific endpoints
const createEndpointRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message,
      error: {
        type: 'EndpointRateLimitError',
        retryAfter: Math.ceil(windowMs / 1000),
        timestamp: new Date().toISOString()
      }
    },
    standardHeaders: true,
    legacyHeaders: false
  });
};

// Predefined role-based limits
const roleBasedApiLimiter = createRoleBasedRateLimiter({
  admin: 5000,      // 5000 requests per 15 minutes
  manager: 2000,    // 2000 requests per 15 minutes
  agent: 1000,      // 1000 requests per 15 minutes
  representative: 800,
  customer: 200,
  warehouse_manager: 1500,
  financial_manager: 1200,
  logistics_coordinator: 1000,
  default: 100      // Default for unknown roles
});

module.exports = {
  apiRateLimiter,
  authRateLimiter,
  strictRateLimiter,
  uploadRateLimiter,
  searchRateLimiter,
  exportRateLimiter,
  userRateLimiter,
  organizationRateLimiter,
  roleBasedApiLimiter,
  createRoleBasedRateLimiter,
  createEndpointRateLimiter
};
