const jwt = require('jsonwebtoken');
const RedisService = require('./RedisService');

class SocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map();
    this.userSockets = new Map();
  }

  initialize(io) {
    this.io = io;
    console.log('Socket service initialized');
  }

  async handleConnection(socket, io) {
    try {
      // Authenticate socket connection
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      
      if (!token) {
        socket.emit('error', { message: 'Authentication required' });
        socket.disconnect();
        return;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId;

      // Store user connection
      this.connectedUsers.set(socket.id, {
        userId,
        socketId: socket.id,
        connectedAt: new Date(),
        lastActivity: new Date()
      });

      // Store socket for user
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId).add(socket.id);

      // Join user-specific room
      socket.join(`user:${userId}`);

      // Join role-specific rooms
      const userRole = decoded.role;
      socket.join(`role:${userRole}`);

      // Send connection confirmation
      socket.emit('connected', {
        userId,
        socketId: socket.id,
        timestamp: new Date()
      });

      // Set up event handlers
      this.setupEventHandlers(socket, userId);

      // Update user online status
      await this.updateUserOnlineStatus(userId, true);

      console.log(`User ${userId} connected with socket ${socket.id}`);

    } catch (error) {
      console.error('Socket authentication failed:', error);
      socket.emit('error', { message: 'Authentication failed' });
      socket.disconnect();
    }
  }

  setupEventHandlers(socket, userId) {
    // Task updates
    socket.on('task:subscribe', (taskId) => {
      socket.join(`task:${taskId}`);
    });

    socket.on('task:unsubscribe', (taskId) => {
      socket.leave(`task:${taskId}`);
    });

    // Order updates
    socket.on('order:subscribe', (orderId) => {
      socket.join(`order:${orderId}`);
    });

    socket.on('order:unsubscribe', (orderId) => {
      socket.leave(`order:${orderId}`);
    });

    // Delivery tracking
    socket.on('delivery:subscribe', (deliveryId) => {
      socket.join(`delivery:${deliveryId}`);
    });

    socket.on('delivery:track', async (trackingNumber) => {
      try {
        const trackingData = await this.getDeliveryTracking(trackingNumber);
        socket.emit('delivery:update', trackingData);
      } catch (error) {
        socket.emit('delivery:error', { message: 'Tracking failed', error: error.message });
      }
    });

    // Chat and customer service
    socket.on('chat:join', (conversationId) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on('chat:message', async (data) => {
      try {
        const message = await this.processChatMessage(userId, data);
        this.io.to(`conversation:${data.conversationId}`).emit('chat:message', message);
      } catch (error) {
        socket.emit('chat:error', { message: 'Message failed', error: error.message });
      }
    });

    socket.on('chat:typing', (data) => {
      socket.to(`conversation:${data.conversationId}`).emit('chat:typing', {
        userId,
        isTyping: data.isTyping
      });
    });

    // Agent availability
    socket.on('agent:status', async (status) => {
      try {
        await this.updateAgentStatus(userId, status);
        this.io.to('role:manager').emit('agent:status:update', {
          userId,
          status,
          timestamp: new Date()
        });
      } catch (error) {
        socket.emit('agent:error', { message: 'Status update failed', error: error.message });
      }
    });

    // Real-time notifications
    socket.on('notifications:subscribe', () => {
      socket.join(`notifications:${userId}`);
    });

    // Dashboard updates
    socket.on('dashboard:subscribe', (dashboardId) => {
      socket.join(`dashboard:${dashboardId}`);
    });

    // Activity tracking
    socket.on('activity', () => {
      this.updateUserActivity(userId);
    });

    // Heartbeat
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date() });
      this.updateUserActivity(userId);
    });
  }

  async handleDisconnection(socket) {
    const userConnection = this.connectedUsers.get(socket.id);
    
    if (userConnection) {
      const { userId } = userConnection;
      
      // Remove socket from user's socket set
      if (this.userSockets.has(userId)) {
        this.userSockets.get(userId).delete(socket.id);
        
        // If no more sockets for user, mark as offline
        if (this.userSockets.get(userId).size === 0) {
          this.userSockets.delete(userId);
          await this.updateUserOnlineStatus(userId, false);
        }
      }
      
      // Remove from connected users
      this.connectedUsers.delete(socket.id);
      
      console.log(`User ${userId} disconnected from socket ${socket.id}`);
    }
  }

  // Notification methods
  async sendToUser(userId, event, data) {
    if (this.io) {
      this.io.to(`user:${userId}`).emit(event, {
        ...data,
        timestamp: new Date()
      });
      
      // Also cache notification for offline users
      await this.cacheNotification(userId, event, data);
    }
  }

  async sendToRole(role, event, data) {
    if (this.io) {
      this.io.to(`role:${role}`).emit(event, {
        ...data,
        timestamp: new Date()
      });
    }
  }

  async broadcastToAll(event, data) {
    if (this.io) {
      this.io.emit(event, {
        ...data,
        timestamp: new Date()
      });
    }
  }

  async sendTaskUpdate(taskId, updateData) {
    if (this.io) {
      this.io.to(`task:${taskId}`).emit('task:update', {
        taskId,
        ...updateData,
        timestamp: new Date()
      });
    }
  }

  async sendOrderUpdate(orderId, updateData) {
    if (this.io) {
      this.io.to(`order:${orderId}`).emit('order:update', {
        orderId,
        ...updateData,
        timestamp: new Date()
      });
    }
  }

  async sendDeliveryUpdate(deliveryId, trackingData) {
    if (this.io) {
      this.io.to(`delivery:${deliveryId}`).emit('delivery:update', {
        deliveryId,
        ...trackingData,
        timestamp: new Date()
      });
    }
  }

  async sendChatMessage(conversationId, message) {
    if (this.io) {
      this.io.to(`conversation:${conversationId}`).emit('chat:message', {
        conversationId,
        ...message,
        timestamp: new Date()
      });
    }
  }

  async sendDashboardUpdate(dashboardId, updateData) {
    if (this.io) {
      this.io.to(`dashboard:${dashboardId}`).emit('dashboard:update', {
        dashboardId,
        ...updateData,
        timestamp: new Date()
      });
    }
  }

  // Utility methods
  async updateUserOnlineStatus(userId, isOnline) {
    try {
      await RedisService.setHash('user_status', userId, {
        isOnline,
        lastSeen: new Date(),
        socketCount: this.userSockets.get(userId)?.size || 0
      });
    } catch (error) {
      console.error('Failed to update user online status:', error);
    }
  }

  async updateUserActivity(userId) {
    const userConnection = Array.from(this.connectedUsers.values())
      .find(conn => conn.userId === userId);
    
    if (userConnection) {
      userConnection.lastActivity = new Date();
      
      // Update in Redis
      await RedisService.setHash('user_activity', userId, {
        lastActivity: new Date(),
        socketId: userConnection.socketId
      });
    }
  }

  async cacheNotification(userId, event, data) {
    try {
      const notification = {
        event,
        data,
        timestamp: new Date(),
        read: false
      };
      
      await RedisService.pushToList(`notifications:${userId}`, notification);
      
      // Keep only last 100 notifications
      const listLength = await RedisService.getListLength(`notifications:${userId}`);
      if (listLength > 100) {
        // Trim list to keep only last 100
        await RedisService.client.lTrim(
          RedisService.prefixKey(`notifications:${userId}`),
          0,
          99
        );
      }
    } catch (error) {
      console.error('Failed to cache notification:', error);
    }
  }

  async getOfflineNotifications(userId) {
    try {
      const notifications = await RedisService.get(`notifications:${userId}`) || [];
      return notifications.filter(n => !n.read);
    } catch (error) {
      console.error('Failed to get offline notifications:', error);
      return [];
    }
  }

  async markNotificationAsRead(userId, notificationId) {
    try {
      const notifications = await RedisService.get(`notifications:${userId}`) || [];
      const updated = notifications.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      );
      await RedisService.set(`notifications:${userId}`, updated);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }

  // Connection status methods
  isUserOnline(userId) {
    return this.userSockets.has(userId) && this.userSockets.get(userId).size > 0;
  }

  getConnectedUsers() {
    return Array.from(this.userSockets.keys());
  }

  getUserSocketCount(userId) {
    return this.userSockets.get(userId)?.size || 0;
  }

  getTotalConnections() {
    return this.connectedUsers.size;
  }
}

module.exports = new SocketService();
