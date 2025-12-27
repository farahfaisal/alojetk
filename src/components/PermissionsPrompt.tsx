import React, { useState, useEffect } from 'react';
import { MapPin, X, Check, Info, AlertCircle, Bell, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { 
  requestNotificationPermission, 
  requestLocationPermission,
  isNotificationSupported,
  isLocationSupported,
  getNotificationPermissionStatus,
  requestPaymentNotificationPermission,
  initializeFirebase
} from '../lib/firebase';

interface PermissionsPromptProps {
  onClose: () => void;
}

const PermissionsPrompt: React.FC<PermissionsPromptProps> = ({ onClose }) => {
  const [step, setStep] = useState<'intro' | 'location' | 'notifications' | 'complete'>('intro');
  const [isNativePlatform, setIsNativePlatform] = useState(false);
  const [locationPermission, setLocationPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [notificationPermission, setNotificationPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [loading, setLoading] = useState(false);
  const [locationSupported, setLocationSupported] = useState(false);
  const [notificationSupported, setNotificationSupported] = useState(false);
  const [showPaymentNotifications, setShowPaymentNotifications] = useState(false);

  useEffect(() => {
    // Initialize Firebase when component mounts
    initializeFirebase();
    
    // Check if running on a native platform
    setIsNativePlatform(Capacitor.isNativePlatform());
    
    // Check if features are supported
    setLocationSupported(isLocationSupported());
    setNotificationSupported(isNotificationSupported());
    
    // Check current permission status
    if (isNotificationSupported()) {
      const status = getNotificationPermissionStatus();
      if (status === 'granted') {
        setNotificationPermission('granted');
      } else if (status === 'denied') {
        setNotificationPermission('denied');
      }
    }
  }, []);

  const requestLocation = async () => {
    try {
      setLoading(true);
      console.log('📍 Requesting location permission from prompt...');
      
      if (!locationSupported) {
        console.log('⚠️ Location not supported on this device');
        setLocationPermission('denied');
        if (notificationSupported) {
          setStep('notifications');
        } else {
          setStep('complete');
        }
        return;
      }
      
      const granted = await requestLocationPermission();
      console.log('📍 Location permission result from prompt:', granted);
      
      setLocationPermission(granted ? 'granted' : 'denied');
      
      // Save permission status
      const currentStatus = JSON.parse(localStorage.getItem('permissions_status') || '{}');
      localStorage.setItem('permissions_status', JSON.stringify({
        ...currentStatus,
        location: granted ? 'granted' : 'denied',
        timestamp: Date.now()
      }));
      
      // Automatically move to next step after location permission
      setTimeout(() => {
        if (notificationSupported) {
          setStep('notifications');
        } else {
          setStep('complete');
        }
      }, 1000);
    } catch (error) {
      console.error('Error requesting location permission:', error);
      setLocationPermission('denied');
      // Still move to next step even if location failed
      setTimeout(() => {
        if (notificationSupported) {
          setStep('notifications');
        } else {
          setStep('complete');
        }
      }, 1000);
    } finally {
      setLoading(false);
    }
  };

  const requestNotifications = async () => {
    try {
      setLoading(true);
      console.log('🔔 Notifications disabled - skipping to complete');
      setNotificationPermission('denied');
      setStep('complete');
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      setNotificationPermission('denied');
      // Still move to complete step even if notifications failed
      setTimeout(() => {
        setStep('complete');
      }, 1500);
    } finally {
      setLoading(false);
    }
  };

  const handleSkipLocation = () => {
    setLocationPermission('denied');
    setStep('notifications');
  };

  const handleSkipNotifications = () => {
    setNotificationPermission('denied');
    setStep('complete');
  };

  const handleFinish = () => {
    // Save permission status
    localStorage.setItem('permissions_status', JSON.stringify({
      location: locationPermission,
      notifications: notificationPermission,
      timestamp: Date.now()
    }));
    
    onClose();
  };

  const renderIntroStep = () => (
    <div className="space-y-6">
      <div className="bg-brand/10 p-6 rounded-xl">
        <h3 className="text-xl font-bold text-accent mb-4 text-center">مرحباً بك في تطبيق بين إديك!</h3>
        <h3 className="text-xl font-bold text-accent mb-4 text-center">مرحباً بك في تطبيق الو جيتك!</h3>
        <p className="text-gray-700 mb-4">
          لتقديم أفضل تجربة ممكنة في الو جيتك، نحتاج إلى بعض الأذونات:
        </p>
        <ul className="space-y-3">
          {locationSupported && (
            <li className="flex items-start gap-3">
              <div className="w-8 h-8 bg-brand/20 rounded-full flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="font-medium text-gray-800">الوصول للموقع</p>
                <p className="text-sm text-gray-600">لتحديد عنوان التوصيل وإيجاد المتاجر القريبة</p>
              </div>
            </li>
          )}
          {notificationSupported && (
            <li className="flex items-start gap-3">
              <div className="w-8 h-8 bg-brand/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Bell className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="font-medium text-gray-800">الإشعارات</p>
                <p className="text-sm text-gray-600">لإعلامك بحالة طلباتك والعروض الخاصة</p>
              </div>
            </li>
          )}
        </ul>
        
        {(!locationSupported && !notificationSupported) && (
          <div className="mt-6 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-700">ملاحظة</p>
                <p className="text-sm text-yellow-600 mt-1">
                  متصفحك أو جهازك لا يدعم هذه الميزات. يمكنك استخدام التطبيق بدونها.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <button
        onClick={() => {
          if (locationSupported) {
            setStep('location');
          } else if (notificationSupported) {
            setStep('notifications');
          } else {
            setStep('complete');
          }
        }}
        className="w-full bg-brand text-accent py-3 rounded-lg hover:bg-brand-light transition-colors"
      >
        {(locationSupported || notificationSupported) ? 'متابعة' : 'إنهاء'}
      </button>
      
      <button
        onClick={handleFinish}
        className="w-full py-2 text-gray-600 hover:text-gray-800 transition-colors"
      >
        تخطي
      </button>
    </div>
  );

  const renderLocationStep = () => (
    <div className="space-y-6">
      <div className="bg-brand/10 p-6 rounded-xl">
        <div className="w-16 h-16 bg-brand/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <MapPin className="w-8 h-8 text-accent" />
        </div>
        <h3 className="text-xl font-bold text-accent mb-4 text-center">السماح بالوصول للموقع</h3>
        <p className="text-gray-700 mb-4">
          نحتاج إلى الوصول لموقعك لتحديد عنوان التوصيل وإيجاد المتاجر القريبة منك.
        </p>
        
        {locationPermission === 'denied' && (
          <div className="bg-red-50 p-4 rounded-lg text-red-600 flex items-start gap-2 mb-4">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">تم رفض الإذن</p>
              <p className="mt-1 text-sm">يرجى تفعيل الوصول للموقع من إعدادات المتصفح أو الجهاز.</p>
            </div>
          </div>
        )}
        
        {locationPermission === 'granted' && (
          <div className="bg-green-50 p-4 rounded-lg text-green-600 flex items-start gap-2 mb-4">
            <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>تم منح الإذن بنجاح!</p>
          </div>
        )}
        
        <div className="mt-6 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-700">لماذا نحتاج إلى هذا الإذن؟</p>
              <ul className="text-sm text-yellow-600 mt-2 space-y-1 list-disc list-inside">
                <li>تحديد موقعك الحالي تلقائياً</li>
                <li>إظهار المتاجر القريبة منك</li>
                <li>حساب رسوم التوصيل بدقة</li>
                <li>تقديم تجربة مخصصة لك</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      <button
        onClick={requestLocation}
        disabled={loading || locationPermission === 'granted'}
        className="w-full bg-brand text-accent py-3 rounded-lg hover:bg-brand-light transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <div className="w-5 h-5 border-2 border-t-transparent border-accent rounded-full animate-spin"></div>
            <span>جاري الطلب...</span>
          </>
        ) : locationPermission === 'granted' ? (
          <>
            <Check className="w-5 h-5" />
            <span>تم منح الإذن</span>
          </>
        ) : (
          <span>السماح بالوصول للموقع</span>
        )}
      </button>

      <button
        onClick={() => {
          if (notificationSupported) {
            setStep('notifications');
          } else {
            setStep('complete');
          }
        }}
        className="w-full py-2 text-gray-600 hover:text-gray-800 transition-colors"
      >
        {locationPermission === 'granted' ? 'متابعة' : 'تخطي هذه الخطوة'}
      </button>
    </div>
  );

  const renderNotificationsStep = () => (
    <div className="space-y-6">
      <div className="bg-brand/10 p-6 rounded-xl">
        <div className="w-16 h-16 bg-brand/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Bell className="w-8 h-8 text-accent" />
        </div>
        <h3 className="text-xl font-bold text-accent mb-4 text-center">السماح بالإشعارات</h3>
        <p className="text-gray-700 mb-4">
          نحتاج إلى إذن الإشعارات لإعلامك بحالة طلباتك والعروض الخاصة.
        </p>
        
        {notificationPermission === 'denied' && (
          <div className="bg-red-50 p-4 rounded-lg text-red-600 flex items-start gap-2 mb-4">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">تم رفض الإذن</p>
              <p className="mt-1 text-sm">يرجى تفعيل الإشعارات من إعدادات المتصفح أو الجهاز.</p>
            </div>
          </div>
        )}
        
        {notificationPermission === 'granted' && (
          <div className="bg-green-50 p-4 rounded-lg text-green-600 flex items-start gap-2 mb-4">
            <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>تم منح الإذن بنجاح!</p>
          </div>
        )}
        
        <div className="mt-6 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-700">لماذا نحتاج إلى هذا الإذن؟</p>
              <ul className="text-sm text-yellow-600 mt-2 space-y-1 list-disc list-inside">
                <li>إعلامك بحالة طلباتك</li>
                <li>إرسال تنبيهات مهمة</li>
                <li>إخبارك بالعروض والخصومات</li>
                <li>تأكيد المدفوعات والمعاملات المالية</li>
                <li>تقديم تجربة مخصصة لك</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      <button
        onClick={requestNotifications}
        disabled={loading || notificationPermission === 'granted'}
        className="w-full bg-brand text-accent py-3 rounded-lg hover:bg-brand-light transition-colors disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
      >
        {loading ? (
          <>
            <div className="w-5 h-5 border-2 border-t-transparent border-accent rounded-full animate-spin"></div>
            <span>جاري الطلب...</span>
          </>
        ) : notificationPermission === 'granted' ? (
          <>
            <Check className="w-5 h-5" />
            <span>تم منح الإذن</span>
          </>
        ) : (
          <>
            <Bell className="w-5 h-5" />
            <span>السماح بالإشعارات</span>
          </>
        )}
      </button>
      
      {/* Payment Notifications Toggle */}
      {notificationPermission === 'granted' && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-blue-900">إشعارات الدفع</p>
              <p className="text-sm text-blue-700">تلقي إشعارات خاصة بالمدفوعات</p>
            </div>
            <button
              onClick={async () => {
                const enabled = await requestPaymentNotificationPermission();
                setShowPaymentNotifications(enabled);
              }}
              className="bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-600 transition-colors"
            >
              تفعيل إشعارات الدفع
            </button>
          </div>
        </div>
      )}
      
      <button
        onClick={() => setStep('complete')}
        className="w-full py-2 text-gray-600 hover:text-gray-800 transition-colors"
      >
        {notificationPermission === 'granted' ? 'متابعة' : 'تخطي هذه الخطوة'}
      </button>
    </div>
  );

  const renderCompleteStep = () => (
    <div className="space-y-6">
      <div className="bg-brand/10 p-6 rounded-xl">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-xl font-bold text-accent mb-4 text-center">تم الإعداد بنجاح!</h3>
        <p className="text-gray-700 mb-4 text-center">
          شكراً لك! يمكنك الآن الاستمتاع بكامل مزايا تطبيق بين إديك.
        </p>
        
        <div className="space-y-3 mt-6">
          {locationSupported && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-brand/20 rounded-full flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="font-medium text-gray-800">
                  الوصول للموقع: {locationPermission === 'granted' ? 'مفعل' : 'غير مفعل'}
                </p>
              </div>
            </div>
          )}
          
          {notificationSupported && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-brand/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Bell className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="font-medium text-gray-800">
                  الإشعارات: {notificationPermission === 'granted' ? 'مفعلة' : 'غير مفعلة'}
                </p>
              </div>
            </div>
          )}
        </div>
        
        {(locationPermission !== 'granted' || notificationPermission !== 'granted') && (
          <div className="bg-yellow-50 p-4 rounded-lg text-yellow-700 flex items-start gap-2 mt-4">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">تنبيه!</p>
              <p className="text-sm mt-1">
                لم تمنح بعض الأذونات المطلوبة. يمكنك تغيير إعدادات الأذونات لاحقاً من خلال إعدادات المتصفح أو الجهاز.
              </p>
            </div>
          </div>
        )}
      </div>
      
      <button
        onClick={handleFinish}
        className="w-full bg-brand text-accent py-3 rounded-lg hover:bg-brand-light transition-colors"
      >
        ابدأ الاستخدام
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden"
      >
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">إعدادات الأذونات</h2>
          <button
            onClick={handleFinish}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        <div className="p-6">
          {step === 'intro' && renderIntroStep()}
          {step === 'location' && renderLocationStep()}
          {step === 'notifications' && renderNotificationsStep()}
          {step === 'complete' && renderCompleteStep()}
        </div>
      </motion.div>
    </div>
  );
};

export default PermissionsPrompt;