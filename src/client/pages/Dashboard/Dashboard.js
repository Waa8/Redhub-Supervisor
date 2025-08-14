import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSocket } from '../../contexts/SocketContext';

// Components
import DashboardCard from '../../components/Dashboard/DashboardCard';
import QuickActions from '../../components/Dashboard/QuickActions';
import RecentActivity from '../../components/Dashboard/RecentActivity';
import PerformanceMetrics from '../../components/Dashboard/PerformanceMetrics';
import TaskSummary from '../../components/Dashboard/TaskSummary';
import OrderSummary from '../../components/Dashboard/OrderSummary';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import ErrorMessage from '../../components/Common/ErrorMessage';

// API functions
import { getDashboardData, getDashboardMetrics } from '../../api/dashboard';

const Dashboard = () => {
  const { user } = useAuth();
  const { t, language, isRTL } = useLanguage();
  const { socket, isConnected } = useSocket();
  const [realTimeData, setRealTimeData] = useState({});

  // Fetch dashboard data
  const {
    data: dashboardData,
    isLoading: isDashboardLoading,
    error: dashboardError,
    refetch: refetchDashboard
  } = useQuery(
    ['dashboard', user?.id],
    () => getDashboardData(user?.id),
    {
      enabled: !!user?.id,
      refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
      staleTime: 2 * 60 * 1000 // Consider data stale after 2 minutes
    }
  );

  // Fetch dashboard metrics
  const {
    data: metricsData,
    isLoading: isMetricsLoading,
    error: metricsError
  } = useQuery(
    ['dashboard-metrics', user?.id],
    () => getDashboardMetrics(user?.id),
    {
      enabled: !!user?.id,
      refetchInterval: 2 * 60 * 1000 // Refetch every 2 minutes
    }
  );

  // Setup real-time updates
  useEffect(() => {
    if (socket && isConnected) {
      // Subscribe to dashboard updates
      socket.emit('dashboard:subscribe', `user:${user?.id}`);

      // Listen for real-time updates
      socket.on('dashboard:update', (data) => {
        setRealTimeData(prev => ({
          ...prev,
          ...data
        }));
      });

      socket.on('task:update', (data) => {
        // Refetch dashboard when tasks are updated
        refetchDashboard();
      });

      socket.on('order:update', (data) => {
        // Update real-time order data
        setRealTimeData(prev => ({
          ...prev,
          orders: {
            ...prev.orders,
            [data.orderId]: data
          }
        }));
      });

      return () => {
        socket.off('dashboard:update');
        socket.off('task:update');
        socket.off('order:update');
      };
    }
  }, [socket, isConnected, user?.id, refetchDashboard]);

  // Loading state
  if (isDashboardLoading || isMetricsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  // Error state
  if (dashboardError || metricsError) {
    return (
      <div className="p-6">
        <ErrorMessage 
          message={dashboardError?.message || metricsError?.message || t('dashboard.error.loadFailed')}
          onRetry={() => {
            refetchDashboard();
          }}
        />
      </div>
    );
  }

  const combinedData = {
    ...dashboardData,
    ...realTimeData,
    metrics: metricsData
  };

  return (
    <div className={`p-6 space-y-6 ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Welcome Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t('dashboard.welcome', { name: user?.firstName || user?.username })}
            </h1>
            <p className="text-gray-600 mt-1">
              {t('dashboard.subtitle')}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {/* Connection status */}
            <div className={`flex items-center space-x-2 ${isRTL ? 'space-x-reverse' : ''}`}>
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm text-gray-600">
                {isConnected ? t('dashboard.status.connected') : t('dashboard.status.disconnected')}
              </span>
            </div>
            
            {/* Current time */}
            <div className="text-sm text-gray-500">
              {new Date().toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActions userRole={user?.role} />

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardCard
          title={t('dashboard.metrics.totalTasks')}
          value={combinedData.taskSummary?.total || 0}
          change={combinedData.taskSummary?.change || 0}
          icon="fas fa-tasks"
          color="blue"
        />
        <DashboardCard
          title={t('dashboard.metrics.activeOrders')}
          value={combinedData.orderSummary?.active || 0}
          change={combinedData.orderSummary?.change || 0}
          icon="fas fa-shopping-cart"
          color="green"
        />
        <DashboardCard
          title={t('dashboard.metrics.pendingDeliveries')}
          value={combinedData.deliverySummary?.pending || 0}
          change={combinedData.deliverySummary?.change || 0}
          icon="fas fa-truck"
          color="orange"
        />
        <DashboardCard
          title={t('dashboard.metrics.revenue')}
          value={combinedData.financialSummary?.revenue || 0}
          change={combinedData.financialSummary?.change || 0}
          icon="fas fa-dollar-sign"
          color="purple"
          isCurrency={true}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Performance Metrics */}
          <PerformanceMetrics 
            data={combinedData.metrics}
            timeRange="7d"
          />
          
          {/* Recent Activity */}
          <RecentActivity 
            activities={combinedData.recentActivity || []}
            maxItems={10}
          />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Task Summary */}
          <TaskSummary 
            tasks={combinedData.taskSummary}
            onTaskClick={(taskId) => {
              // Navigate to task details
              window.location.href = `/tasks/${taskId}`;
            }}
          />
          
          {/* Order Summary */}
          <OrderSummary 
            orders={combinedData.orderSummary}
            onOrderClick={(orderId) => {
              // Navigate to order details
              window.location.href = `/orders/${orderId}`;
            }}
          />
          
          {/* Quick Stats */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {t('dashboard.quickStats.title')}
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">{t('dashboard.quickStats.completionRate')}</span>
                <span className="font-semibold text-green-600">
                  {combinedData.taskSummary?.completionRate || 0}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">{t('dashboard.quickStats.onTimeDelivery')}</span>
                <span className="font-semibold text-blue-600">
                  {combinedData.deliverySummary?.onTimeRate || 0}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">{t('dashboard.quickStats.customerSatisfaction')}</span>
                <span className="font-semibold text-purple-600">
                  {combinedData.customerSummary?.satisfaction || 0}/5
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Role-specific sections */}
      {user?.role === 'admin' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {t('dashboard.admin.systemHealth')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {combinedData.systemHealth?.uptime || '99.9%'}
              </div>
              <div className="text-sm text-gray-600">{t('dashboard.admin.uptime')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {combinedData.systemHealth?.activeUsers || 0}
              </div>
              <div className="text-sm text-gray-600">{t('dashboard.admin.activeUsers')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {combinedData.systemHealth?.apiCalls || 0}
              </div>
              <div className="text-sm text-gray-600">{t('dashboard.admin.apiCalls')}</div>
            </div>
          </div>
        </div>
      )}

      {user?.role === 'manager' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {t('dashboard.manager.teamOverview')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {combinedData.teamMetrics?.totalMembers || 0}
              </div>
              <div className="text-sm text-gray-600">{t('dashboard.manager.teamMembers')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {combinedData.teamMetrics?.activeMembers || 0}
              </div>
              <div className="text-sm text-gray-600">{t('dashboard.manager.activeMembers')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {combinedData.teamMetrics?.avgPerformance || 0}%
              </div>
              <div className="text-sm text-gray-600">{t('dashboard.manager.avgPerformance')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {combinedData.teamMetrics?.efficiency || 0}%
              </div>
              <div className="text-sm text-gray-600">{t('dashboard.manager.efficiency')}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
