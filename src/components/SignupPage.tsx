import React, { useState, useEffect } from 'react';
import { Phone, AlertCircle, Loader2, Info, X, WifiOff, UserPlus, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import RegistrationCompletion from './RegistrationCompletion';

interface SignupPageProps {
  onClose: () => void;
  referralCode?: string;
}

const SignupPage: React.FC<SignupPageProps> = ({ onClose, referralCode }) => {
  const { user } = useAuth();
  const [step, setStep] = useState<'phone' | 'otp' | 'complete'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [referralInfo, setReferralInfo] = useState<any>(null);
  const [referralLoading, setReferralLoading] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);

  useEffect(() => {
    // If user is already logged in, close the page
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

  // Fetch referral information if a code is provided
  useEffect(() => {
    const fetchReferralInfo = async () => {
      if (!referralCode) return;
      
      try {
        setReferralLoading(true);
        setError(null);
        
        console.log('Fetching referral info for code:', referralCode);
        
        // Check if the referral code exists - fix the ambiguous relationship
        const { data, error } = await supabase
          .from('referral_codes')
          .select(`
            *,
            customer:customers!referral_codes_customer_id_fkey(name)
          `)
          .eq('code', referralCode)
          .eq('status', 'active')
          .single();
          
        if (error) {
          console.error('Error fetching referral info:', error);
          setError(`رمز الإحالة غير صالح: ${error.message}`);
          return;
        }
        
        console.log('Referral info fetched successfully:', data);
        setReferralInfo(data);
      } catch (err) {
        console.error('Error fetching referral info:', err);
        setError('لم نتمكن من العثور على رمز الإحالة المحدد');
      } finally {
        setReferralLoading(false);
      }
    };
    
    if (referralCode) {
      fetchReferralInfo();
    }
  }, [referralCode]);

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!isOnline) return setError('لا يوجد اتصال بالإنترنت.');
    if (!phone.match(/^0\d{9}$/)) return setError('يرجى إدخال رقم هاتف يبدأ بـ 0 ويتكون من 10 أرقام');

    setLoading(true);
    try {
      console.log('Sending OTP request for phone:', phone);
      
      // Call the send_otp function with better error handling
      const response = await supabase.functions.invoke('send-otp', {
        body: { phone }
      });
      
      console.log('OTP response:', response);
      
      if (response.error) {
        console.error('Function invocation error:', response.error);
        throw new Error(response.error.message || 'فشل في استدعاء دالة إرسال OTP');
      }
      
      const { data } = response;
      
      if (data.success) {
        // عرض رسالة مناسبة حسب حالة الإرسال
        if (data.sms_sent) {
          setSuccess(data.message || `✅ تم إرسال رمز التحقق إلى ${phone} عبر SMS`);
        } else if (data.debug?.isTestMode) {
          setSuccess(data.debug.message || data.message || `🧪 الرمز: ${data.debug.otp}`);
        } else {
          setSuccess(data.message || '📱 تم إنشاء رمز التحقق');
        }
        setStep('otp');
      } else {
        // إذا فشل إرسال SMS ولكن تم إنشاء الرمز، اعرض الرمز
        if (data.debug?.otp && data.debug?.isTestMode) {
          setSuccess(data.debug.message || data.message || `⚠️ فشل SMS - الرمز: ${data.debug.otp}`);
          setStep('otp');
        } else {
          setError(data.message || 'فشل إرسال رمز التحقق');
        }
      }
      
      // طباعة تفاصيل إضافية للتشخيص
      if (data.debug) {
        console.log('🔍 SMS Debug Information:', {
          isTestMode: data.debug.isTestMode,
          phone: data.debug.phone,
          smsError: data.debug.smsError,
          twilioError: data.debug.twilioError,
          networkError: data.debug.networkError,
          twilioDetails: data.debug.twilioDetails,
          httpStatus: data.debug.httpStatus,
          errorType: data.debug.errorType,
          rawError: data.debug.rawError
        });
        
        // عرض رسالة مفصلة للمستخدم إذا كان هناك خطأ في SMS
        if (data.debug.smsError && !data.sms_sent) {
          console.warn('⚠️ SMS Failed - showing OTP for development:', data.debug.otp);
        }
      }
    } catch (error: any) {
      console.error('Error in sending OTP:', error);
      setError(typeof error.message === 'string' ? error.message : 'فشل في إرسال رمز التحقق. يرجى التحقق من الاتصال والمحاولة مرة أخرى.');
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
      console.log('Verifying OTP for phone:', phone, 'OTP:', otp, 'Referral:', referralCode);
      
      // استدعاء دالة التحقق من OTP
      const response = await supabase.functions.invoke('verify-otp', {
        body: {
          phone, 
          otp,
          referralCode 
        }
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
          // User exists, save session and redirect to home
          if (data.user) {
            localStorage.setItem('auth_user', JSON.stringify(data.user));

            // Dispatch auth change event
            window.dispatchEvent(new Event('auth-change'));

            // Close and redirect to home
            setTimeout(() => {
              onClose();
              window.location.href = '/';
            }, 1500);
          } else {
            // Just close and go to home
            setTimeout(() => {
              onClose();
              window.location.href = '/';
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
    // Close signup page and navigate to home
    setTimeout(() => {
      onClose();
      window.location.href = '/';
    }, 1500);
  };

  // Check if user can close (only if already logged in)
  const canClose = !!localStorage.getItem('auth_user');

  return (
    <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col" style={{
      paddingTop: 'max(env(safe-area-inset-top), 0px)'
    }}>
      <div className="bg-white shadow-sm">
        <div className="max-w-md mx-auto p-4 flex items-center justify-between">
          {canClose && (
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-gray-700"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="font-medium">رجوع</span>
            </button>
          )}
          {!canClose && <div className="w-[80px]"></div>}
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-brand" />
            إنشاء حساب جديد
          </h2>
          <div className="w-[80px]"></div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto p-4">
          {error && <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2"><AlertCircle className="w-5 h-5" /><p>{error}</p></div>}
          {success && !error && <div className="mb-6 bg-green-50 text-green-600 p-4 rounded-lg flex items-center gap-2"><Info className="w-5 h-5" /><p>{success}</p></div>}
          {!isOnline && (
            <div className="mb-6 bg-yellow-50 text-yellow-600 p-4 rounded-lg flex items-center gap-2">
              <WifiOff className="w-5 h-5" />
              <p>لا يوجد اتصال بالإنترنت. بعض الميزات قد لا تعمل بشكل صحيح.</p>
            </div>
          )}
          
          {/* Referral Information */}
          {referralCode && (
            <div className="mb-6 bg-brand/10 p-4 rounded-lg">
              {referralLoading ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-brand mr-2" />
                  <span>جاري التحقق من رمز الإحالة...</span>
                </div>
              ) : referralInfo ? (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-brand rounded-full flex items-center justify-center text-white flex-shrink-0">
                    <Check className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">تمت دعوتك بواسطة</h3>
                    <p className="text-gray-600">{referralInfo.customer?.name || 'مستخدم الو جيتك'}</p>
                    <p className="text-sm text-brand mt-1">
                      أكمل التسجيل للحصول على {referralInfo.points_reward} نقطة مكافأة!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-yellow-600">
                  <AlertCircle className="w-5 h-5" />
                  <p>رمز الإحالة غير صالح</p>
                </div>
              )}
            </div>
          )}

          {step === 'phone' && (
            <form onSubmit={handlePhoneSubmit} className="space-y-6">
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
                  لديك حساب بالفعل؟{' '}
                  <button 
                    type="button"
                    onClick={() => {
                      onClose();
                      window.dispatchEvent(new CustomEvent('open-login-page'));
                    }}
                    className="text-accent hover:text-accent-light font-medium"
                  >
                    تسجيل الدخول
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
              referralCode={referralCode}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default SignupPage;