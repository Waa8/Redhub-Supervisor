const rateLimit = require('express-rate-limit');
const { RateLimiterRedis } = require('rate-limiter-flexible');
const RedisService = require('../services/RedisService');

// Basic rate limiter using express-rate-limit
const basicRateLimiter = rateLimit({
  windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX || 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    error: {
      type: 'TooManyRequestsError',
      retryAfter: Math.ceil((process.env.RATE_LIMIT_WINDOW || 15) * 60)
    }
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health';
  }
});

// Advanced rate limiter using Redis (if available)
let advancedRateLimiter = null;

if (RedisService.isInitialized) {
  advancedRateLimiter = new RateLimiterRedis({
    storeClient: RedisService.client,
    keyPrefix: 'rate_limit',
    points: 100, // Number of requests
    duration: 900, // Per 15 minutes (900 seconds)
    blockDuration: 900, // Block for 15 minutes if limit exceeded
    execEvenly: true // Execute requests evenly across duration
  });
}

// Authentication rate limiter (stricter for auth endpoints)
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
    error: {
      type: 'TooManyRequestsError',
      retryAfter: 900
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // Don't count successful requests
});

// API rate limiter middleware
const apiRateLimiter = async (req, res, next) => {
  try {
    // Use advanced rate limiter if Redis is available
    if (advancedRateLimiter) {
      const key = req.ip + ':' + (req.user?.id || 'anonymous');
      
      try {
        await advancedRateLimiter.consume(key);
        next();
      } catch (rejRes) {
        const remainingPoints = rejRes.remainingPoints || 0;
        const msBeforeNext = rejRes.msBeforeNext || 0;
        
        res.set({
          'Retry-After': Math.round(msBeforeNext / 1000) || 1,
          'X-RateLimit-Limit': 100,
          'X-RateLimit-Remaining': remainingPoints,
          'X-RateLimit-Reset': new Date(Date.now() + msBeforeNext)
        });
        
        return res.status(429).json({
          success: false,
          message: 'Rate limit exceeded',
          error: {
            type: 'TooManyRequestsError',
            retryAfter: Math.round(msBeforeNext / 1000),
            remainingPoints,
            resetTime: new Date(Date.now() + msBeforeNext)
          }
        });
      }
    } else {
      // Fallback to basic rate limiter
      basicRateLimiter(req, res, next);
    }
  } catch (error) {
    console.error('Rate limiter error:', error);
    // Continue without rate limiting if there's an error
    next();
  }
};

// User-specific rate limiter
const userRateLimiter = (points = 1000, duration = 3600) => {
  return async (req, res, next) => {
    if (!req.user?.id) {
      return next();
    }

    try {
      if (advancedRateLimiter) {
        const userLimiter = new RateLimiterRedis({
          storeClient: RedisService.client,
          keyPrefix: 'user_rate_limit',
          points,
          duration,
          blockDuration: duration,
          execEvenly: true
        });

        const key = req.user.id;
        await userLimiter.consume(key);
      }
      
      next();
    } catch (rejRes) {
      const remainingPoints = rejRes.remainingPoints || 0;
      const msBeforeNext = rejRes.msBeforeNext || 0;
      
      res.set({
        'Retry-After': Math.round(msBeforeNext / 1000) || 1,
        'X-RateLimit-Limit': points,
        'X-RateLimit-Remaining': remainingPoints,
        'X-RateLimit-Reset': new Date(Date.now() + msBeforeNext)
      });
      
      return res.status(429).json({
        success: false,
        message: 'User rate limit exceeded',
        error: {
          type: 'TooManyRequestsError',
          retryAfter: Math.round(msBeforeNext / 1000),
          remainingPoints,
          resetTime: new Date(Date.now() + msBeforeNext)
        }
      });
    }
  };
};

// Endpoint-specific rate limiters
const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Very strict limit
  message: {
    success: false,
    message: 'Rate limit exceeded for this endpoint',
    error: {
      type: 'TooManyRequestsError',
      retryAfter: 900
    }
  }
});

const moderateRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Moderate limit
  message: {
    success: false,
    message: 'Rate limit exceeded for this endpoint',
    error: {
      type: 'TooManyRequestsError',
      retryAfter: 900
    }
  }
});

// Export rate limiters
module.exports = {
  apiRateLimiter,
  authRateLimiter,
  userRateLimiter,
  strictRateLimiter,
  moderateRateLimiter,
  basicRateLimiter
};
