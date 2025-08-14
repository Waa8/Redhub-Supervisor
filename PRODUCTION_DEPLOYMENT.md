# Production Deployment Guide

## Overview
This guide covers deploying the Productivity Management System to production with Supabase as the database backend.

## Prerequisites

### 1. Supabase Setup
- ✅ Database schema created with all 11 modules
- ✅ Row Level Security (RLS) enabled
- ✅ Multi-tenant data isolation configured
- ✅ Indexes and triggers implemented

### 2. Environment Configuration
- Copy `.env` to `.env.production`
- Update all environment variables with production values
- **CRITICAL**: Change all default secrets and keys

### 3. Required Services
- Node.js 18+ 
- PostgreSQL (via Supabase)
- Redis (optional, for caching)
- SMTP server (for email notifications)

## Deployment Steps

### Step 1: Environment Setup

```bash
# 1. Clone and setup
git clone <your-repo>
cd productivity-app
npm install

# 2. Configure environment
cp .env .env.production
```

### Step 2: Update Production Environment Variables

**CRITICAL SECURITY UPDATES REQUIRED:**

```env
# Production URLs
NODE_ENV=production
API_URL=https://your-domain.com/api
CLIENT_URL=https://your-domain.com

# Supabase Configuration
SUPABASE_URL=https://rtonquedpcuntembyfxj.supabase.co
SUPABASE_ANON_KEY=your_actual_supabase_anon_key
SUPABASE_SERVICE_KEY=your_actual_supabase_service_key

# JWT Secrets - MUST CHANGE THESE
JWT_SECRET=your_very_long_random_jwt_secret_minimum_32_characters
JWT_REFRESH_SECRET=your_very_long_random_refresh_secret_minimum_32_characters

# Session Secret
SESSION_SECRET=your_very_long_random_session_secret

# CORS
CORS_ORIGIN=https://your-domain.com

# Email Configuration
SMTP_HOST=your-smtp-host
SMTP_USER=your-email@domain.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@your-domain.com

# Organization Details
ORGANIZATION_NAME=Your Company Name
ORGANIZATION_EMAIL=admin@your-domain.com
```

### Step 3: Database Configuration

The database is already configured in Supabase with:
- ✅ 30+ production tables
- ✅ Complete relationships and constraints
- ✅ Row Level Security policies
- ✅ Performance indexes
- ✅ Audit logging
- ✅ Multi-tenant isolation

### Step 4: Security Configuration

1. **JWT Secrets**: Generate strong secrets
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

2. **CORS**: Configure allowed origins
3. **Rate Limiting**: Adjust limits based on expected traffic
4. **File Uploads**: Configure secure file handling

### Step 5: Production Files

Use the production-ready files:
- `server-production.js` - Main server with security
- `src/routes/*-production.js` - Production API routes
- `src/middleware/auth-production.js` - Secure authentication
- `src/middleware/rateLimiter-production.js` - Rate limiting

### Step 6: Start Production Server

```bash
# Using PM2 (recommended)
npm install -g pm2
pm2 start server-production.js --name "productivity-app"
pm2 startup
pm2 save

# Or using Docker
docker build -t productivity-app .
docker run -d -p 5000:5000 --env-file .env.production productivity-app
```

## Production Features

### 1. Database (Supabase PostgreSQL)
- **Multi-tenant architecture** with organization isolation
- **Row Level Security** for data protection
- **Real-time subscriptions** for live updates
- **Automatic backups** and point-in-time recovery
- **Performance monitoring** and query optimization

### 2. Security
- **JWT authentication** with refresh tokens
- **Role-based access control** (RBAC)
- **Rate limiting** by user role and endpoint
- **Input validation** and sanitization
- **CORS protection** and security headers
- **Account lockout** after failed login attempts

### 3. Performance
- **Database indexes** for fast queries
- **Connection pooling** via Supabase
- **Response compression** and caching
- **Pagination** for large datasets
- **Optimized queries** with joins

### 4. Monitoring
- **Winston logging** with rotation
- **Error tracking** and alerting
- **Performance metrics** collection
- **Health check endpoints**
- **Audit logging** for compliance

### 5. Business Features
- **11 Complete Modules**: Task Management, Order Processing, Customer Management, Logistics, Warehouse, Financial, Customer Service, Representative Management, Reporting, User Management, Dashboard
- **Real-time updates** via WebSockets
- **Advanced search** and filtering
- **File upload** and document management
- **Email notifications** and alerts
- **Multi-language support** (English/Arabic)

## Module Capabilities

### Task Management
- Advanced task creation with dependencies
- Real-time collaboration and updates
- Progress tracking and time logging
- Subtask management and hierarchies
- Custom categories and tags

### Order Management  
- Complete order lifecycle management
- Inventory integration and validation
- Automatic order number generation
- Multi-status tracking and updates
- Customer and product relationships

### Customer Management
- Comprehensive customer profiles
- Contact management and history
- Tier-based customer classification
- Representative assignment
- Order and support history

### Logistics & Delivery
- Route optimization and tracking
- Driver and vehicle management
- Real-time delivery updates
- Proof of delivery capture
- Performance analytics

### Warehouse Management
- Multi-warehouse inventory tracking
- Location-based storage management
- Stock movement and audit trails
- Capacity planning and optimization
- Barcode and QR code support

### Financial Management
- Invoice generation and tracking
- Payment processing and recording
- Financial reporting and analytics
- Multi-currency support
- Credit management

### Customer Service
- Ticket management system
- Knowledge base integration
- SLA tracking and escalation
- Customer satisfaction surveys
- Multi-channel support

## Monitoring and Maintenance

### Health Checks
- `/health` - Basic health status
- `/api/health` - Detailed service status

### Logging
- Application logs: `logs/combined.log`
- Error logs: `logs/error.log`
- Access logs: `logs/access.log`

### Performance Monitoring
- Database query performance
- API response times
- Memory and CPU usage
- Error rates and patterns

## Security Checklist

- [ ] Change all default passwords and secrets
- [ ] Configure CORS for production domains
- [ ] Set up SSL/TLS certificates
- [ ] Configure firewall rules
- [ ] Enable audit logging
- [ ] Set up monitoring and alerting
- [ ] Configure backup and recovery
- [ ] Test security policies
- [ ] Validate rate limiting
- [ ] Review user permissions

## Support and Maintenance

### Regular Tasks
- Monitor application logs
- Review security alerts
- Update dependencies
- Backup verification
- Performance optimization
- User access reviews

### Scaling Considerations
- Supabase automatically handles database scaling
- Consider Redis for session management at scale
- Implement CDN for static assets
- Use load balancer for multiple instances
- Monitor and optimize database queries

## Troubleshooting

### Common Issues
1. **Database Connection**: Check Supabase credentials and network
2. **Authentication**: Verify JWT secrets and token expiration
3. **CORS Errors**: Update allowed origins in environment
4. **Rate Limiting**: Adjust limits based on usage patterns
5. **File Uploads**: Check file size limits and storage permissions

### Support Contacts
- Technical Support: admin@your-domain.com
- Database Issues: Check Supabase dashboard
- Security Concerns: security@your-domain.com
