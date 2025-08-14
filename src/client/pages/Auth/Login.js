import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

const Login = () => {
  const { login, loading, error } = useAuth();
  const { t, language, toggleLanguage, isRTL } = useLanguage();
  
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear field error when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.username.trim()) {
      errors.username = t('auth.validation.usernameRequired');
    }
    
    if (!formData.password) {
      errors.password = t('auth.validation.passwordRequired');
    } else if (formData.password.length < 6) {
      errors.password = t('auth.validation.passwordMinLength');
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const result = await login(formData);
    
    if (!result.success) {
      setFormErrors({
        general: result.error
      });
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 ${isRTL ? 'rtl' : 'ltr'}`}>
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-primary-600 rounded-lg flex items-center justify-center">
            <i className="fas fa-tasks text-white text-xl"></i>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            {t('auth.login.title')}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {t('auth.login.subtitle')}
          </p>
        </div>

        {/* Language Toggle */}
        <div className="flex justify-center">
          <button
            onClick={toggleLanguage}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <i className="fas fa-globe mr-2"></i>
            {language === 'en' ? 'العربية' : 'English'}
          </button>
        </div>

        {/* Login Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {/* General Error */}
          {(error || formErrors.general) && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <i className="fas fa-exclamation-circle text-red-400 mr-3 mt-0.5"></i>
                <div className="text-sm text-red-700">
                  {formErrors.general || error}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* Username Field */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                {t('auth.fields.username')}
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
                  className={`appearance-none relative block w-full px-3 py-2 border ${
                    formErrors.username ? 'border-red-300' : 'border-gray-300'
                  } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm`}
                  placeholder={t('auth.placeholders.username')}
                />
                <div className="absolute inset-y-0 right-3 flex items-center">
                  <i className="fas fa-user text-gray-400"></i>
                </div>
              </div>
              {formErrors.username && (
                <p className="mt-1 text-sm text-red-600">{formErrors.username}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                {t('auth.fields.password')}
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className={`appearance-none relative block w-full px-3 py-2 border ${
                    formErrors.password ? 'border-red-300' : 'border-gray-300'
                  } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm pr-10`}
                  placeholder={t('auth.placeholders.password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 flex items-center"
                >
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-gray-400 hover:text-gray-600`}></i>
                </button>
              </div>
              {formErrors.password && (
                <p className="mt-1 text-sm text-red-600">{formErrors.password}</p>
              )}
            </div>
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                {t('auth.login.rememberMe')}
              </label>
            </div>

            <div className="text-sm">
              <a href="#" className="font-medium text-primary-600 hover:text-primary-500">
                {t('auth.login.forgotPassword')}
              </a>
            </div>
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed btn-animate"
            >
              {loading ? (
                <>
                  <div className="loading-spinner w-4 h-4 mr-2"></div>
                  {t('auth.login.signingIn')}
                </>
              ) : (
                <>
                  <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                    <i className="fas fa-sign-in-alt text-primary-500 group-hover:text-primary-400"></i>
                  </span>
                  {t('auth.login.signIn')}
                </>
              )}
            </button>
          </div>

          {/* Register Link */}
          <div className="text-center">
            <p className="text-sm text-gray-600">
              {t('auth.login.noAccount')}{' '}
              <Link
                to="/register"
                className="font-medium text-primary-600 hover:text-primary-500"
              >
                {t('auth.login.signUp')}
              </Link>
            </p>
          </div>
        </form>

        {/* Demo Credentials */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h4 className="text-sm font-medium text-blue-800 mb-2">
              {t('auth.demo.title')}
            </h4>
            <div className="text-xs text-blue-700 space-y-1">
              <div><strong>Admin:</strong> admin / admin123</div>
              <div><strong>Manager:</strong> manager / manager123</div>
              <div><strong>Agent:</strong> agent / agent123</div>
            </div>
          </div>
        )}

        {/* Features Preview */}
        <div className="mt-8 grid grid-cols-2 gap-4 text-center">
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <i className="fas fa-tasks text-primary-600 text-2xl mb-2"></i>
            <h3 className="text-sm font-medium text-gray-900">
              {t('features.taskManagement')}
            </h3>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <i className="fas fa-chart-line text-green-600 text-2xl mb-2"></i>
            <h3 className="text-sm font-medium text-gray-900">
              {t('features.analytics')}
            </h3>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <i className="fas fa-truck text-blue-600 text-2xl mb-2"></i>
            <h3 className="text-sm font-medium text-gray-900">
              {t('features.logistics')}
            </h3>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <i className="fas fa-headset text-purple-600 text-2xl mb-2"></i>
            <h3 className="text-sm font-medium text-gray-900">
              {t('features.customerService')}
            </h3>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
