import React, { useState, useEffect } from 'react';
import { Phone, AlertCircle, Loader2, Info, X, WifiOff, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import RegistrationCompletion from './RegistrationCompletion';

const LoginPage: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<'phone' | 'otp' | 'complete'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);

  useEffect(() => {
    // إذا كان المستخدم مسجل دخوله بالفعل، إغلاق الصفحة
    if (user) {
      onClose();
    }
  }, [user, onClose]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!isOnline) return setError('لا يوجد اتصال بالإنترنت.');
    if (!phone.match(/^0\d{9}$/)) return setError('يرجى إدخال رقم هاتف يبدأ بـ 0 ويتكون من 10 أرقام');

    setLoading(true);
    try {
      console.log('🚀 Starting OTP request for phone:', phone);
      
      // Test Supabase connection first
      const { testSupabaseConnection, testEdgeFunctions } = await import('../lib/supabase');
      
      console.log('🔗 Testing Supabase connection...');
      const connectionTest = await testSupabaseConnection();
      if (!connectionTest.success) {
        throw new Error(`فشل الاتصال بـ Supabase: ${connectionTest.error}`);
      }
      
      console.log('🔧 Testing Edge Functions...');
      const edgeFunctionTest = await testEdgeFunctions();
      if (!edgeFunctionTest.success) {
        console.warn('⚠️ Edge Function test failed:', edgeFunctionTest.error);
        // Continue anyway, might be a test issue
      }
      
      // Call the send_otp function with better error handling
      const response = await supabase.functions.invoke('send-otp', {
        body: { phone }
      });
      
      console.log('📨 Full OTP response:', {
        error: response.error,
        data: response.data,
        status: response.status
      });
      
      if (response.error) {
        console.error('❌ Function invocation error:', response.error);
        
        // Handle Twilio authentication errors specifically
        if (response.error.message?.includes('Failed to send a request to the Edge Function')) {
          throw new Error('مشكلة في إعدادات خدمة الرسائل النصية. يرجى المحاولة لاحقاً أو التواصل مع الدعم الفني.');
        } else if (response.error.message?.includes('Failed to fetch')) {
          throw new Error('فشل الاتصال بخادم الإشعارات. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.');
        } else if (response.error.message?.includes('timeout')) {
          throw new Error('انتهت مهلة الاتصال. يرجى المحاولة مرة أخرى.');
        } else {
          const errorMessage = typeof response.error === 'string' 
            ? response.error 
            : response.error?.message || 'فشل في استدعاء دالة إرسال OTP';
          throw new Error(errorMessage);
        }
      }
      
      const { data } = response;
      console.log('📊 Response data analysis:', {
        success: data?.success,
        sms_sent: data?.sms_sent,
        message: data?.message,
        hasDebug: !!data?.debug,
        debugKeys: data?.debug ? Object.keys(data.debug) : []
      });
      
      if (data.success) {
        // عرض رسالة مناسبة حسب حالة الإرسال
        if (data.sms_sent) {
          setSuccess(`✅ ${data.message || `تم إرسال رمز التحقق إلى ${phone} عبر SMS`}`);
        } else if (data.debug?.isTestMode) {
          setSuccess(`🧪 ${data.debug.message || data.message || `رقم تجريبي - الرمز: ${data.debug.otp}`}`);
        } else {
          setSuccess(`⚠️ ${data.message || 'تم إنشاء رمز التحقق ولكن فشل إرسال SMS'}`);
          
          // إذا فشل SMS وليس رقم تجريبي، اعرض تفاصيل إضافية
          if (data.debug?.smsError) {
            console.error('💥 SMS Error Details:', {
              error: data.debug.smsError,
              twilioError: data.debug.twilioError,
              networkError: data.debug.networkError,
              httpStatus: data.debug.httpStatus
            });
            
            // اعرض الرمز للمطور في حالة فشل SMS
            if (data.debug.otp) {
              setSuccess(`⚠️ فشل إرسال SMS - الرمز للاختبار: ${data.debug.otp}`);
            }
          }
        }
        setStep('otp');
      } else {
        // Handle Twilio authentication errors specifically
        if (data.debug?.accountVerificationError || data.debug?.accountError === 'Authenticate') {
          // For development/testing, allow user to proceed with the OTP code
          if (data.debug?.otp) {
            console.log('🔧 Development OTP Code (Twilio Auth Failed):', data.debug.otp);
            setSuccess(`🔧 خدمة الرسائل غير متاحة حالياً - رمز التحقق للاختبار: ${data.debug.otp}`);
            setStep('otp');
          } else {
            setError(`❌ خدمة الرسائل النصية غير متاحة حالياً. يرجى المحاولة لاحقاً أو التواصل مع الدعم الفني.`);
          }
        } else if (data.debug?.otp && data.debug?.isTestMode) {
          setSuccess(`🧪 ${data.debug.message || data.message || `رقم تجريبي - الرمز: ${data.debug.otp}`}`);
          setStep('otp');
        } else {
          setError(`❌ ${data.message || 'فشل إرسال رمز التحقق'}`);
        }
      }
    } catch (error: any) {
      console.error('💥 Critical error in sending OTP:', error);
      
      // Handle different types of errors with user-friendly messages
      if (error.message?.includes('مشكلة في إعدادات خدمة الرسائل النصية') || 
          error.message?.includes('Failed to send a request to the Edge Function')) {
        setError('خدمة الرسائل النصية غير متاحة حالياً. يرجى المحاولة لاحقاً أو التواصل مع الدعم الفني.');
      } else if (error.message?.includes('Failed to fetch') || error.message?.includes('فشل الاتصال')) {
        setError('مشكلة في الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.');
      } else if (error.message?.includes('timeout') || error.message?.includes('انتهت مهلة')) {
        setError('انتهت مهلة الاتصال. يرجى المحاولة مرة أخرى.');
      } else {
        setError('حدث خطأ في إرسال رمز التحقق. يرجى المحاولة مرة أخرى أو التواصل مع الدعم الفني.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!otp.match(/^\d{6}$/)) return setError('رمز التحقق يجب أن يتكون من 6 أرقام');

    setLoading(true);
    try {
      console.log('Verifying OTP for phone:', phone, 'OTP:', otp);
      
      const response = await supabase.functions.invoke('verify-otp', {
        body: { phone, otp }
      });
      
      console.log('Verification response:', response);
      
      if (response.error) {
        console.error('Function invocation error:', response.error);
        throw new Error('فشل في استدعاء دالة التحقق');
      }
      
      const { data } = response;
      console.log('Verification data received:', data);
      
      if (data.success) {
        setSuccess('تم التحقق بنجاح');
        
        if (data.existing_user) {
          // User exists, store user data and close
          if (data.user) {
            localStorage.setItem('auth_user', JSON.stringify(data.user));
            
            // Dispatch auth change event
            window.dispatchEvent(new Event('auth-change'));
            
            // Close login page after a short delay
            setTimeout(() => {
              onClose();
              // Navigate to account page
              window.dispatchEvent(new CustomEvent('open-account-page'));
            }, 1500);
          } else {
            // Just close the page
            setTimeout(() => {
              onClose();
            }, 1500);
          }
        } else {
          // New user, proceed to complete registration
          setVerifiedPhone(phone);
          setStep('complete');
        }
      } else {
        setError(data?.message || 'رمز التحقق غير صحيح أو منتهي الصلاحية');
      }
    } catch (err) {
      console.error('Error verifying OTP:', err);
      setError(err?.message || 'فشل في التحقق من الرمز. يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setStep('phone');
    setOtp('');
    setSuccess(null);
    setError(null);
  };

  const handleRegistrationComplete = (userData: any) => {
    // Close login page after a short delay
    setTimeout(() => {
      onClose();
      // Navigate to home page
      navigate('/');
    }, 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[999999] flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="bg-white rounded-t-3xl w-full max-w-lg shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxHeight: '85vh',
          paddingBottom: 'max(env(safe-area-inset-bottom), 20px)'
        }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
        </div>

        {/* Header */}
        <div className="px-6 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">تسجيل الدخول</h2>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="max-w-md mx-auto">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 bg-red-50 border-2 border-red-200 text-red-800 p-4 rounded-xl flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </motion.div>
          )}
          {success && !error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 bg-green-50 border-2 border-green-200 text-green-700 p-4 rounded-xl flex items-start gap-3"
            >
              <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{success}</p>
            </motion.div>
          )}
          {!isOnline && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 bg-yellow-50 border-2 border-yellow-200 text-yellow-700 p-4 rounded-xl flex items-start gap-3"
            >
              <WifiOff className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">لا يوجد اتصال بالإنترنت. بعض الميزات قد لا تعمل بشكل صحيح.</p>
            </motion.div>
          )}

          {step === 'phone' && (
            <form onSubmit={handlePhoneSubmit} className="space-y-6">
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-700">رقم الهاتف</label>
                <div className="relative">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="05xxxxxxxx"
                    className="w-full px-4 py-4 pr-12 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-lg"
                    dir="ltr"
                  />
                  <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                </div>
                <div className="text-xs text-gray-500">أدخل رقم هاتف فلسطيني يبدأ بـ 05</div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#B91C1C] to-[#991B1B] text-white py-4 rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 font-semibold text-lg"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'متابعة'}
              </button>
              
              <div className="space-y-4 pt-2">
                <div className="text-center">
                  <p className="text-gray-600 text-sm">
                    ليس لديك حساب بالفعل؟{' '}
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        window.dispatchEvent(new CustomEvent('open-signup-page'));
                      }}
                      className="text-[#B91C1C] hover:text-[#991B1B] font-semibold"
                    >
                      إنشاء حساب
                    </button>
                  </p>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-3 text-gray-500">أو</span>
                  </div>
                </div>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-gray-600 hover:text-gray-800 font-medium text-sm px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    تصفح كضيف
                  </button>
                </div>
              </div>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleOtpSubmit} className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">التحقق من رقم الهاتف</h3>
                <p className="text-gray-600">تم إرسال رمز التحقق إلى</p>
                <p className="text-lg font-semibold text-[#B91C1C] mt-1" dir="ltr">{phone}</p>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-700 text-center">رمز التحقق</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full px-4 py-5 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-center text-3xl tracking-[0.5em] font-bold"
                  dir="ltr"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  type="button"
                  className="flex-1 bg-gray-100 text-gray-700 py-4 rounded-xl hover:bg-gray-200 transition-colors font-semibold"
                >
                  رجوع
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-[#B91C1C] to-[#991B1B] text-white py-4 rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 font-semibold"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تأكيد'}
                </button>
              </div>
            </form>
          )}

          {step === 'complete' && verifiedPhone && (
            <RegistrationCompletion
              phone={verifiedPhone}
              onClose={onClose}
              onComplete={handleRegistrationComplete}
            />
          )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default LoginPage;