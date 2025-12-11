import React, { useState } from 'react';
import { Bell, X, AlertCircle } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { 
  requestNotificationPermission, 
  isNotificationSupported,
  getNotificationPermissionStatus,
  sendTestNotification
} from '../lib/firebase';

interface NotificationSettingsProps {
  onClose: () => void;
}

const NotificationSettings: React.FC<NotificationSettingsProps> = ({ onClose }) => {
  const [isNativePlatform, setIsNativePlatform] = useState(Capacitor.isNativePlatform());
  const [orderNotifications, setOrderNotifications] = useState(true);
  const [promotionNotifications, setPromotionNotifications] = useState(true);
  const [statusUpdates, setStatusUpdates] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<string>('default');
  const [loading, setLoading] = useState(false);
  const [paymentNotifications, setPaymentNotifications] = useState(true);

  React.useEffect(() => {
    // Check current permission status
    const status = getNotificationPermissionStatus();
    setPermissionStatus(status);
    
    // Load saved preferences
    const savedPreferences = localStorage.getItem('notification_preferences');
    if (savedPreferences) {
      try {
        const prefs = JSON.parse(savedPreferences);
        setOrderNotifications(prefs.orders ?? true);
        setPromotionNotifications(prefs.promotions ?? true);
        setStatusUpdates(prefs.status ?? true);
        setPaymentNotifications(prefs.payments ?? true);
      } catch (error) {
        console.error('Error loading notification preferences:', error);
      }
    }
  }, []);

  const requestPermission = async () => {
    try {
      setLoading(true);
      console.log('Requesting notification permission from settings...');
      
      const granted = await requestNotificationPermission();
      console.log('Permission request result:', granted);
      
      setPermissionStatus(granted ? 'granted' : 'denied');
      
      if (granted) {
        console.log('Notification permission granted successfully');
        
        // Send a test notification immediately to confirm it works
        setTimeout(() => {
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            const testNotification = new Notification('🎉 تم تفعيل الإشعارات!', {
              body: 'هذا إشعار تجريبي من الو جيتك للتأكد من عمل النظام بشكل صحيح',
              icon: 'https://rrhoxgfnikmtgsxwvjuv.supabase.co/storage/v1/object/public/general/WhatsApp%20Image%202025-09-23%20at%2000.16.28.jpeg',
              dir: 'rtl',
              lang: 'ar',
              tag: 'activation-success',
              requireInteraction: false,
              vibrate: [200, 100, 200]
            });
            
            // Auto close after 5 seconds
            setTimeout(() => {
              testNotification.close();
            }, 5000);
          }
        }, 1000);
      } else {
        console.log('Notification permission denied or failed');
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      setPermissionStatus('denied');
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    try {
      const preferences = {
        orders: orderNotifications,
        promotions: promotionNotifications,
        status: statusUpdates,
        payments: paymentNotifications
      };
      
      localStorage.setItem('notification_preferences', JSON.stringify(preferences));
      
      // Update payment notifications setting
      if (paymentNotifications) {
        localStorage.setItem('payment_notifications_enabled', 'true');
      } else {
        localStorage.removeItem('payment_notifications_enabled');
      }
      
      // Show success message
      const successMessage = document.createElement('div');
      successMessage.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white py-2 px-4 rounded-lg shadow-lg z-[100]';
      successMessage.textContent = 'تم حفظ التفضيلات بنجاح';
      document.body.appendChild(successMessage);
      
      setTimeout(() => {
        document.body.removeChild(successMessage);
      }, 3000);
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-md mx-auto p-4 flex items-center justify-between">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-gray-700"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="font-medium">رجوع</span>
          </button>
          <h2 className="text-xl font-bold text-gray-900">إعدادات الإشعارات</h2>
          <div className="w-[80px]"></div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto p-4 space-y-6">
          {isNotificationSupported() ? (
            <>
              {/* Permission Status */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-brand/10 rounded-full flex items-center justify-center">
                    <Bell className="w-6 h-6 text-brand" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">حالة الإشعارات</h3>
                    <p className={`text-sm ${
                      permissionStatus === 'granted' ? 'text-green-600' :
                      permissionStatus === 'denied' ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {permissionStatus === 'granted' ? 'مفعلة' :
                       permissionStatus === 'denied' ? 'مرفوضة' : 'غير مفعلة'}
                    </p>
                  </div>
                </div>
                
                {permissionStatus !== 'granted' && (
                  <button 
                    onClick={requestPermission}
                    disabled={loading}
                    className="w-full bg-brand text-accent py-3 rounded-lg hover:bg-brand-light transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-t-transparent border-accent rounded-full animate-spin"></div>
                        جاري التفعيل...
                      </>
                    ) : (
                      <>
                        <Bell className="w-5 h-5" />
                        تفعيل الإشعارات
                      </>
                    )}
                  </button>
                )}
                
                {permissionStatus === 'granted' && (
                  <>
                    <div className="bg-green-50 p-3 rounded-lg text-green-700 text-sm mb-2">
                      ✅ الإشعارات مفعلة بنجاح!
                    </div>
                    <button
                      onClick={() => sendTestNotification('إشعار تجريبي', 'هذا إشعار تجريبي للتأكد من عمل النظام')}
                      className="w-full mt-2 bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <Bell className="w-5 h-5" />
                      إرسال إشعار تجريبي
                    </button>
                  </>
                )}
                
                {permissionStatus === 'denied' && (
                  <div className="mt-4 bg-yellow-50 p-3 rounded-lg text-yellow-700 text-sm">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">تم رفض الإذن</p>
                        <p className="mt-1">لتفعيل الإشعارات:</p>
                        <ul className="mt-2 text-xs space-y-1 list-disc list-inside">
                          <li>انقر على أيقونة القفل في شريط العنوان</li>
                          <li>اختر "السماح" للإشعارات</li>
                          <li>أعد تحميل الصفحة</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-yellow-50 p-4 rounded-xl text-yellow-700 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">الإشعارات غير متاحة</p>
                <p className="mt-1 text-sm">
                  متصفحك أو جهازك لا يدعم الإشعارات. يرجى استخدام متصفح حديث أو تثبيت التطبيق على جهازك.
                </p>
              </div>
            </div>
          )}

          {/* Notification Types */}
          <div className={`bg-white rounded-xl p-6 shadow-sm ${
            !isNotificationSupported() || permissionStatus !== 'granted' ? 'opacity-50' : ''
          }`}>
            <h3 className="font-semibold text-lg mb-4">أنواع الإشعارات</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">إشعارات الطلبات</p>
                  <p className="text-sm text-gray-600">إشعارات عن حالة طلباتك وتحديثاتها</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={orderNotifications} 
                    onChange={() => setOrderNotifications(!orderNotifications)}
                    disabled={!isNotificationSupported() || permissionStatus !== 'granted'}
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
                </label>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">إشعارات العروض</p>
                  <p className="text-sm text-gray-600">إشعارات عن العروض والخصومات الجديدة</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={promotionNotifications} 
                    onChange={() => setPromotionNotifications(!promotionNotifications)}
                    disabled={!isNotificationSupported() || permissionStatus !== 'granted'}
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
                </label>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">إشعارات الدفع</p>
                  <p className="text-sm text-gray-600">إشعارات عن حالة المدفوعات والمعاملات المالية</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={paymentNotifications} 
                    onChange={() => setPaymentNotifications(!paymentNotifications)}
                    disabled={!isNotificationSupported() || permissionStatus !== 'granted'}
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
                </label>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">تحديثات الحالة</p>
                  <p className="text-sm text-gray-600">إشعارات عن تحديثات حالة التطبيق والصيانة</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={statusUpdates} 
                    onChange={() => setStatusUpdates(!statusUpdates)}
                    disabled={!isNotificationSupported() || permissionStatus !== 'granted'}
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
                </label>
              </div>
            </div>
            
            {/* Test Notification Button */}
            {permissionStatus === 'granted' && (
              <button
                onClick={() => {
                  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                    new Notification('🧪 إشعار تجريبي من بين إديك', {
                      body: 'هذا إشعار تجريبي للتأكد من عمل النظام بشكل صحيح',
                      icon: 'https://rrhoxgfnikmtgsxwvjuv.supabase.co/storage/v1/object/public/general/WhatsApp%20Image%202025-09-23%20at%2000.16.28.jpeg',
                      dir: 'rtl',
                      lang: 'ar',
                      tag: 'test-notification',
                      vibrate: [200, 100, 200]
                    });
                  }
                }}
                className="w-full mt-3 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <Bell className="w-4 h-4" />
                إرسال إشعار تجريبي
              </button>
            )}
          </div>

          {/* Save Button */}
          <button 
            onClick={savePreferences}
            disabled={!isNotificationSupported() || permissionStatus !== 'granted'}
            className="w-full bg-brand text-accent py-3 rounded-lg hover:bg-brand-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            حفظ التفضيلات
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;