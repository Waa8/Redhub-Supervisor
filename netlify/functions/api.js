const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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

// Demo data for various endpoints
const demoData = {
  tasks: [
    {
      id: '1',
      title: 'Setup Production Environment',
      description: 'Configure and deploy the production environment with all necessary services',
      status: 'completed',
      priority: 'high',
      progress: 100,
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString()
    },
    {
      id: '2',
      title: 'Process Customer Orders',
      description: 'Review and process pending customer orders from the queue',
      status: 'in_progress',
      priority: 'medium',
      progress: 60,
      due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString()
    },
    {
      id: '3',
      title: 'Update Customer Database',
      description: 'Clean and update customer contact information in the database',
      status: 'pending',
      priority: 'low',
      progress: 0,
      due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString()
    }
  ],
  customers: [
    {
      id: '1',
      name: 'ABC Corporation',
      email: 'contact@abc-corp.com',
      phone: '+1-555-0101',
      customer_type: 'business',
      tier: 'gold',
      created_at: new Date().toISOString()
    },
    {
      id: '2',
      name: 'John Smith',
      email: 'john.smith@email.com',
      phone: '+1-555-0102',
      customer_type: 'individual',
      tier: 'silver',
      created_at: new Date().toISOString()
    }
  ],
  orders: [
    {
      id: '1',
      customer_id: '1',
      order_number: 'ORD-001',
      status: 'processing',
      total_amount: 1250.00,
      items_count: 3,
      created_at: new Date().toISOString()
    },
    {
      id: '2',
      customer_id: '2',
      order_number: 'ORD-002',
      status: 'shipped',
      total_amount: 750.50,
      items_count: 2,
      created_at: new Date().toISOString()
    }
  ]
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

  const path = event.path.replace('/.netlify/functions/api', '');
  const method = event.httpMethod;

  try {
    // Authentication check for protected routes
    const protectedRoutes = ['/tasks', '/customers', '/orders', '/financial', '/logistics', '/warehouse'];
    const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route));

    if (isProtectedRoute) {
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
    }

    // Health check
    if (path === '/health' && method === 'GET') {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: 'API service is healthy',
          services: {
            database: process.env.SUPABASE_URL ? 'connected' : 'not configured',
            ai: process.env.DEEPSEEK_API_KEY ? 'connected' : 'not configured',
            mapping: process.env.MAPBOX_ACCESS_TOKEN ? 'connected' : 'not configured'
          },
          timestamp: new Date().toISOString()
        })
      };
    }

    // Tasks endpoint
    if (path === '/tasks' && method === 'GET') {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          data: {
            tasks: demoData.tasks,
            total: demoData.tasks.length,
            page: 1,
            limit: 10
          }
        })
      };
    }

    // Customers endpoint
    if (path === '/customers' && method === 'GET') {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          data: {
            customers: demoData.customers,
            total: demoData.customers.length,
            page: 1,
            limit: 10
          }
        })
      };
    }

    // Orders endpoint
    if (path === '/orders' && method === 'GET') {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          data: {
            orders: demoData.orders,
            total: demoData.orders.length,
            page: 1,
            limit: 10
          }
        })
      };
    }

    // AI Services status
    if (path === '/ai/status' && method === 'GET') {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          data: {
            aiServiceEnabled: !!process.env.DEEPSEEK_API_KEY,
            deepseekConnected: !!process.env.DEEPSEEK_API_KEY,
            availableFeatures: [
              'task-enhancement',
              'ticket-response-generation',
              'order-pattern-analysis',
              'inventory-optimization',
              'performance-insights'
            ]
          }
        })
      };
    }

    // Mapping Services status
    if (path === '/mapping/status' && method === 'GET') {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          data: {
            mappingServiceEnabled: !!process.env.MAPBOX_ACCESS_TOKEN,
            mapboxConnected: !!process.env.MAPBOX_ACCESS_TOKEN,
            availableFeatures: [
              'geocoding',
              'reverse-geocoding',
              'route-calculation',
              'route-optimization',
              'delivery-zones',
              'distance-matrix',
              'delivery-time-estimation'
            ]
          }
        })
      };
    }

    // Default response for unhandled routes
    return {
      statusCode: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        message: 'API endpoint not found',
        path: path,
        method: method
      })
    };

  } catch (error) {
    console.error('API function error:', error);
    
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
