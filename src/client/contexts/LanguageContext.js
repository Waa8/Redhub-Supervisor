import React, { createContext, useContext, useState, useEffect } from 'react';

// Language context
const LanguageContext = createContext();

// Translations
const translations = {
  en: {
    // Authentication
    'auth.login.title': 'Sign in to your account',
    'auth.login.subtitle': 'Access your productivity dashboard',
    'auth.login.signIn': 'Sign In',
    'auth.login.signingIn': 'Signing In...',
    'auth.login.rememberMe': 'Remember me',
    'auth.login.forgotPassword': 'Forgot your password?',
    'auth.login.noAccount': "Don't have an account?",
    'auth.login.signUp': 'Sign up',
    'auth.register.title': 'Create your account',
    'auth.register.subtitle': 'Join our productivity platform',
    'auth.register.signUp': 'Sign Up',
    'auth.register.signingUp': 'Creating Account...',
    'auth.register.hasAccount': 'Already have an account?',
    'auth.register.signIn': 'Sign in',
    'auth.fields.username': 'Username',
    'auth.fields.email': 'Email',
    'auth.fields.password': 'Password',
    'auth.fields.confirmPassword': 'Confirm Password',
    'auth.fields.firstName': 'First Name',
    'auth.fields.lastName': 'Last Name',
    'auth.fields.phone': 'Phone Number',
    'auth.placeholders.username': 'Enter your username',
    'auth.placeholders.email': 'Enter your email',
    'auth.placeholders.password': 'Enter your password',
    'auth.placeholders.confirmPassword': 'Confirm your password',
    'auth.placeholders.firstName': 'Enter your first name',
    'auth.placeholders.lastName': 'Enter your last name',
    'auth.placeholders.phone': 'Enter your phone number',
    'auth.validation.usernameRequired': 'Username is required',
    'auth.validation.emailRequired': 'Email is required',
    'auth.validation.emailInvalid': 'Please enter a valid email',
    'auth.validation.passwordRequired': 'Password is required',
    'auth.validation.passwordMinLength': 'Password must be at least 6 characters',
    'auth.validation.passwordMismatch': 'Passwords do not match',
    'auth.validation.firstNameRequired': 'First name is required',
    'auth.validation.lastNameRequired': 'Last name is required',
    'auth.demo.title': 'Demo Credentials',

    // Dashboard
    'dashboard.welcome': 'Welcome back, {{name}}!',
    'dashboard.subtitle': 'Here\'s what\'s happening with your productivity today',
    'dashboard.status.connected': 'Connected',
    'dashboard.status.disconnected': 'Disconnected',
    'dashboard.metrics.totalTasks': 'Total Tasks',
    'dashboard.metrics.activeOrders': 'Active Orders',
    'dashboard.metrics.pendingDeliveries': 'Pending Deliveries',
    'dashboard.metrics.revenue': 'Revenue',
    'dashboard.quickStats.title': 'Quick Stats',
    'dashboard.quickStats.completionRate': 'Completion Rate',
    'dashboard.quickStats.onTimeDelivery': 'On-Time Delivery',
    'dashboard.quickStats.customerSatisfaction': 'Customer Satisfaction',
    'dashboard.admin.systemHealth': 'System Health',
    'dashboard.admin.uptime': 'Uptime',
    'dashboard.admin.activeUsers': 'Active Users',
    'dashboard.admin.apiCalls': 'API Calls',
    'dashboard.manager.teamOverview': 'Team Overview',
    'dashboard.manager.teamMembers': 'Team Members',
    'dashboard.manager.activeMembers': 'Active Members',
    'dashboard.manager.avgPerformance': 'Avg Performance',
    'dashboard.manager.efficiency': 'Efficiency',
    'dashboard.error.loadFailed': 'Failed to load dashboard data',

    // Features
    'features.taskManagement': 'Task Management',
    'features.analytics': 'Analytics',
    'features.logistics': 'Logistics',
    'features.customerService': 'Customer Service',

    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.tasks': 'Tasks',
    'nav.orders': 'Orders',
    'nav.logistics': 'Logistics',
    'nav.warehouse': 'Warehouse',
    'nav.financial': 'Financial',
    'nav.customerService': 'Customer Service',
    'nav.representatives': 'Representatives',
    'nav.reports': 'Reports',
    'nav.profile': 'Profile',
    'nav.settings': 'Settings',
    'nav.logout': 'Logout',

    // Common
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.view': 'View',
    'common.create': 'Create',
    'common.update': 'Update',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.export': 'Export',
    'common.import': 'Import',
    'common.refresh': 'Refresh',
    'common.retry': 'Retry'
  },
  ar: {
    // Authentication
    'auth.login.title': 'تسجيل الدخول إلى حسابك',
    'auth.login.subtitle': 'الوصول إلى لوحة الإنتاجية الخاصة بك',
    'auth.login.signIn': 'تسجيل الدخول',
    'auth.login.signingIn': 'جاري تسجيل الدخول...',
    'auth.login.rememberMe': 'تذكرني',
    'auth.login.forgotPassword': 'نسيت كلمة المرور؟',
    'auth.login.noAccount': 'ليس لديك حساب؟',
    'auth.login.signUp': 'إنشاء حساب',
    'auth.register.title': 'إنشاء حسابك',
    'auth.register.subtitle': 'انضم إلى منصة الإنتاجية',
    'auth.register.signUp': 'إنشاء حساب',
    'auth.register.signingUp': 'جاري إنشاء الحساب...',
    'auth.register.hasAccount': 'لديك حساب بالفعل؟',
    'auth.register.signIn': 'تسجيل الدخول',
    'auth.fields.username': 'اسم المستخدم',
    'auth.fields.email': 'البريد الإلكتروني',
    'auth.fields.password': 'كلمة المرور',
    'auth.fields.confirmPassword': 'تأكيد كلمة المرور',
    'auth.fields.firstName': 'الاسم الأول',
    'auth.fields.lastName': 'اسم العائلة',
    'auth.fields.phone': 'رقم الهاتف',
    'auth.placeholders.username': 'أدخل اسم المستخدم',
    'auth.placeholders.email': 'أدخل بريدك الإلكتروني',
    'auth.placeholders.password': 'أدخل كلمة المرور',
    'auth.placeholders.confirmPassword': 'أكد كلمة المرور',
    'auth.placeholders.firstName': 'أدخل اسمك الأول',
    'auth.placeholders.lastName': 'أدخل اسم العائلة',
    'auth.placeholders.phone': 'أدخل رقم هاتفك',
    'auth.validation.usernameRequired': 'اسم المستخدم مطلوب',
    'auth.validation.emailRequired': 'البريد الإلكتروني مطلوب',
    'auth.validation.emailInvalid': 'يرجى إدخال بريد إلكتروني صحيح',
    'auth.validation.passwordRequired': 'كلمة المرور مطلوبة',
    'auth.validation.passwordMinLength': 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
    'auth.validation.passwordMismatch': 'كلمات المرور غير متطابقة',
    'auth.validation.firstNameRequired': 'الاسم الأول مطلوب',
    'auth.validation.lastNameRequired': 'اسم العائلة مطلوب',
    'auth.demo.title': 'بيانات تجريبية',

    // Dashboard
    'dashboard.welcome': 'مرحباً بعودتك، {{name}}!',
    'dashboard.subtitle': 'إليك ما يحدث مع إنتاجيتك اليوم',
    'dashboard.status.connected': 'متصل',
    'dashboard.status.disconnected': 'غير متصل',
    'dashboard.metrics.totalTasks': 'إجمالي المهام',
    'dashboard.metrics.activeOrders': 'الطلبات النشطة',
    'dashboard.metrics.pendingDeliveries': 'التسليمات المعلقة',
    'dashboard.metrics.revenue': 'الإيرادات',
    'dashboard.quickStats.title': 'إحصائيات سريعة',
    'dashboard.quickStats.completionRate': 'معدل الإنجاز',
    'dashboard.quickStats.onTimeDelivery': 'التسليم في الوقت المحدد',
    'dashboard.quickStats.customerSatisfaction': 'رضا العملاء',
    'dashboard.admin.systemHealth': 'صحة النظام',
    'dashboard.admin.uptime': 'وقت التشغيل',
    'dashboard.admin.activeUsers': 'المستخدمون النشطون',
    'dashboard.admin.apiCalls': 'استدعاءات API',
    'dashboard.manager.teamOverview': 'نظرة عامة على الفريق',
    'dashboard.manager.teamMembers': 'أعضاء الفريق',
    'dashboard.manager.activeMembers': 'الأعضاء النشطون',
    'dashboard.manager.avgPerformance': 'متوسط الأداء',
    'dashboard.manager.efficiency': 'الكفاءة',
    'dashboard.error.loadFailed': 'فشل في تحميل بيانات لوحة التحكم',

    // Features
    'features.taskManagement': 'إدارة المهام',
    'features.analytics': 'التحليلات',
    'features.logistics': 'اللوجستيات',
    'features.customerService': 'خدمة العملاء',

    // Navigation
    'nav.dashboard': 'لوحة التحكم',
    'nav.tasks': 'المهام',
    'nav.orders': 'الطلبات',
    'nav.logistics': 'اللوجستيات',
    'nav.warehouse': 'المستودع',
    'nav.financial': 'المالية',
    'nav.customerService': 'خدمة العملاء',
    'nav.representatives': 'المناديب',
    'nav.reports': 'التقارير',
    'nav.profile': 'الملف الشخصي',
    'nav.settings': 'الإعدادات',
    'nav.logout': 'تسجيل الخروج',

    // Common
    'common.loading': 'جاري التحميل...',
    'common.error': 'خطأ',
    'common.success': 'نجح',
    'common.save': 'حفظ',
    'common.cancel': 'إلغاء',
    'common.delete': 'حذف',
    'common.edit': 'تعديل',
    'common.view': 'عرض',
    'common.create': 'إنشاء',
    'common.update': 'تحديث',
    'common.search': 'بحث',
    'common.filter': 'تصفية',
    'common.export': 'تصدير',
    'common.import': 'استيراد',
    'common.refresh': 'تحديث',
    'common.retry': 'إعادة المحاولة'
  }
};

