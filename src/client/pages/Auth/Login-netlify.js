import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import apiService from '../../config/api';

const Login = ({ onLogin }) => {
  const { language, setLanguage, t } = useLanguage();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDemo, setShowDemo] = useState(true);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.username || !formData.password) {
      setError('Please enter both username and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiService.login(formData);
      
      if (response.data.success) {
        const { user, accessToken } = response.data.data;
        onLogin(user, accessToken);
      } else {
        setError(response.data.message || 'Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = (role) => {
    setFormData({
      username: role,
      password: 'admin123'
    });
    setError('');
  };

  const handleLanguageToggle = () => {
    setLanguage(language === 'en' ? 'ar' : 'en');
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 ${language === 'ar' ? 'font-arabic' : 'font-sans'}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-white bg-opacity-20">
            <i className="fas fa-chart-line text-2xl text-white"></i>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-white">
            {t('login.title', 'Redhub Supervisor')}
          </h2>
          <p className="mt-2 text-sm text-blue-100">
            {t('login.subtitle', 'Sign in to your productivity dashboard')}
          </p>
        </div>

        {/* Language Toggle */}
        <div className="flex justify-center">
          <button
            onClick={handleLanguageToggle}
            className="flex items-center px-3 py-2 text-sm text-white bg-white bg-opacity-20 rounded-md hover:bg-opacity-30 transition-colors"
          >
            <i className="fas fa-language mr-2"></i>
            {language === 'en' ? 'عربي' : 'English'}
          </button>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-lg shadow-xl p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <i className="fas fa-exclamation-circle text-red-400 mr-2 mt-0.5"></i>
                  <span className="text-sm text-red-600">{error}</span>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                {t('login.username', 'Username or Email')}
              </label>
              <div className="mt-1 relative">
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={formData.username}
                  onChange={handleInputChange}
                  className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder={t('login.usernamePlaceholder', 'Enter your username')}
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <i className="fas fa-user text-gray-400"></i>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                {t('login.password', 'Password')}
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder={t('login.passwordPlaceholder', 'Enter your password')}
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <i className="fas fa-lock text-gray-400"></i>
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="loading-spinner w-4 h-4 mr-2"></div>
                    {t('login.signingIn', 'Signing in...')}
                  </>
                ) : (
                  <>
                    <i className="fas fa-sign-in-alt mr-2"></i>
                    {t('login.signIn', 'Sign in')}
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Demo Credentials */}
          {showDemo && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-4">
                  {t('login.demoTitle', 'Demo Credentials')}
                </p>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => handleDemoLogin('admin')}
                    className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-gray-900">Admin</span>
                        <span className="text-gray-500 ml-2">admin / admin123</span>
                      </div>
                      <i className="fas fa-crown text-yellow-500"></i>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDemoLogin('manager')}
                    className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-gray-900">Manager</span>
                        <span className="text-gray-500 ml-2">manager / admin123</span>
                      </div>
                      <i className="fas fa-user-tie text-blue-500"></i>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDemoLogin('agent')}
                    className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-gray-900">Agent</span>
                        <span className="text-gray-500 ml-2">agent / admin123</span>
                      </div>
                      <i className="fas fa-user text-green-500"></i>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-sm text-blue-100">
            {t('login.footer', 'Comprehensive Productivity Management System')}
          </p>
          <div className="mt-2 flex justify-center space-x-4 text-xs text-blue-200">
            <span>{t('login.features.ai', '🤖 AI-Powered')}</span>
            <span>{t('login.features.mapping', '🗺️ Smart Logistics')}</span>
            <span>{t('login.features.realtime', '⚡ Real-time')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
