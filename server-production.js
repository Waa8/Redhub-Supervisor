require('dotenv').config({ path: '.env.production' });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

// Import services
const DatabaseService = require('./src/services/DatabaseService');
const RedisService = require('./src/services/RedisService');
const AIService = require('./src/services/AIService');
const MapboxService = require('./src/services/MapboxService');

// Import middleware
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');
const { apiRateLimiter } = require('./src/middleware/rateLimiter-production');

// Import routes (start with existing working routes)
const authRoutes = require('./src/routes/auth');
const taskRoutes = require('./src/routes/tasks');
const orderRoutes = require('./src/routes/orders');
const financialRoutes = require('./src/routes/financial');
const logisticsRoutes = require('./src/routes/logistics');
const warehouseRoutes = require('./src/routes/warehouse');
const customerServiceRoutes = require('./src/routes/customer-service');
const representativeRoutes = require('./src/routes/representatives');
const reportRoutes = require('./src/routes/reports');
const aiServicesRoutes = require('./src/routes/ai-services');
const mappingServicesRoutes = require('./src/routes/mapping-services');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for accurate IP addresses behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https://fonts.googleapis.com", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      connectSrc: ["'self'", process.env.SUPABASE_URL]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.CLIENT_URL,
      'http://localhost:3000',
      'http://localhost:3001',
      'https://your-domain.com'
    ].filter(Boolean);

    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: process.env.CORS_CREDENTIALS === 'true',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Organization-ID']
};

app.use(cors(corsOptions));

// Compression middleware
app.use(compression());

// Request parsing middleware
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV === 'production') {
  // Create logs directory if it doesn't exist
  const logsDir = path.join(__dirname, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  app.use(morgan('combined', {
    stream: fs.createWriteStream(path.join(logsDir, 'access.log'), { flags: 'a' })
  }));
} else {
  app.use(morgan('dev'));
}

// Rate limiting
app.use('/api', apiRateLimiter);

// Health check endpoint (before authentication)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV,
    database: DatabaseService.isInitialized ? 'connected' : 'disconnected',
    cache: RedisService.isInitialized ? 'connected' : 'disconnected'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV,
    services: {
      database: DatabaseService.isInitialized ? 'connected' : 'disconnected',
      cache: RedisService.isInitialized ? 'connected' : 'disconnected'
    }
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/financial', financialRoutes);
app.use('/api/logistics', logisticsRoutes);
app.use('/api/warehouse', warehouseRoutes);
app.use('/api/customer-service', customerServiceRoutes);
app.use('/api/representatives', representativeRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/ai', aiServicesRoutes);
app.use('/api/mapping', mappingServicesRoutes);

// Serve static files
app.use(express.static('public', {
  maxAge: process.env.NODE_ENV === 'production' ? '1y' : '0',
  etag: true,
  lastModified: true
}));

// Serve uploaded files (with authentication)
app.use('/uploads', express.static('uploads', {
  maxAge: '1d',
  etag: true
}));

// Catch-all handler for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize services and start server
async function startServer() {
  try {
    console.log('🚀 Starting Productivity App Server...');
    console.log(`Environment: ${process.env.NODE_ENV}`);
    
    // Initialize database
    console.log('📊 Initializing database connection...');
    await DatabaseService.initialize();
    console.log('✅ Database connected successfully');

    // Initialize cache (optional)
    try {
      console.log('🔄 Initializing cache...');
      await RedisService.initialize();
      console.log('✅ Cache connected successfully');
    } catch (error) {
      console.warn('⚠️  Cache initialization failed, continuing without cache:', error.message);
    }

    // Initialize AI services (optional)
    try {
      console.log('🤖 Initializing AI services...');
      await AIService.initialize();
      console.log('✅ AI services connected successfully');
    } catch (error) {
      console.warn('⚠️  AI services initialization failed, continuing without AI:', error.message);
    }

    // Initialize mapping services (optional)
    try {
      console.log('🗺️  Initializing mapping services...');
      await MapboxService.initialize();
      console.log('✅ Mapping services connected successfully');
    } catch (error) {
      console.warn('⚠️  Mapping services initialization failed, continuing without mapping:', error.message);
    }

    // Start server
    const server = app.listen(PORT, () => {
      console.log(`🌟 Productivity App running on port ${PORT}`);
      console.log(`🌐 API URL: ${process.env.API_URL || `http://localhost:${PORT}/api`}`);
      console.log(`📱 Client URL: ${process.env.CLIENT_URL || `http://localhost:${PORT}`}`);
      console.log(`🔒 Environment: ${process.env.NODE_ENV}`);
      console.log('✅ Server started successfully');
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('🛑 SIGTERM received, shutting down gracefully...');
      
      server.close(async () => {
        console.log('📊 Closing database connections...');
        await DatabaseService.close();
        
        console.log('🔄 Closing cache connections...');
        await RedisService.close();
        
        console.log('✅ Server shut down successfully');
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      console.log('🛑 SIGINT received, shutting down gracefully...');
      
      server.close(async () => {
        await DatabaseService.close();
        await RedisService.close();
        console.log('✅ Server shut down successfully');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();

module.exports = app;
