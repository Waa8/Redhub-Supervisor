import React, { useState, useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ReactQueryDevtools } from 'react-query/devtools';

// Context providers
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { SocketProvider } from './contexts/SocketContext';

// Layout components
import Layout from './components/Layout/Layout';
import LoadingSpinner from './components/Common/LoadingSpinner';
import ErrorBoundary from './components/Common/ErrorBoundary';

// Page components (lazy loaded)
const Dashboard = React.lazy(() => import('./pages/Dashboard/Dashboard'));
const Login = React.lazy(() => import('./pages/Auth/Login'));
const Register = React.lazy(() => import('./pages/Auth/Register'));
const Tasks = React.lazy(() => import('./pages/Tasks/Tasks'));
const Orders = React.lazy(() => import('./pages/Orders/Orders'));
const OrderDetails = React.lazy(() => import('./pages/Orders/OrderDetails'));
const Logistics = React.lazy(() => import('./pages/Logistics/Logistics'));
const Warehouse = React.lazy(() => import('./pages/Warehouse/Warehouse'));
const Financial = React.lazy(() => import('./pages/Financial/Financial'));
const CustomerService = React.lazy(() => import('./pages/CustomerService/CustomerService'));
const Representatives = React.lazy(() => import('./pages/Representatives/Representatives'));
const Reports = React.lazy(() => import('./pages/Reports/Reports'));
const Profile = React.lazy(() => import('./pages/Profile/Profile'));
const Settings = React.lazy(() => import('./pages/Settings/Settings'));

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      refetchOnReconnect: true
    },
    mutations: {
      retry: 1,
      retryDelay: 1000
    }
  }
});

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// Public Route component (redirect if authenticated)
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

// Main App component
function App() {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize app
    const initializeApp = async () => {
      try {
        // Check if app is already initialized
        const initialized = localStorage.getItem('app_initialized');
        
        if (!initialized) {
          // First time setup
          localStorage.setItem('app_initialized', 'true');
          localStorage.setItem('app_version', '1.0.0');
        }
        
        // Check for app updates
        const storedVersion = localStorage.getItem('app_version');
        const currentVersion = window.APP_CONFIG?.VERSION || '1.0.0';
        
        if (storedVersion !== currentVersion) {
          // Clear cache on version change
          localStorage.setItem('app_version', currentVersion);
          queryClient.clear();
        }
        
        setIsInitialized(true);
      } catch (error) {
        console.error('App initialization failed:', error);
        setIsInitialized(true); // Continue anyway
      }
    };

    initializeApp();
  }, []);

  if (!isInitialized) {
    return <LoadingSpinner />;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <LanguageProvider>
            <NotificationProvider>
              <SocketProvider>
                <Router>
                  <div className="min-h-screen bg-gray-50">
                    <Suspense fallback={<LoadingSpinner />}>
                      <Routes>
                        {/* Public routes */}
                        <Route path="/login" element={
                          <PublicRoute>
                            <Login />
                          </PublicRoute>
                        } />
                        <Route path="/register" element={
                          <PublicRoute>
                            <Register />
                          </PublicRoute>
                        } />
                        
                        {/* Protected routes */}
                        <Route path="/" element={
                          <ProtectedRoute>
                            <Layout />
                          </ProtectedRoute>
                        }>
                          <Route index element={<Navigate to="/dashboard" replace />} />
                          <Route path="dashboard" element={<Dashboard />} />
                          <Route path="tasks" element={<Tasks />} />
                          <Route path="orders" element={<Orders />} />
                          <Route path="orders/:id" element={<OrderDetails />} />
                          <Route path="logistics" element={<Logistics />} />
                          <Route path="warehouse" element={<Warehouse />} />
                          <Route path="financial" element={<Financial />} />
                          <Route path="customer-service" element={<CustomerService />} />
                          <Route path="representatives" element={<Representatives />} />
                          <Route path="reports" element={<Reports />} />
                          <Route path="profile" element={<Profile />} />
                          <Route path="settings" element={<Settings />} />
                        </Route>
                        
                        {/* Catch all route */}
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                      </Routes>
                    </Suspense>
                  </div>
                </Router>
              </SocketProvider>
            </NotificationProvider>
          </LanguageProvider>
        </AuthProvider>
        
        {/* React Query DevTools (development only) */}
        {process.env.NODE_ENV === 'development' && (
          <ReactQueryDevtools initialIsOpen={false} />
        )}
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
