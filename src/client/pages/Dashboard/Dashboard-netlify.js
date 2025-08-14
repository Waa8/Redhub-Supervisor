import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import apiService from '../../config/api';

const Dashboard = ({ user, onLogout }) => {
  const { language, setLanguage, t } = useLanguage();
  const [stats, setStats] = useState({
    tasks: { total: 0, completed: 0, pending: 0 },
    orders: { total: 0, processing: 0, shipped: 0 },
    customers: { total: 0, active: 0 },
    revenue: { total: 0, thisMonth: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load demo data
      const demoStats = {
        tasks: { total: 15, completed: 8, pending: 7 },
        orders: { total: 42, processing: 12, shipped: 30 },
        customers: { total: 156, active: 134 },
        revenue: { total: 125000, thisMonth: 18500 }
      };

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setStats(demoStats);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageToggle = () => {
    setLanguage(language === 'en' ? 'ar' : 'en');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <i className="fas fa-exclamation-triangle text-4xl"></i>
          </div>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadDashboardData}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 ${language === 'ar' ? 'font-arabic' : 'font-sans'}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                <i className="fas fa-chart-line mr-2 text-blue-500"></i>
                {t('dashboard.title', 'Redhub Supervisor')}
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Language Toggle */}
              <button
                onClick={handleLanguageToggle}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
                title={language === 'en' ? 'Switch to Arabic' : 'Switch to English'}
              >
                <i className="fas fa-language"></i>
                <span className="ml-1 text-sm">{language === 'en' ? 'عربي' : 'EN'}</span>
              </button>

              {/* User Menu */}
              <div className="flex items-center space-x-2">
                <div className="text-sm">
                  <p className="text-gray-900 font-medium">{user.first_name} {user.last_name}</p>
                  <p className="text-gray-500 capitalize">{user.role}</p>
                </div>
                <button
                  onClick={onLogout}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md"
                  title="Logout"
                >
                  <i className="fas fa-sign-out-alt"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-6 text-white mb-6">
            <h2 className="text-2xl font-bold mb-2">
              {t('dashboard.welcome', `Welcome back, ${user.first_name}!`)}
            </h2>
            <p className="text-blue-100">
              {t('dashboard.subtitle', 'Here\'s what\'s happening with your business today.')}
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="px-4 sm:px-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Tasks Card */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <i className="fas fa-tasks text-2xl text-blue-500"></i>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        {t('dashboard.tasks', 'Tasks')}
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stats.tasks.completed}/{stats.tasks.total}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-5 py-3">
                <div className="text-sm">
                  <span className="text-green-600 font-medium">{stats.tasks.completed} completed</span>
                  <span className="text-gray-500 mx-2">•</span>
                  <span className="text-orange-600 font-medium">{stats.tasks.pending} pending</span>
                </div>
              </div>
            </div>

            {/* Orders Card */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <i className="fas fa-shopping-cart text-2xl text-green-500"></i>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        {t('dashboard.orders', 'Orders')}
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stats.orders.total}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-5 py-3">
                <div className="text-sm">
                  <span className="text-blue-600 font-medium">{stats.orders.processing} processing</span>
                  <span className="text-gray-500 mx-2">•</span>
                  <span className="text-green-600 font-medium">{stats.orders.shipped} shipped</span>
                </div>
              </div>
            </div>

            {/* Customers Card */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <i className="fas fa-users text-2xl text-purple-500"></i>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        {t('dashboard.customers', 'Customers')}
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stats.customers.total}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-5 py-3">
                <div className="text-sm">
                  <span className="text-green-600 font-medium">{stats.customers.active} active</span>
                </div>
              </div>
            </div>

            {/* Revenue Card */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <i className="fas fa-dollar-sign text-2xl text-yellow-500"></i>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        {t('dashboard.revenue', 'Revenue')}
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        ${stats.revenue.total.toLocaleString()}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-5 py-3">
                <div className="text-sm">
                  <span className="text-green-600 font-medium">${stats.revenue.thisMonth.toLocaleString()} this month</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="px-4 sm:px-0">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {t('dashboard.quickActions', 'Quick Actions')}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <i className="fas fa-plus text-2xl text-blue-500 mb-2"></i>
                <span className="text-sm text-gray-700">{t('dashboard.newTask', 'New Task')}</span>
              </button>
              <button className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <i className="fas fa-shopping-bag text-2xl text-green-500 mb-2"></i>
                <span className="text-sm text-gray-700">{t('dashboard.newOrder', 'New Order')}</span>
              </button>
              <button className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <i className="fas fa-user-plus text-2xl text-purple-500 mb-2"></i>
                <span className="text-sm text-gray-700">{t('dashboard.newCustomer', 'New Customer')}</span>
              </button>
              <button className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <i className="fas fa-chart-bar text-2xl text-yellow-500 mb-2"></i>
                <span className="text-sm text-gray-700">{t('dashboard.reports', 'Reports')}</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