// Language provider component
export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    // Get language from localStorage or default to English
    return localStorage.getItem('language') || 'en';
  });

  // Update document direction and language
  useEffect(() => {
    const isRTL = language === 'ar';
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    
    // Update body class for styling
    document.body.className = document.body.className
      .replace(/\b(rtl|ltr)\b/g, '')
      .trim() + ` ${isRTL ? 'rtl' : 'ltr'}`;
  }, [language]);

  // Translation function
  const t = (key, params = {}) => {
    let translation = translations[language]?.[key] || translations.en[key] || key;
    
    // Replace parameters in translation
    Object.keys(params).forEach(param => {
      translation = translation.replace(`{{${param}}}`, params[param]);
    });
    
    return translation;
  };

  // Toggle language
  const toggleLanguage = () => {
    const newLanguage = language === 'en' ? 'ar' : 'en';
    setLanguage(newLanguage);
    localStorage.setItem('language', newLanguage);
  };

  // Set specific language
  const setLanguageCode = (code) => {
    if (translations[code]) {
      setLanguage(code);
      localStorage.setItem('language', code);
    }
  };

  // Get available languages
  const getAvailableLanguages = () => {
    return [
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'ar', name: 'Arabic', nativeName: 'العربية' }
    ];
  };

  // Format numbers based on language
  const formatNumber = (number, options = {}) => {
    const locale = language === 'ar' ? 'ar-SA' : 'en-US';
    return new Intl.NumberFormat(locale, options).format(number);
  };

  // Format currency based on language
  const formatCurrency = (amount, currency = 'USD') => {
    const locale = language === 'ar' ? 'ar-SA' : 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  // Format date based on language
  const formatDate = (date, options = {}) => {
    const locale = language === 'ar' ? 'ar-SA' : 'en-US';
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...options
    }).format(new Date(date));
  };

  // Format time based on language
  const formatTime = (date, options = {}) => {
    const locale = language === 'ar' ? 'ar-SA' : 'en-US';
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      ...options
    }).format(new Date(date));
  };

  // Format relative time
  const formatRelativeTime = (date) => {
    const locale = language === 'ar' ? 'ar-SA' : 'en-US';
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    
    const now = new Date();
    const target = new Date(date);
    const diffInSeconds = (target - now) / 1000;
    
    if (Math.abs(diffInSeconds) < 60) {
      return rtf.format(Math.round(diffInSeconds), 'second');
    } else if (Math.abs(diffInSeconds) < 3600) {
      return rtf.format(Math.round(diffInSeconds / 60), 'minute');
    } else if (Math.abs(diffInSeconds) < 86400) {
      return rtf.format(Math.round(diffInSeconds / 3600), 'hour');
    } else {
      return rtf.format(Math.round(diffInSeconds / 86400), 'day');
    }
  };

  const value = {
    language,
    isRTL: language === 'ar',
    t,
    toggleLanguage,
    setLanguage: setLanguageCode,
    getAvailableLanguages,
    formatNumber,
    formatCurrency,
    formatDate,
    formatTime,
    formatRelativeTime
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

// Custom hook to use language context
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  
  return context;
};

export default LanguageContext;
