// Simple startup script for demo
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Simple in-memory data store
const users = new Map();
const tasks = new Map();
const orders = new Map();

// Demo users
users.set('admin', {
  id: 'admin-id',
  username: 'admin',
  email: 'admin@demo.com',
  password: 'admin123', // In real app, this would be hashed
  firstName: 'Admin',
  lastName: 'User',
  role: 'admin'
});

users.set('manager', {
  id: 'manager-id',
  username: 'manager',
  email: 'manager@demo.com',
  password: 'manager123',
  firstName: 'Manager',
  lastName: 'User',
  role: 'manager'
});

users.set('agent', {
  id: 'agent-id',
  username: 'agent',
  email: 'agent@demo.com',
  password: 'agent123',
  firstName: 'Agent',
  lastName: 'User',
  role: 'agent'
});

// Simple auth endpoint
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  const user = users.get(username);
  
  if (!user || user.password !== password) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }
  
  // Simple token (in real app, use JWT)
  const token = `demo-token-${user.id}`;
  
  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      },
      accessToken: token
    }
  });
});

// Dashboard data endpoint
app.get('/api/dashboard', (req, res) => {
  res.json({
    success: true,
    data: {
      taskSummary: {
        total: 15,
        pending: 5,
        in_progress: 3,
        completed: 7,
        change: 12
      },
      orderSummary: {
        active: 8,
        pending: 3,
        shipped: 5,
        change: 8
      },
      deliverySummary: {
        pending: 4,
        in_transit: 6,
        delivered: 12,
        change: -2
      },
      financialSummary: {
        revenue: 25000,
        change: 15
      },
      recentActivity: [
        {
          id: 1,
          type: 'task',
          message: 'Task "Review orders" completed',
          timestamp: new Date(Date.now() - 30 * 60 * 1000)
        },
        {
          id: 2,
          type: 'order',
          message: 'New order #ORD-001 received',
          timestamp: new Date(Date.now() - 60 * 60 * 1000)
        }
      ]
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Productivity App Demo running on http://localhost:${PORT}`);
  console.log(`📊 Demo credentials:`);
  console.log(`   Admin: admin / admin123`);
  console.log(`   Manager: manager / manager123`);
  console.log(`   Agent: agent / agent123`);
});
