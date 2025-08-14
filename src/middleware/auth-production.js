const jwt = require('jsonwebtoken');
const DatabaseService = require('../services/DatabaseService');
const { UnauthorizedError, ForbiddenError } = require('./errorHandler');

// Production authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Access token required');
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: 'productivity-app',
        audience: 'productivity-app-users'
      });
      
      // Get user from database with organization info
      const user = await DatabaseService.findById('users', decoded.id);
      
      if (!user || !user.is_active) {
        throw new UnauthorizedError('Invalid or expired token');
      }

      // Check if account is locked
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        throw new ForbiddenError('Account is temporarily locked');
      }

      // Get user's organizations
      const userOrganizations = await DatabaseService.findWithJoins('user_organizations',
        [{ table: 'organizations', select: 'id, name, slug, is_active' }],
        { user_id: user.id, is_active: true }
      );

      // Add user and organization info to request
      req.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        department: user.department,
        position: user.position,
        timezone: user.timezone,
        language: user.language,
        preferences: user.preferences,
        organizations: userOrganizations.map(uo => ({
          id: uo.organizations.id,
          name: uo.organizations.name,
          slug: uo.organizations.slug,
          role: uo.role,
          isActive: uo.organizations.is_active
        })),
        currentOrganizationId: decoded.organizationId
      };

      next();
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Token has expired');
      } else if (jwtError.name === 'JsonWebTokenError') {
        throw new UnauthorizedError('Invalid token');
      } else {
        throw new UnauthorizedError('Token verification failed');
      }
    }

  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        error: {
          type: error.name,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

// Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      if (roles.length > 0) {
        // Check global role
        const hasGlobalRole = roles.includes(req.user.role);
        
        // Check organization-specific role
        const hasOrgRole = req.user.organizations?.some(org => 
          org.id === req.user.currentOrganizationId && roles.includes(org.role)
        );

        if (!hasGlobalRole && !hasOrgRole) {
          throw new ForbiddenError('Insufficient permissions for this action');
        }
      }

      next();
    } catch (error) {
      if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
          error: {
            type: error.name,
            timestamp: new Date().toISOString()
          }
        });
      }
      
      next(error);
    }
  };
};

// Organization access middleware
const requireOrganization = (req, res, next) => {
  try {
    if (!req.user.currentOrganizationId) {
      throw new ForbiddenError('Organization context required');
    }

    const hasAccess = req.user.organizations?.some(org => 
      org.id === req.user.currentOrganizationId && org.isActive
    );

    if (!hasAccess) {
      throw new ForbiddenError('Access denied to this organization');
    }

    next();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        error: {
          type: error.name,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    next(error);
  }
};

// Resource ownership middleware
const requireOwnership = (resourceIdParam = 'id', allowedRoles = ['admin', 'manager']) => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[resourceIdParam];
      
      if (!resourceId) {
        throw new ForbiddenError('Resource ID required');
      }

      // Allow if user has admin/manager role
      if (allowedRoles.includes(req.user.role)) {
        return next();
      }

      // Check if user owns the resource (implementation depends on resource type)
      // This is a generic check - specific routes should implement their own logic
      req.resourceId = resourceId;
      next();
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
          error: {
            type: error.name,
            timestamp: new Date().toISOString()
          }
        });
      }
      
      next(error);
    }
  };
};

// Optional authentication (for public endpoints that can benefit from user context)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await DatabaseService.findById('users', decoded.id);
        
        if (user && user.is_active) {
          req.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            currentOrganizationId: decoded.organizationId
          };
        }
      } catch (jwtError) {
        // Ignore JWT errors for optional auth
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};

module.exports = {
  authenticate,
  authorize,
  requireOrganization,
  requireOwnership,
  optionalAuth,
  // Legacy exports for backward compatibility
  authMiddleware: authenticate
};
