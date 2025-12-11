import React, { useState, useEffect } from 'react';
import { Package, Search, X, Info, Phone, Shield, Bell, AlertCircle, Loader2, Heart, Navigation } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import NotificationSettings from './NotificationSettings';
import { supabase } from '../lib/supabase';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenContact?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, onOpenContact }) => {
  const [currentPage, setCurrentPage] = useState<'main' | 'about' | 'contact' | 'privacy' | 'notifications'>('main');

  // Reset current page when sidebar is closed
  useEffect(() => {
    if (!isOpen) {
      setCurrentPage('main');
    }
  }, [isOpen]);

  // Listen for custom event to open contact page
  useEffect(() => {
    const handleOpenContact = () => {
      setCurrentPage('contact');
    };
    
    window.addEventListener('open-sidebar-contact', handleOpenContact);
    return () => window.removeEventListener('open-sidebar-contact', handleOpenContact);
  }, []);


  const handleBackToMain = () => {
    setCurrentPage('main');
  };

  const handleCloseAll = () => {
    setCurrentPage('main');
    onClose();
  };

  const handleOpenPrivacyPolicy = () => {
    // Dispatch event to open privacy policy page
    window.dispatchEvent(new CustomEvent('open-privacy-policy'));
    onClose();
  };

  const handleOpenContactPage = () => {
    if (onOpenContact) {
      onOpenContact();
      onClose();
    } else {
      // Dispatch event to open contact page
      window.dispatchEvent(new CustomEvent('open-contact-page'));
      onClose();
    }
  };

  const renderPageHeader = (title: string) => (
    <div className="p-4 border-b flex items-center">
      <button
        onClick={handleBackToMain}
        className="text-gray-400 hover:text-gray-500"
      >
        <X className="w-6 h-6" />
      </button>
      <h2 className="text-xl font-bold text-gray-900 mr-4">{title}</h2>
    </div>
  );

  const renderContent = () => {
    switch (currentPage) {
      case 'about':
        return (
          <div className="flex flex-col h-full">
            {renderPageHeader('من نحن')}
            <div className="p-4 space-y-4">
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-accent mb-4">مرحباً بكم في بين إيديك</h3>
                <p className="text-gray-600 mb-4">
                  نحن منصة توصيل رائدة في فلسطين، نسعى لتوفير خدمة توصيل سريعة وموثوقة لعملائنا.
                </p>
                <p className="text-gray-600">
                  نعمل مع أفضل المطاعم والمتاجر لنقدم لكم تجربة تسوق مميزة وسهلة.
                </p>
              </div>
            </div>
          </div>
        );

      case 'contact':
        return (
          <div className="flex flex-col h-full">
            {renderPageHeader('اتصل بنا')}
            <div className="p-4 space-y-4">
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-accent mb-4">تواصل معنا</h3>
                <div className="space-y-3">
                  <p className="flex items-center gap-2">
                    <Phone className="w-5 h-5 text-accent" />
                    <a href="tel:+970569697080" className="text-gray-600 hover:text-accent">
                      0569697080
                    </a>
                  </p>
                  <p className="flex items-center gap-2">
                    <Heart className="w-5 h-5 text-accent" />
                    <a href="https://wa.me/970569697080" className="text-gray-600 hover:text-accent">
                      واتساب
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'privacy':
        return (
          <div className="flex flex-col h-full">
            {renderPageHeader('سياسة الخصوصية والشروط')}
            <div className="p-4 space-y-4">
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-accent mb-4">سياسة الخصوصية</h3>
                <div className="space-y-4 text-gray-600">
                  <p>نحن نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية.</p>
                  <h4 className="font-medium text-gray-900">جمع البيانات</h4>
                  <p>نقوم بجمع البيانات الضرورية فقط لتقديم خدماتنا.</p>
                  <h4 className="font-medium text-gray-900">استخدام البيانات</h4>
                  <p>نستخدم بياناتك لتحسين خدماتنا وتجربة المستخدم.</p>
                  <button 
                    onClick={handleOpenPrivacyPolicy}
                    className="mt-4 text-accent hover:text-accent-light transition-colors"
                  >
                    عرض سياسة الخصوصية كاملة
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <NotificationSettings onClose={handleBackToMain} />
        );

      default:
        return (
          <>
            {/* رأس القائمة */}
            <div className="p-6 bg-accent text-white flex items-center justify-between">
              <h2 className="text-xl font-bold">القائمة</h2>
              <button
                onClick={handleCloseAll}
                className="text-white/80 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* محتوى القائمة */}
            <div className="flex-1 overflow-y-auto">
              {/* روابط القائمة */}
              <nav className="p-4 space-y-2">
                <button
                  onClick={() => {
                    onClose();
                    window.dispatchEvent(new CustomEvent('open-captain-request'));
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-brand/5 text-gray-700"
                >
                  <Navigation className="w-5 h-5 text-accent" />
                  اطلب كابتن
                </button>

                <button
                  onClick={() => setCurrentPage('about')}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-brand/5 text-gray-700"
                >
                  <Info className="w-5 h-5 text-accent" />
                  من نحن
                </button>

                <button
                  onClick={handleOpenContactPage}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-brand/5 text-gray-700"
                >
                  <Phone className="w-5 h-5 text-accent" />
                  اتصل بنا
                </button>

                <button
                  onClick={() => setCurrentPage('privacy')}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-brand/5 text-gray-700"
                >
                  <Shield className="w-5 h-5 text-accent" />
                  سياسة الخصوصية
                </button>

                <button
                  onClick={() => setCurrentPage('notifications')}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-brand/5 text-gray-700"
                >
                  <Bell className="w-5 h-5 text-accent" />
                  إعدادات الإشعارات
                </button>
              </nav>
            </div>
          </>
        );
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={handleCloseAll}
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3 }}
            className="fixed top-0 right-0 h-full w-80 bg-white shadow-xl z-50"
          >
            <div className="flex flex-col h-full">
              {renderContent()}
            </div>
          </motion.div>
        </>
      )}

    </AnimatePresence>
  );
};

export default Sidebar;