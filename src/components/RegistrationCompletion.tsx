import React, { useState, useEffect } from 'react';
import { User, Mail, MapPin, Home, X, Loader2, Check, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import NewAddressPage from './NewAddressPage';
import { getMainServiceAreas, getSubServiceAreas, ServiceArea } from '../lib/zones';

interface RegistrationCompletionProps {
  phone: string;
  onClose: () => void;
  onComplete: (userData: any) => void;
  referralCode?: string;
}

const RegistrationCompletion: React.FC<RegistrationCompletionProps> = ({
  phone,
  onClose,
  onComplete,
  referralCode
}) => {
  const { user } = useAuth();
  const [step, setStep] = useState<'info' | 'address'>('info');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [referralSuccess, setReferralSuccess] = useState<string | null>(null);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [pointsAwarded, setPointsAwarded] = useState<number | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [showServiceAreaPicker, setShowServiceAreaPicker] = useState(false);
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [selectedMainArea, setSelectedMainArea] = useState<ServiceArea | null>(null);
  const [subAreas, setSubAreas] = useState<ServiceArea[]>([]);

  // Get default city from localStorage
  const getDefaultCity = () => {
    const selectedServiceArea = localStorage.getItem('selectedServiceArea');
    const storedCity = localStorage.getItem('selectedCity');

    if (selectedServiceArea) return selectedServiceArea;
    if (storedCity) {
      try {
        const parsed = JSON.parse(storedCity);
        return typeof parsed === 'string' ? parsed : 'يطا';
      } catch {
        return storedCity;
      }
    }
    return 'يطا';
  };

  const [selectedCity, setSelectedCity] = useState<string>(getDefaultCity());

  // Fetch service areas
  useEffect(() => {
    const fetchServiceAreas = async () => {
      const areas = await getMainServiceAreas();
      setServiceAreas(areas.filter(area => area.status === 'active'));
    };
    fetchServiceAreas();
  }, []);

  const handleMainAreaClick = async (area: ServiceArea) => {
    try {
      const subs = await getSubServiceAreas(area.id);

      if (subs.length > 0) {
        setSelectedMainArea(area);
        setSubAreas(subs);
      } else {
        setSelectedCity(area.name);
        setShowServiceAreaPicker(false);
      }
    } catch (err) {
      console.error('Error fetching sub areas:', err);
      setSelectedCity(area.name);
      setShowServiceAreaPicker(false);
    }
  };

  const handleBackToMain = () => {
    setSelectedMainArea(null);
    setSubAreas([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setReferralSuccess(null);
    setReferralError(null);

    // تحقق من وجود الاسم
    if (!name || name.trim() === '') {
      setError('الاسم مطلوب');
      return;
    }

    setLoading(true);

    try {
      // Create or update the customer with the provided details
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .upsert({
          phone,
          name,
          email: email || null
        }, {
          onConflict: 'phone',
          returning: 'representation'
        })
        .select();

      if (customerError) throw customerError;

      if (!customerData || customerData.length === 0) {
        throw new Error('فشل في إنشاء الحساب');
      }

      const newCustomerId = customerData[0].id;
      setCustomerId(newCustomerId);

      // If referral code is provided, process the referral
      if (referralCode && newCustomerId) {
        try {

          const { data: referrerData, error: referrerError } = await supabase
            .from('customers')
            .select('id')
            .eq('referral_code', referralCode)
            .maybeSingle();

          if (referrerError || !referrerData) {
            console.error('Error finding referrer:', referrerError);
            setReferralError('رمز الإحالة غير صالح');
          } else if (referrerData.id === newCustomerId) {
            setReferralError('لا يمكنك استخدام رمز الإحالة الخاص بك');
          } else {
            const { data: settings } = await supabase
              .from('referral_settings')
              .select('*')
              .eq('is_active', true)
              .maybeSingle();

            const referrerPoints = settings?.referrer_points || 50;
            const referredPoints = settings?.referred_points || 50;

            const { error: referralInsertError } = await supabase
              .from('referrals')
              .insert({
                referrer_id: referrerData.id,
                referred_id: newCustomerId,
                used_referral_code: referralCode,
                status: 'pending',
                referrer_reward_points: referrerPoints,
                referred_reward_points: referredPoints
              });

            if (referralInsertError) {
              console.error('Error creating referral:', referralInsertError);
              if (referralInsertError.code === '23505') {
                setReferralError('تم استخدام رمز الإحالة من قبل');
              } else {
                setReferralError('فشل في معالجة رمز الإحالة');
              }
            } else {
              await supabase
                .from('customers')
                .update({ referred_by: referrerData.id })
                .eq('id', newCustomerId);

              setReferralSuccess(`تم تطبيق رمز الإحالة بنجاح! ستحصل على ${referredPoints} نقطة عند أول طلب`);
              setPointsAwarded(referredPoints);
            }
          }
        } catch (referralErr) {
          console.error('Error processing referral:', referralErr);
          setReferralError('فشل في معالجة رمز الإحالة');
        }
      }
      
      setSuccess(true);
      // Store user data in localStorage
      console.log('Storing user data in localStorage:', customerData[0]);
      const userData = {
        id: customerData[0].id,
        name: name.trim(),
        phone: phone,
        email: email || customerData[0].email,
        customer_id: customerData[0].id
      };

      // Save session in localStorage
      localStorage.setItem('auth_user', JSON.stringify(userData));

      // Dispatch auth change event
      window.dispatchEvent(new Event('auth-change'));

      // Move to address step instead of closing
      setTimeout(() => {
        setStep('address');
      }, 1500);
    } catch (err: any) {
      console.error('Complete Profile Error:', err);
      setError('فشل إكمال الملف الشخصي');
      console.error('Error details:', err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddressSaved = (addressData: any) => {
    console.log('Address saved:', addressData);
    // Complete registration and redirect to home
    const userData = JSON.parse(localStorage.getItem('auth_user') || '{}');
    onComplete(userData);
    // Redirect to home page
    setTimeout(() => {
      window.location.href = '/';
    }, 500);
  };

  // Show address form if we're on address step
  if (step === 'address' && customerId) {
    return (
      <NewAddressPage
        onClose={() => {
          // User completed registration, redirect to home
          const userData = JSON.parse(localStorage.getItem('auth_user') || '{}');
          onComplete(userData);
          setTimeout(() => {
            window.location.href = '/';
          }, 500);
        }}
        onSave={handleAddressSaved}
        preselectedCity={selectedCity}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col">
      <div className="bg-white shadow-sm">
        <div className="max-w-md mx-auto">
          <div className="p-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">إكمال التسجيل</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto p-4">
          {success ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-green-50 text-green-600 p-6 rounded-lg flex flex-col items-center gap-4 mt-8"
            >
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Loader2 className="w-8 h-8 text-green-500" />
                </motion.div>
              </div>
              <h3 className="text-xl font-bold">جاري التحضير...</h3>
              <p className="text-center">سننتقل الآن لإضافة عنوانك</p>

              {referralSuccess && (
                <div className="bg-brand/10 p-4 rounded-lg text-accent mt-4 w-full">
                  <p className="font-medium">{referralSuccess}</p>
                  {pointsAwarded && (
                    <p className="mt-2">تم إضافة {pointsAwarded} نقطة إلى حسابك!</p>
                  )}
                </div>
              )}

              {referralError && (
                <div className="bg-red-50 p-4 rounded-lg text-red-800 mt-4 w-full">
                  <p>{referralError}</p>
                </div>
              )}
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-brand/10 p-4 rounded-lg mb-6">
                <p className="text-accent font-medium">أهلاً بك ! يرجى إكمال بياناتك الشخصية.</p>
                {referralCode && (
                  <p className="text-sm text-brand mt-2">
                    سيتم تطبيق رمز الإحالة وإضافة النقاط إلى حسابك عند إكمال التسجيل.
                  </p>
                )}
              </div>
              
              {error && (
                <div className="bg-red-50 text-red-800 p-4 rounded-lg">
                  {error}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  الاسم الكامل *
                </label>
                <div className="relative">
                  <input 
                    type="text"
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="الاسم الكامل"
                    className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                    required
                  />
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  البريد الإلكتروني (اختياري)
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@email.com"
                    className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                    dir="ltr"
                  />
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  منطقة التوصيل *
                </label>
                <button
                  type="button"
                  onClick={() => setShowServiceAreaPicker(true)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand bg-white hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <span className="text-gray-900 font-medium">{selectedCity}</span>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
                <p className="text-xs text-gray-500 mt-1">اختر المنطقة التي سيتم التوصيل إليها</p>
              </div>

              {/* Service Area Picker Modal */}
              {showServiceAreaPicker && (
                <div className="fixed inset-0 bg-black/50 z-[999999] flex items-end sm:items-center justify-center">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[70vh] flex flex-col"
                  >
                    <div className="p-4 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-gray-900">
                          {selectedMainArea ? `اختر منطقة في ${selectedMainArea.name}` : 'اختر منطقة التوصيل'}
                        </h3>
                        <button
                          onClick={() => {
                            setShowServiceAreaPicker(false);
                            setSelectedMainArea(null);
                            setSubAreas([]);
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                      {selectedMainArea && (
                        <button
                          onClick={handleBackToMain}
                          className="mb-3 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2 text-gray-700 transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                          <span className="font-medium text-sm">رجوع للمناطق الرئيسية</span>
                        </button>
                      )}

                      <div className="space-y-2">
                        {(selectedMainArea ? subAreas : serviceAreas).map((area) => (
                          <button
                            key={area.id}
                            onClick={() => {
                              if (selectedMainArea) {
                                setSelectedCity(area.name);
                                setShowServiceAreaPicker(false);
                                setSelectedMainArea(null);
                                setSubAreas([]);
                              } else {
                                handleMainAreaClick(area);
                              }
                            }}
                            className={`w-full p-4 rounded-lg border-2 transition-all text-right ${
                              selectedCity === area.name
                                ? 'bg-brand/10 border-brand'
                                : 'bg-white border-gray-200 hover:border-brand/50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-gray-900">{area.name}</span>
                              {selectedCity === area.name && (
                                <Check className="w-5 h-5 text-brand" />
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
              
              <button 
                type="submit" 
                disabled={loading} 
                className="w-full bg-brand text-accent py-3 rounded-lg hover:bg-brand-light transition-colors flex items-center justify-center gap-2 mt-4"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    جاري الإنشاء...
                  </>
                ) : (
                  'إكمال التسجيل'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default RegistrationCompletion;