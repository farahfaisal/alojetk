import React, { useState, useEffect } from 'react';
import { Phone, AlertCircle, Loader2, Info, X, WifiOff, ChevronLeft } from 'lucide-react';
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
      // Navigate to account page
      window.dispatchEvent(new CustomEvent('open-account-page'));
    }, 1500);
  };

  return (
    <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col" style={{
      paddingTop: 'max(env(safe-area-inset-top), 0px)'
    }}>
      <div className="bg-white shadow-sm">
        <div className="max-w-md mx-auto p-4 flex items-center justify-between">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-gray-700"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="font-medium">رجوع</span>
          </button>
          <h2 className="text-xl font-bold text-gray-900">تسجيل الدخول</h2>
          <div className="w-[80px]"></div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto p-4">
          {error && <div className="mb-6 bg-red-50 text-red-800 p-4 rounded-lg flex items-center gap-2"><AlertCircle className="w-5 h-5" /><p>{error}</p></div>}
          {success && !error && <div className="mb-6 bg-green-50 text-green-600 p-4 rounded-lg flex items-center gap-2"><Info className="w-5 h-5" /><p>{success}</p></div>}
          {!isOnline && (
            <div className="mb-6 bg-yellow-50 text-yellow-600 p-4 rounded-lg flex items-center gap-2">
              <WifiOff className="w-5 h-5" />
              <p>لا يوجد اتصال بالإنترنت. بعض الميزات قد لا تعمل بشكل صحيح.</p>
            </div>
          )}

          {step === 'phone' && (
            <form onSubmit={handlePhoneSubmit} className="space-y-6">
              {/* Test Account Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-bold text-blue-900 mb-1">حساب تجريبي للاختبار:</p>
                    <p className="text-blue-800">رقم الهاتف: <span className="font-mono font-bold">0595284308</span></p>
                    <p className="text-blue-800">رمز التحقق: <span className="font-mono font-bold">123456</span></p>
                  </div>
                </div>
              </div>

              <div className="relative">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="05xxxxxxxx"
                  className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                  dir="ltr"
                />
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <div className="text-xs text-gray-500 mt-1">أدخل رقم هاتف فلسطيني يبدأ بـ 05</div>
              </div>
              <button 
                type="submit" 
                disabled={loading} 
                className="w-full bg-brand text-accent py-3 rounded-lg hover:bg-brand-light transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'متابعة'}
              </button>
              
              <div className="text-center">
                <p className="text-gray-600">
                  ليس لديك حساب بالفعل؟{' '}
                  <button 
                    type="button"
                    onClick={() => {
                      onClose();
                      window.dispatchEvent(new CustomEvent('open-signup-page'));
                    }}
                    className="text-accent hover:text-accent-light font-medium"
                  >
                    إنشاء حساب
                  </button>
                </p>
              </div>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleOtpSubmit} className="space-y-6">
              <div className="text-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">التحقق من رقم الهاتف</h3>
                <p className="text-gray-600">تم إرسال رمز التحقق إلى {phone}</p>
              </div>
              
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="أدخل رمز التحقق"
                maxLength={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-center text-2xl tracking-wider"
                dir="ltr"
              />
              <div className="flex justify-between gap-4">
                <button 
                  onClick={handleCancel} 
                  type="button" 
                  className="w-1/2 bg-gray-100 py-3 rounded-lg"
                >
                  رجوع
                </button>
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="w-1/2 bg-brand text-accent py-3 rounded-lg hover:bg-brand-light transition-colors flex items-center justify-center gap-2"
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
    </div>
  );
};

export default LoginPage;