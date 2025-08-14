#!/bin/bash

# Production Deployment Script for Productivity Management System
# This script handles the complete production deployment process

set -e  # Exit on any error

echo "🚀 Starting Production Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="productivity-app"
BACKUP_DIR="./backups"
LOG_FILE="./logs/deployment.log"

# Create necessary directories
mkdir -p logs uploads public backups

# Function to log messages
log_message() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a $LOG_FILE
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a $LOG_FILE
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a $LOG_FILE
}

# Check prerequisites
check_prerequisites() {
    log_message "Checking prerequisites..."
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js version 18 or higher is required"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi
    
    # Check Docker (optional)
    if command -v docker &> /dev/null; then
        log_message "Docker detected - container deployment available"
    else
        log_warning "Docker not found - using direct deployment"
    fi
    
    log_message "Prerequisites check completed ✅"
}

# Validate environment configuration
validate_environment() {
    log_message "Validating environment configuration..."
    
    if [ ! -f ".env.production" ]; then
        log_error ".env.production file not found"
        log_message "Please copy .env to .env.production and update with production values"
        exit 1
    fi
    
    # Source environment file
    source .env.production
    
    # Check critical environment variables
    REQUIRED_VARS=(
        "NODE_ENV"
        "SUPABASE_URL"
        "SUPABASE_ANON_KEY"
        "JWT_SECRET"
        "JWT_REFRESH_SECRET"
    )
    
    for var in "${REQUIRED_VARS[@]}"; do
        if [ -z "${!var}" ]; then
            log_error "Required environment variable $var is not set"
            exit 1
        fi
    done
    
    # Check if default secrets are still being used
    if [ "$JWT_SECRET" = "prod_jwt_secret_change_this_to_a_very_long_random_string_minimum_32_characters" ]; then
        log_error "Default JWT_SECRET detected - please change to a secure random string"
        exit 1
    fi
    
    if [ "$JWT_REFRESH_SECRET" = "prod_refresh_secret_also_change_this_to_a_very_long_random_string_minimum_32_characters" ]; then
        log_error "Default JWT_REFRESH_SECRET detected - please change to a secure random string"
        exit 1
    fi
    
    log_message "Environment validation completed ✅"
}

# Install dependencies
install_dependencies() {
    log_message "Installing production dependencies..."
    
    # Clean install
    rm -rf node_modules package-lock.json
    npm ci --only=production
    
    log_message "Dependencies installed ✅"
}

# Run database migrations (if any)
setup_database() {
    log_message "Setting up database..."
    
    # Test database connection
    node -e "
        require('dotenv').config({ path: '.env.production' });
        const DatabaseService = require('./src/services/DatabaseService');
        
        DatabaseService.initialize()
            .then(() => {
                console.log('Database connection successful');
                process.exit(0);
            })
            .catch((error) => {
                console.error('Database connection failed:', error);
                process.exit(1);
            });
    "
    
    if [ $? -eq 0 ]; then
        log_message "Database setup completed ✅"
    else
        log_error "Database setup failed"
        exit 1
    fi
}

# Build application (if needed)
build_application() {
    log_message "Building application..."
    
    # Run build script if it exists
    if npm run build &> /dev/null; then
        log_message "Application build completed ✅"
    else
        log_warning "No build script found or build failed - continuing with source files"
    fi
}

# Start application with PM2
start_with_pm2() {
    log_message "Starting application with PM2..."
    
    # Install PM2 if not present
    if ! command -v pm2 &> /dev/null; then
        npm install -g pm2
    fi
    
    # Stop existing instance
    pm2 stop $APP_NAME 2>/dev/null || true
    pm2 delete $APP_NAME 2>/dev/null || true
    
    # Start application
    pm2 start server-production.js --name $APP_NAME --env production
    
    # Save PM2 configuration
    pm2 save
    
    # Setup startup script
    pm2 startup
    
    log_message "Application started with PM2 ✅"
    log_message "Use 'pm2 status' to check application status"
    log_message "Use 'pm2 logs $APP_NAME' to view logs"
}

# Start with Docker
start_with_docker() {
    log_message "Starting application with Docker..."
    
    # Stop existing containers
    docker-compose -f docker-compose.production.yml down 2>/dev/null || true
    
    # Build and start containers
    docker-compose -f docker-compose.production.yml up -d --build
    
    log_message "Application started with Docker ✅"
    log_message "Use 'docker-compose -f docker-compose.production.yml logs -f' to view logs"
}

# Health check
health_check() {
    log_message "Performing health check..."
    
    sleep 10  # Wait for application to start
    
    # Check if application is responding
    if curl -f http://localhost:5000/health &> /dev/null; then
        log_message "Health check passed ✅"
        log_message "Application is running at http://localhost:5000"
    else
        log_error "Health check failed - application may not be running properly"
        exit 1
    fi
}

# Main deployment function
deploy() {
    log_message "🚀 Starting Production Deployment for $APP_NAME"
    
    check_prerequisites
    validate_environment
    install_dependencies
    setup_database
    build_application
    
    # Choose deployment method
    if [ "$1" = "docker" ]; then
        start_with_docker
    else
        start_with_pm2
    fi
    
    health_check
    
    log_message "🎉 Production deployment completed successfully!"
    log_message "📊 Dashboard: http://localhost:5000"
    log_message "📚 API Documentation: http://localhost:5000/api-docs"
    log_message "🔍 Health Check: http://localhost:5000/health"
}

# Rollback function
rollback() {
    log_warning "🔄 Rolling back deployment..."
    
    if [ "$1" = "docker" ]; then
        docker-compose -f docker-compose.production.yml down
        log_message "Docker containers stopped"
    else
        pm2 stop $APP_NAME
        log_message "PM2 application stopped"
    fi
    
    log_message "Rollback completed"
}

# Script usage
usage() {
    echo "Usage: $0 [deploy|rollback] [docker|pm2]"
    echo "  deploy docker  - Deploy using Docker Compose"
    echo "  deploy pm2     - Deploy using PM2 (default)"
    echo "  rollback       - Rollback deployment"
    exit 1
}

# Main script logic
case "$1" in
    deploy)
        deploy $2
        ;;
    rollback)
        rollback $2
        ;;
    *)
        usage
        ;;
esac
