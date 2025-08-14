// API Configuration for different environments

const getApiConfig = () => {
  // Check if we're running on Netlify
  const isNetlify = window.location.hostname.includes('netlify.app') || 
                   window.location.hostname.includes('netlify.com') ||
                   process.env.NETLIFY === 'true';

  // Check if we're in development
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Base API URL configuration
  let baseURL;
  
  if (isNetlify) {
    // Production Netlify deployment
    baseURL = window.location.origin;
  } else if (isDevelopment) {
    // Local development
    baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  } else {
    // Other production environments
    baseURL = window.location.origin;
  }

  return {
    baseURL,
    isNetlify,
    isDevelopment,
    endpoints: {
      // Authentication endpoints
      auth: {
        login: isNetlify ? '/api/auth/login' : '/api/auth/login',
        register: isNetlify ? '/api/auth/register' : '/api/auth/register',
        profile: isNetlify ? '/api/auth/profile' : '/api/auth/profile',
        refresh: isNetlify ? '/api/auth/refresh' : '/api/auth/refresh',
        logout: isNetlify ? '/api/auth/logout' : '/api/auth/logout'
      },
      
      // Core business endpoints
      tasks: isNetlify ? '/api/tasks' : '/api/tasks',
      customers: isNetlify ? '/api/customers' : '/api/customers',
      orders: isNetlify ? '/api/orders' : '/api/orders',
      financial: isNetlify ? '/api/financial' : '/api/financial',
      logistics: isNetlify ? '/api/logistics' : '/api/logistics',
      warehouse: isNetlify ? '/api/warehouse' : '/api/warehouse',
      
      // AI services endpoints
      ai: {
        status: isNetlify ? '/api/ai/status' : '/api/ai/status',
        enhanceTask: isNetlify ? '/api/ai/enhance-task' : '/api/ai/enhance-task',
        generateTicketResponse: isNetlify ? '/api/ai/generate-ticket-response' : '/api/ai/generate-ticket-response',
        analyzeOrderPattern: isNetlify ? '/api/ai/analyze-order-pattern' : '/api/ai/analyze-order-pattern',
        optimizeInventory: isNetlify ? '/api/ai/optimize-inventory' : '/api/ai/optimize-inventory',
        performanceInsights: isNetlify ? '/api/ai/performance-insights' : '/api/ai/performance-insights'
      },
      
      // Mapping services endpoints
      mapping: {
        status: isNetlify ? '/api/mapping/status' : '/api/mapping/status',
        geocode: isNetlify ? '/api/mapping/geocode' : '/api/mapping/geocode',
        reverseGeocode: isNetlify ? '/api/mapping/reverse-geocode' : '/api/mapping/reverse-geocode',
        route: isNetlify ? '/api/mapping/route' : '/api/mapping/route',
        optimizeDeliveryRoute: isNetlify ? '/api/mapping/optimize-delivery-route' : '/api/mapping/optimize-delivery-route',
        deliveryZones: isNetlify ? '/api/mapping/delivery-zones' : '/api/mapping/delivery-zones',
        distanceMatrix: isNetlify ? '/api/mapping/distance-matrix' : '/api/mapping/distance-matrix',
        estimateDeliveryTime: isNetlify ? '/api/mapping/estimate-delivery-time' : '/api/mapping/estimate-delivery-time'
      },
      
      // System endpoints
      health: isNetlify ? '/api/health' : '/api/health'
    },
    
    // Request configuration
    timeout: 30000, // 30 seconds
    
    // Default headers
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };
};

// Create axios instance with configuration
import axios from 'axios';

const config = getApiConfig();

const apiClient = axios.create({
  baseURL: config.baseURL,
  timeout: config.timeout,
  headers: config.headers
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      
      // Redirect to login if not already there
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

// API service functions
export const apiService = {
  // Authentication
  login: (credentials) => apiClient.post(config.endpoints.auth.login, credentials),
  register: (userData) => apiClient.post(config.endpoints.auth.register, userData),
  getProfile: () => apiClient.get(config.endpoints.auth.profile),
  logout: () => apiClient.post(config.endpoints.auth.logout),
  
  // Tasks
  getTasks: (params = {}) => apiClient.get(config.endpoints.tasks, { params }),
  createTask: (taskData) => apiClient.post(config.endpoints.tasks, taskData),
  updateTask: (id, taskData) => apiClient.put(`${config.endpoints.tasks}/${id}`, taskData),
  deleteTask: (id) => apiClient.delete(`${config.endpoints.tasks}/${id}`),
  
  // Customers
  getCustomers: (params = {}) => apiClient.get(config.endpoints.customers, { params }),
  createCustomer: (customerData) => apiClient.post(config.endpoints.customers, customerData),
  updateCustomer: (id, customerData) => apiClient.put(`${config.endpoints.customers}/${id}`, customerData),
  deleteCustomer: (id) => apiClient.delete(`${config.endpoints.customers}/${id}`),
  
  // Orders
  getOrders: (params = {}) => apiClient.get(config.endpoints.orders, { params }),
  createOrder: (orderData) => apiClient.post(config.endpoints.orders, orderData),
  updateOrder: (id, orderData) => apiClient.put(`${config.endpoints.orders}/${id}`, orderData),
  deleteOrder: (id) => apiClient.delete(`${config.endpoints.orders}/${id}`),
  
  // AI Services
  getAIStatus: () => apiClient.get(config.endpoints.ai.status),
  enhanceTask: (taskData) => apiClient.post(config.endpoints.ai.enhanceTask, taskData),
  generateTicketResponse: (ticketData) => apiClient.post(config.endpoints.ai.generateTicketResponse, ticketData),
  
  // Mapping Services
  getMappingStatus: () => apiClient.get(config.endpoints.mapping.status),
  geocodeAddress: (address) => apiClient.post(config.endpoints.mapping.geocode, { address }),
  calculateRoute: (coordinates) => apiClient.post(config.endpoints.mapping.route, { coordinates }),
  
  // System
  getHealth: () => apiClient.get(config.endpoints.health)
};

export default apiService;
export { config as apiConfig };
