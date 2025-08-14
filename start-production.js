#!/usr/bin/env node

/**
 * Production Startup Script for Productivity Management System
 * 
 * This script handles the complete production startup process including:
 * - Environment validation
 * - Database connectivity testing
 * - Service initialization
 * - Health monitoring setup
 * - Graceful shutdown handling
 */

require('dotenv').config({ path: '.env.production' });

const cluster = require('cluster');
const os = require('os');
const path = require('path');
const fs = require('fs');

// Import services
const DatabaseService = require('./src/services/DatabaseService');
const RedisService = require('./src/services/RedisService');
const { logger } = require('./src/middleware/errorHandler');

// Configuration
const PORT = process.env.PORT || 5000;
const WORKERS = process.env.WORKERS || os.cpus().length;
const ENABLE_CLUSTERING = process.env.ENABLE_CLUSTERING === 'true';

// Startup banner
function displayBanner() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║        🚀 PRODUCTIVITY MANAGEMENT SYSTEM - PRODUCTION        ║
║                                                              ║
║  Enterprise-grade business management platform               ║
║  with 11 integrated modules and Supabase backend            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `);
}

// Environment validation
function validateEnvironment() {
  console.log('🔍 Validating production environment...');
  
  const requiredVars = [
    'NODE_ENV',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars);
    process.exit(1);
  }

  // Check for default/insecure values
  const insecureDefaults = [
    { var: 'JWT_SECRET', default: 'prod_jwt_secret_change_this' },
    { var: 'JWT_REFRESH_SECRET', default: 'prod_refresh_secret_also_change_this' }
  ];

  const insecureVars = insecureDefaults.filter(({ var, default: defaultVal }) => 
    process.env[var].includes(defaultVal)
  );

  if (insecureVars.length > 0) {
    console.error('🚨 SECURITY WARNING: Default secrets detected!');
    console.error('Please change these environment variables:', insecureVars.map(v => v.var));
    process.exit(1);
  }

  console.log('✅ Environment validation passed');
}

// Create necessary directories
function createDirectories() {
  console.log('📁 Creating necessary directories...');
  
  const directories = ['logs', 'uploads', 'public', 'backups'];
  
  directories.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`   Created: ${dir}/`);
    }
  });
  
  console.log('✅ Directories ready');
}

// Test database connectivity
async function testDatabaseConnection() {
  console.log('🗄️  Testing database connection...');
  
  try {
    await DatabaseService.initialize();
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Test cache connectivity (optional)
async function testCacheConnection() {
  console.log('🔄 Testing cache connection...');
  
  try {
    await RedisService.initialize();
    console.log('✅ Cache connection successful');
    return true;
  } catch (error) {
    console.warn('⚠️  Cache connection failed (continuing without cache):', error.message);
    return false;
  }
}

// Worker process
function startWorker() {
  const app = require('./server-production');
  
  const server = app.listen(PORT, () => {
    console.log(`🌟 Worker ${process.pid} started on port ${PORT}`);
    
    // Log startup information
    logger.info('Production server started', {
      pid: process.pid,
      port: PORT,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    });
  });

  // Graceful shutdown for worker
  process.on('SIGTERM', () => {
    console.log(`🛑 Worker ${process.pid} received SIGTERM, shutting down gracefully...`);
    
    server.close(async () => {
      try {
        await DatabaseService.close();
        await RedisService.close();
        console.log(`✅ Worker ${process.pid} shut down successfully`);
        process.exit(0);
      } catch (error) {
        console.error(`❌ Error during worker ${process.pid} shutdown:`, error);
        process.exit(1);
      }
    });
  });

  return server;
}

// Master process
async function startMaster() {
  displayBanner();
  
  console.log(`🏭 Starting production server in ${ENABLE_CLUSTERING ? 'cluster' : 'single'} mode...`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🌐 Port: ${PORT}`);
  console.log(`💻 Workers: ${ENABLE_CLUSTERING ? WORKERS : 1}`);
  
  // Validate environment
  validateEnvironment();
  
  // Create directories
  createDirectories();
  
  // Test connections
  const dbConnected = await testDatabaseConnection();
  if (!dbConnected) {
    console.error('❌ Cannot start without database connection');
    process.exit(1);
  }
  
  await testCacheConnection();
  
  if (ENABLE_CLUSTERING && cluster.isMaster) {
    console.log(`🔄 Starting ${WORKERS} workers...`);
    
    // Fork workers
    for (let i = 0; i < WORKERS; i++) {
      cluster.fork();
    }
    
    // Handle worker events
    cluster.on('exit', (worker, code, signal) => {
      console.log(`💀 Worker ${worker.process.pid} died (${signal || code}). Restarting...`);
      cluster.fork();
    });
    
    cluster.on('online', (worker) => {
      console.log(`✅ Worker ${worker.process.pid} is online`);
    });
    
    // Graceful shutdown for master
    process.on('SIGTERM', () => {
      console.log('🛑 Master received SIGTERM, shutting down workers...');
      
      for (const id in cluster.workers) {
        cluster.workers[id].kill();
      }
    });
    
    console.log('🎉 Production cluster started successfully!');
    console.log(`📱 Application: ${process.env.CLIENT_URL || `http://localhost:${PORT}`}`);
    console.log(`📚 API Docs: ${process.env.API_URL || `http://localhost:${PORT}/api`}-docs`);
    console.log(`🔍 Health Check: ${process.env.API_URL || `http://localhost:${PORT}`}/health`);
    
  } else {
    // Single process mode or worker process
    startWorker();
    
    if (!ENABLE_CLUSTERING) {
      console.log('🎉 Production server started successfully!');
      console.log(`📱 Application: ${process.env.CLIENT_URL || `http://localhost:${PORT}`}`);
      console.log(`📚 API Docs: ${process.env.API_URL || `http://localhost:${PORT}/api`}-docs`);
      console.log(`🔍 Health Check: ${process.env.API_URL || `http://localhost:${PORT}`}/health`);
    }
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  logger.error('Unhandled Rejection', { reason, promise });
  process.exit(1);
});

// Start the application
if (require.main === module) {
  startMaster().catch(error => {
    console.error('❌ Failed to start production server:', error);
    process.exit(1);
  });
}

module.exports = { startMaster, startWorker };
