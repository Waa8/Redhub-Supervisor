# 🚀 Comprehensive Productivity Application

A complete, production-ready productivity management system with AI intelligence and mapping capabilities for modern businesses.

![Production Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![License](https://img.shields.io/badge/License-MIT-blue)

## ✨ Features

### 🎯 Core Business Modules
- **📋 Task Management**: AI-enhanced task organization and tracking
- **🛒 Order Management**: Complete order processing and fulfillment system
- **🚚 Logistics**: Advanced delivery and route optimization with Mapbox
- **📦 Warehouse**: Comprehensive inventory and warehouse management
- **💰 Financial**: Complete financial management and reporting
- **🎧 Customer Service**: AI-powered customer service and support system

### 🤖 AI-Powered Features
- **Task Enhancement**: Intelligent task description improvement
- **Customer Service Automation**: AI-generated response suggestions
- **Order Pattern Analysis**: Customer behavior insights and recommendations
- **Inventory Optimization**: AI-driven stock management recommendations
- **Performance Insights**: Productivity analysis and improvement suggestions

### 🗺️ Mapping & Logistics
- **Geocoding**: Convert addresses to coordinates
- **Route Optimization**: Multi-stop delivery route planning
- **Delivery Zones**: Service area calculation with drive times
- **Distance Matrix**: Bulk distance/time calculations
- **Delivery Time Estimation**: Traffic-aware delivery predictions

### 🔐 Enterprise Security
- **JWT Authentication**: Secure token-based authentication with refresh tokens
- **Role-Based Access Control**: Admin, Manager, Agent roles with granular permissions
- **Rate Limiting**: API protection against abuse
- **Input Validation**: Comprehensive request validation
- **CORS Protection**: Cross-origin request security

## 🏗️ Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL with Supabase
- **Authentication**: JWT with bcrypt
- **Cache**: Redis (with in-memory fallback)
- **Real-time**: WebSocket support

### Frontend
- **Languages**: HTML5, CSS3, JavaScript (ES6+)
- **Styling**: Tailwind CSS
- **Icons**: Font Awesome
- **Fonts**: Inter, Cairo (Arabic support)
- **Features**: Responsive design, Multi-language (EN/AR)

### External Services
- **AI**: DeepSeek AI for intelligent features
- **Mapping**: Mapbox for logistics optimization
- **Database**: Supabase PostgreSQL
- **Email**: Configured for notifications

### DevOps & Deployment
- **Containerization**: Docker & Docker Compose
- **Web Server**: Nginx
- **Process Management**: PM2
- **Monitoring**: Winston logging
- **Environment**: Production-ready configuration

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- PostgreSQL database (or Supabase account)
- Git installed

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd productivity-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Seed the database**
   ```bash
   node scripts/seed-database.js
   ```

5. **Start the development server**
   ```bash
   npm start
   ```

6. **Access the application**
   - Development: `http://localhost:3000`
   - Production: `http://localhost:5002`

### Demo Credentials
- **Admin**: username=`admin`, password=`admin123`
- **Manager**: username=`manager`, password=`admin123`
- **Agent**: username=`agent`, password=`admin123`

## 📊 API Documentation

### Authentication Endpoints
```
POST /api/auth/login          # User login
POST /api/auth/register       # User registration
GET  /api/auth/profile        # User profile
POST /api/auth/refresh        # Refresh token
POST /api/auth/logout         # User logout
```

### Business Module Endpoints
```
GET  /api/tasks              # Task management
GET  /api/orders             # Order management
GET  /api/customers          # Customer management
GET  /api/financial          # Financial operations
GET  /api/logistics          # Logistics management
GET  /api/warehouse          # Warehouse operations
```

### AI Service Endpoints
```
POST /api/ai/enhance-task                # AI task enhancement
POST /api/ai/generate-ticket-response    # AI customer service
POST /api/ai/analyze-order-pattern       # AI order analysis
POST /api/ai/optimize-inventory          # AI inventory optimization
GET  /api/ai/status                      # AI service status
```

### Mapping Service Endpoints
```
POST /api/mapping/geocode                    # Address to coordinates
POST /api/mapping/optimize-delivery-route    # Route optimization
POST /api/mapping/delivery-zones             # Service area calculation
POST /api/mapping/distance-matrix            # Distance calculations
GET  /api/mapping/status                     # Mapping service status
```

## 🐳 Production Deployment

### Docker Deployment
```bash
# Build and start production containers
docker-compose -f docker-compose.production.yml up -d

# View logs
docker-compose -f docker-compose.production.yml logs -f
```

### Manual Deployment
```bash
# Install production dependencies
npm ci --only=production

# Start production server
NODE_ENV=production node server-production.js
```

See [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) for detailed deployment instructions.

## 🔧 Configuration

### Environment Variables
```env
# Server Configuration
NODE_ENV=production
PORT=5002

# Database Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key

# Authentication
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret

# AI Services
DEEPSEEK_API_KEY=your_deepseek_key

# Mapping Services
MAPBOX_ACCESS_TOKEN=your_mapbox_token

# Redis (Optional)
REDIS_URL=redis://localhost:6379
```

## 📁 Project Structure

```
productivity-app/
├── src/
│   ├── client/              # Frontend components
│   ├── middleware/          # Express middleware
│   ├── routes/              # API route handlers
│   └── services/            # Business logic services
├── public/                  # Static files
├── scripts/                 # Utility scripts
├── logs/                    # Application logs
├── docker-compose.production.yml
├── Dockerfile.production
├── server-production.js     # Production server
└── package.json
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm run test:auth
```

## 📈 Monitoring & Logging

- **Application Logs**: `logs/combined.log`
- **Error Logs**: `logs/error.log`
- **Access Logs**: `logs/access.log`
- **Health Check**: `GET /health`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the `/docs` folder for detailed guides
- **Issues**: Report bugs and request features via GitHub Issues
- **Email**: developer@productivityapp.com

## 🎯 Roadmap

- [ ] Mobile application (React Native)
- [ ] Advanced analytics dashboard
- [ ] Integration with more AI providers
- [ ] Multi-tenant architecture
- [ ] Advanced reporting features
- [ ] API rate limiting improvements

---

**Built with ❤️ for modern businesses seeking comprehensive productivity solutions.**
