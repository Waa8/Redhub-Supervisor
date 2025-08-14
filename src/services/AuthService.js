const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const DatabaseService = require('./DatabaseService');
const { ValidationError, UnauthorizedError, ForbiddenError } = require('../middleware/errorHandler');

class AuthService {
  static async hashPassword(password) {
    // Validate password strength
    if (!this.validatePasswordStrength(password)) {
      throw new ValidationError('Password must be at least 8 characters with uppercase, lowercase, numbers, and special characters');
    }
    
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    return await bcrypt.hash(password, saltRounds);
  }

  static async comparePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  static validatePasswordStrength(password) {
    // Production password requirements
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    return password.length >= minLength && 
           hasUpperCase && 
           hasLowerCase && 
           hasNumbers && 
           hasSpecialChar;
  }

  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validateUsername(username) {
    // Username: 3-30 characters, alphanumeric and underscores only
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    return usernameRegex.test(username);
  }

  static generateTokens(user, organizationId = null) {
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      organizationId: organizationId,
      iat: Math.floor(Date.now() / 1000)
    };

    const accessToken = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { 
        expiresIn: process.env.JWT_EXPIRES_IN || '8h',
        issuer: 'productivity-app',
        audience: 'productivity-app-users'
      }
    );

    const refreshToken = jwt.sign(
      { 
        id: user.id,
        tokenId: uuidv4(),
        iat: Math.floor(Date.now() / 1000)
      },
      process.env.JWT_REFRESH_SECRET,
      { 
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        issuer: 'productivity-app',
        audience: 'productivity-app-users'
      }
    );

    return { accessToken, refreshToken };
  }

  static verifyToken(token, isRefreshToken = false) {
    try {
      const secret = isRefreshToken ? process.env.JWT_REFRESH_SECRET : process.env.JWT_SECRET;
      return jwt.verify(token, secret, {
        issuer: 'productivity-app',
        audience: 'productivity-app-users'
      });
    } catch (error) {
      throw new UnauthorizedError('Invalid or expired token');
    }
  }

  static async login(credentials, organizationId = null) {
    const { username, email, password } = credentials;
    
    if (!password) {
      throw new ValidationError('Password is required');
    }

    if (!username && !email) {
      throw new ValidationError('Username or email is required');
    }

    try {
      // Find user by username or email
      let user;
      if (email) {
        const users = await DatabaseService.findByField('users', 'email', email.toLowerCase());
        user = users[0];
      } else {
        const users = await DatabaseService.findByField('users', 'username', username.toLowerCase());
        user = users[0];
      }

      if (!user) {
        throw new UnauthorizedError('Invalid credentials');
      }

      if (!user.is_active) {
        throw new ForbiddenError('Account is deactivated');
      }

      // Check if account is locked
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        throw new ForbiddenError('Account is temporarily locked due to multiple failed login attempts');
      }

      // Verify password
      const isValidPassword = await this.comparePassword(password, user.password_hash);
      
      if (!isValidPassword) {
        // Increment login attempts
        await this.handleFailedLogin(user.id);
        throw new UnauthorizedError('Invalid credentials');
      }

      // Check organization membership if specified
      if (organizationId) {
        const membership = await DatabaseService.findByField('user_organizations', 'user_id', user.id);
        const orgMembership = membership.find(m => m.organization_id === organizationId && m.is_active);
        
        if (!orgMembership) {
          throw new ForbiddenError('User does not have access to this organization');
        }
      }

      // Reset login attempts on successful login
      await DatabaseService.update('users', user.id, {
        login_attempts: 0,
        locked_until: null,
        last_login: new Date()
      });

      // Generate tokens
      const tokens = this.generateTokens(user, organizationId);

      // Remove sensitive data
      const { password_hash, ...safeUser } = user;

      return {
        user: safeUser,
        ...tokens
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof UnauthorizedError || error instanceof ForbiddenError) {
        throw error;
      }
      console.error('Login error:', error);
      throw new UnauthorizedError('Login failed');
    }
  }

  static async register(userData, organizationId = null) {
    const { 
      username, 
      email, 
      password, 
      firstName, 
      lastName, 
      phone, 
      role = 'agent',
      department,
      position 
    } = userData;

    // Validate required fields
    if (!username || !email || !password || !firstName || !lastName) {
      throw new ValidationError('Username, email, password, first name, and last name are required');
    }

    // Validate formats
    if (!this.validateUsername(username)) {
      throw new ValidationError('Username must be 3-30 characters, alphanumeric and underscores only');
    }

    if (!this.validateEmail(email)) {
      throw new ValidationError('Please provide a valid email address');
    }

    try {
      // Check if username or email already exists
      const existingUsers = await DatabaseService.findAll('users', {}, {
        select: 'id, username, email'
      });

      const usernameExists = existingUsers.some(u => u.username.toLowerCase() === username.toLowerCase());
      const emailExists = existingUsers.some(u => u.email.toLowerCase() === email.toLowerCase());

      if (usernameExists) {
        throw new ValidationError('Username already exists');
      }

      if (emailExists) {
        throw new ValidationError('Email already exists');
      }

      // Hash password
      const passwordHash = await this.hashPassword(password);

      // Create user
      const newUser = await DatabaseService.create('users', {
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        password_hash: passwordHash,
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        role: role,
        department: department || null,
        position: position || null,
        is_active: true,
        email_verified: false,
        phone_verified: false,
        preferences: {},
        timezone: process.env.DEFAULT_TIMEZONE || 'UTC',
        language: process.env.DEFAULT_LANGUAGE || 'en'
      });

      // Add to organization if specified
      if (organizationId) {
        await DatabaseService.create('user_organizations', {
          user_id: newUser.id,
          organization_id: organizationId,
          role: role,
          is_active: true
        });
      }

      // Generate tokens
      const tokens = this.generateTokens(newUser, organizationId);

      // Remove sensitive data
      const { password_hash, ...safeUser } = newUser;

      return {
        user: safeUser,
        ...tokens
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      console.error('Registration error:', error);
      throw new ValidationError('Registration failed');
    }
  }

  static async handleFailedLogin(userId) {
    try {
      const user = await DatabaseService.findById('users', userId);
      if (!user) return;

      const attempts = (user.login_attempts || 0) + 1;
      const updates = { login_attempts: attempts };

      // Lock account after 5 failed attempts for 30 minutes
      if (attempts >= 5) {
        updates.locked_until = new Date(Date.now() + 30 * 60 * 1000);
      }

      await DatabaseService.update('users', userId, updates);
    } catch (error) {
      console.error('Error handling failed login:', error);
    }
  }

  static async refreshToken(refreshToken) {
    try {
      const decoded = this.verifyToken(refreshToken, true);
      
      const user = await DatabaseService.findById('users', decoded.id);
      if (!user || !user.is_active) {
        throw new UnauthorizedError('Invalid refresh token');
      }

      // Generate new access token
      const { accessToken } = this.generateTokens(user);
      
      return { accessToken };
    } catch (error) {
      throw new UnauthorizedError('Invalid refresh token');
    }
  }

  static async getUserWithOrganizations(userId) {
    try {
      const user = await DatabaseService.findById('users', userId);
      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      // Get user's organizations
      const organizations = await DatabaseService.findWithJoins('user_organizations', 
        [{ table: 'organizations', select: 'id, name, slug' }],
        { user_id: userId, is_active: true }
      );

      const { password_hash, ...safeUser } = user;
      
      return {
        ...safeUser,
        organizations: organizations.map(uo => ({
          id: uo.organizations.id,
          name: uo.organizations.name,
          slug: uo.organizations.slug,
          role: uo.role
        }))
      };
    } catch (error) {
      console.error('Error getting user with organizations:', error);
      throw new UnauthorizedError('Failed to get user information');
    }
  }

  static async updateProfile(userId, profileData) {
    const { firstName, lastName, phone, timezone, language, preferences } = profileData;
    
    try {
      const updates = {};
      if (firstName) updates.first_name = firstName;
      if (lastName) updates.last_name = lastName;
      if (phone) updates.phone = phone;
      if (timezone) updates.timezone = timezone;
      if (language) updates.language = language;
      if (preferences) updates.preferences = preferences;

      const updatedUser = await DatabaseService.update('users', userId, updates);
      
      const { password_hash, ...safeUser } = updatedUser;
      return safeUser;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw new ValidationError('Failed to update profile');
    }
  }

  static async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await DatabaseService.findById('users', userId);
      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      // Verify current password
      const isValidPassword = await this.comparePassword(currentPassword, user.password_hash);
      if (!isValidPassword) {
        throw new UnauthorizedError('Current password is incorrect');
      }

      // Hash new password
      const newPasswordHash = await this.hashPassword(newPassword);

      // Update password
      await DatabaseService.update('users', userId, {
        password_hash: newPasswordHash
      });

      return { success: true };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof UnauthorizedError) {
        throw error;
      }
      console.error('Error changing password:', error);
      throw new ValidationError('Failed to change password');
    }
  }
}

module.exports = AuthService;
