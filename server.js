const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

// Import route modules
const authRoutes = require('./src/routes/auth');
const taskRoutes = require('./src/routes/tasks');
const orderRoutes = require('./src/routes/orders');
const logisticsRoutes = require('./src/routes/logistics');
const warehouseRoutes = require('./src/routes/warehouse');
const financialRoutes = require('./src/routes/financial');
const customerServiceRoutes = require('./src/routes/customer-service');
const representativeRoutes = require('./src/routes/representatives');
const reportsRoutes = require('./src/routes/reports');

// Import middleware
const authMiddleware = require('./src/middleware/auth');
const errorHandler = require('./src/middleware/errorHandler');
const rateLimiter = require('./src/middleware/rateLimiter');

// Import services
const DatabaseService = require('./src/services/DatabaseService');
const RedisService = require('./src/services/RedisService');
const SocketService = require('./src/services/SocketService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  }
}));

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Compression and logging
app.use(compression());
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use('/api/', rateLimiter);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', authMiddleware, taskRoutes);
app.use('/api/orders', authMiddleware, orderRoutes);
app.use('/api/logistics', authMiddleware, logisticsRoutes);
app.use('/api/warehouse', authMiddleware, warehouseRoutes);
app.use('/api/financial', authMiddleware, financialRoutes);
app.use('/api/customer-service', authMiddleware, customerServiceRoutes);
app.use('/api/representatives', authMiddleware, representativeRoutes);
app.use('/api/reports', authMiddleware, reportsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API documentation
if (process.env.NODE_ENV !== 'production') {
  const swaggerJsdoc = require('swagger-jsdoc');
  const swaggerUi = require('swagger-ui-express');
  
  const swaggerOptions = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Comprehensive Productivity App API',
        version: '1.0.0',
        description: 'Advanced productivity app with order management, logistics, warehouse, financial, and customer service modules'
      },
      servers: [
        {
          url: process.env.API_URL || 'http://localhost:5000/api',
          description: 'Development server'
        }
      ]
    },
    apis: ['./src/routes/*.js']
  };
  
  const specs = swaggerJsdoc(swaggerOptions);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
}

// Serve React app for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use(errorHandler);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Initialize socket service
  SocketService.handleConnection(socket, io);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    SocketService.handleDisconnection(socket);
  });
});

// Initialize services
async function initializeServices() {
  try {
    // Initialize database
    await DatabaseService.initialize();
    console.log('Database connected successfully');
    
    // Initialize Redis
    await RedisService.initialize();
    console.log('Redis connected successfully');
    
    // Initialize Socket service
    SocketService.initialize(io);
    console.log('Socket service initialized');
    
    return true;
  } catch (error) {
    console.error('Service initialization failed:', error);
    return false;
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  
  server.close(() => {
    console.log('HTTP server closed');
    
    // Close database connections
    DatabaseService.close();
    RedisService.close();
    
    process.exit(0);
  });
});

// Start server
const PORT = process.env.PORT || 5000;

initializeServices().then((success) => {
  if (success) {
    server.listen(PORT, () => {
      console.log(`🚀 Comprehensive Productivity App running on port ${PORT}`);
      console.log(`📊 API Documentation: http://localhost:${PORT}/api-docs`);
      console.log(`🌐 Application: http://localhost:${PORT}`);
    });
  } else {
    console.error('Failed to initialize services. Exiting...');
    process.exit(1);
  }
});

module.exports = { app, server, io };
