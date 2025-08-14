const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Initialize Supabase client only if environment variables are available
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

// Demo users for authentication
const demoUsers = [
  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    username: 'admin',
    email: 'admin@demo.com',
    password_hash: '$2a$12$RdG2qkLn7JlTldjuZyiVQu2KQspUa6h9gdkSHfqTwMjbXl/xPtaa.',
    first_name: 'Admin',
    last_name: 'User',
    role: 'admin',
    is_active: true
  },
  {
    id: 'b2c3d4e5-f6g7-8901-bcde-f23456789012',
    username: 'manager',
    email: 'manager@demo.com',
    password_hash: '$2a$12$RdG2qkLn7JlTldjuZyiVQu2KQspUa6h9gdkSHfqTwMjbXl/xPtaa.',
    first_name: 'Manager',
    last_name: 'User',
    role: 'manager',
    is_active: true
  },
  {
    id: 'c3d4e5f6-g7h8-9012-cdef-345678901234',
    username: 'agent',
    email: 'agent@demo.com',
    password_hash: '$2a$12$RdG2qkLn7JlTldjuZyiVQu2KQspUa6h9gdkSHfqTwMjbXl/xPtaa.',
    first_name: 'Agent',
    last_name: 'User',
    role: 'agent',
    is_active: true
  }
];

// Helper function to generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role
    },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '24h' }
  );
};

// Helper function to validate JWT token
const validateToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
  } catch (error) {
    return null;
  }
};

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  const path = event.path.replace('/.netlify/functions/auth', '');
  const method = event.httpMethod;

  try {
    // Login endpoint
    if (path === '/login' && method === 'POST') {
      const { username, password } = JSON.parse(event.body);

      if (!username || !password) {
        return {
          statusCode: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            message: 'Username and password are required'
          })
        };
      }

      // Find user
      const user = demoUsers.find(u => u.username === username || u.email === username);

      if (!user) {
        return {
          statusCode: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            message: 'Invalid credentials'
          })
        };
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);

      if (!isValidPassword) {
        return {
          statusCode: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            message: 'Invalid credentials'
          })
        };
      }

      // Generate token
      const accessToken = generateToken(user);

      // Return success response
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          data: {
            accessToken,
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              first_name: user.first_name,
              last_name: user.last_name,
              role: user.role
            }
          }
        })
      };
    }

    // Profile endpoint
    if (path === '/profile' && method === 'GET') {
      const authHeader = event.headers.authorization || event.headers.Authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return {
          statusCode: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            message: 'Authorization token required'
          })
        };
      }

      const token = authHeader.substring(7);
      const decoded = validateToken(token);

      if (!decoded) {
        return {
          statusCode: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            message: 'Invalid or expired token'
          })
        };
      }

      // Find user
      const user = demoUsers.find(u => u.id === decoded.userId);

      if (!user) {
        return {
          statusCode: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            message: 'User not found'
          })
        };
      }

      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          data: {
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              first_name: user.first_name,
              last_name: user.last_name,
              role: user.role
            }
          }
        })
      };
    }

    // Health check
    if (path === '/health' && method === 'GET') {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: 'Auth service is healthy',
          timestamp: new Date().toISOString()
        })
      };
    }

    // Route not found
    return {
      statusCode: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        message: 'Route not found'
      })
    };

  } catch (error) {
    console.error('Auth function error:', error);
    
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};
