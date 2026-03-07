import React, { useState, useEffect } from 'react';
import { User, Mail, MapPin, X, Loader2, Check, ChevronRight, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
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
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [referralSuccess, setReferralSuccess] = useState<string | null>(null);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [pointsAwarded, setPointsAwarded] = useState<number | null>(null);
  const [showServiceAreaPicker, setShowServiceAreaPicker] = useState(false);
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [selectedMainArea, setSelectedMainArea] = useState<ServiceArea | null>(null);
  const [subAreas, setSubAreas] = useState<ServiceArea[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [detailedAddress, setDetailedAddress] = useState('');
  const [addressLabel, setAddressLabel] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('');

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

    // تحقق من وجود منطقة التوصيل
    if (!selectedCity) {
      setError('يرجى اختيار منطقة التوصيل');
      return;
    }

    // تحقق من وجود العنوان التفصيلي
    if (!detailedAddress || detailedAddress.trim() === '') {
      setError('العنوان التفصيلي مطلوب');
      return;
    }

    // تحقق من وجود تسمية العنوان
    if (!addressLabel || addressLabel.trim() === '') {
      setError('تسمية العنوان مطلوبة');
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

      // Find the service area ID for the selected city
      const { data: serviceAreaData } = await supabase
        .from('service_areas')
        .select('id')
        .eq('name', selectedCity)
        .maybeSingle();

      // Create the customer address
      const { error: addressError } = await supabase
        .from('customer_addresses')
        .insert({
          customer_id: newCustomerId,
          name: addressLabel,
          address: detailedAddress,
          city: selectedCity,
          phone: phone,
          is_default: true,
          detailed_address: detailedAddress,
          service_area_id: serviceAreaData?.id || null,
          label: addressLabel
        });

      if (addressError) {
        console.error('Error creating address:', addressError);
      }

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

      // Save selected city to localStorage
      localStorage.setItem('selectedServiceArea', selectedCity);
      localStorage.setItem('selectedCity', JSON.stringify(selectedCity));

      // Dispatch auth change and service area change events
      window.dispatchEvent(new Event('auth-change'));
      window.dispatchEvent(new CustomEvent('serviceAreaChanged', {
        detail: { areaName: selectedCity }
      }));

      // Redirect to home immediately after successful registration
      setTimeout(() => {
        onComplete(userData);
        window.location.href = '/';
      }, 1500);
    } catch (err: any) {
      console.error('Complete Profile Error:', err);
      console.error('Error details:', err);

      let errorMessage = 'فشل إكمال التسجيل';

      if (err?.message) {
        errorMessage = err.message;
      } else if (err?.error_description) {
        errorMessage = err.error_description;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }

      setError(`${errorMessage}. يرجى المحاولة مرة أخرى.`);
    } finally {
      setLoading(false);
    }
  };


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
        <div className="max-w-md mx-auto p-4 pb-24">
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
              <h3 className="text-xl font-bold">تم التسجيل بنجاح!</h3>
              <p className="text-center">جاري تسجيل الدخول...</p>

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
                <p className="text-accent font-medium">أهلاً بك ! يرجى إكمال بياناتك الشخصية وعنوان التوصيل.</p>
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

              <div className="border-t border-gray-200 pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-5 h-5 text-brand" />
                  <h3 className="text-lg font-bold text-gray-900">عنوان التوصيل</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">أضف عنوان التوصيل الخاص بك لتسهيل عملية الطلب</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  المنطقة الرئيسية والفرعية <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowServiceAreaPicker(true)}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand bg-white hover:bg-gray-50 transition-colors flex items-center justify-between ${
                    !selectedCity ? 'border-red-300 bg-red-50/30' : 'border-gray-300'
                  }`}
                >
                  <span className={`font-medium ${selectedCity ? 'text-gray-900' : 'text-red-500'}`}>
                    {selectedCity || 'انقر لاختيار المنطقة'}
                  </span>
                  <ChevronRight className={`w-5 h-5 ${!selectedCity ? 'text-red-400' : 'text-gray-400'}`} />
                </button>
                {!selectedCity && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <span>⚠️</span>
                    <span>يجب اختيار منطقة التوصيل للمتابعة</span>
                  </p>
                )}
                {selectedCity && (
                  <p className="text-xs text-gray-500 mt-1">المنطقة المختارة: {selectedCity}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  تسمية العنوان <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={addressLabel}
                    onChange={(e) => setAddressLabel(e.target.value)}
                    placeholder="مثل: المنزل، العمل، المدرسة"
                    className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                    required
                  />
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                </div>
                <p className="text-xs text-gray-500 mt-1">اسم مميز لهذا العنوان (مثل: المنزل، العمل)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  العنوان التفصيلي <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <textarea
                    value={detailedAddress}
                    onChange={(e) => setDetailedAddress(e.target.value)}
                    placeholder="اكتب العنوان التفصيلي (الشارع، رقم المبنى، معالم قريبة...)"
                    className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand min-h-[100px] resize-none"
                    required
                  />
                  <MapPin className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                </div>
                <p className="text-xs text-gray-500 mt-1">أدخل تفاصيل العنوان بدقة لتسهيل التوصيل</p>
              </div>

              {/* Service Area Picker Modal */}
              {showServiceAreaPicker && (
                <div className="fixed inset-0 bg-black/50 z-[9999999] flex items-end sm:items-center justify-center">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[70vh] flex flex-col relative z-[10000000]"
                  >
                    <div className="p-4 border-b border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-bold text-gray-900">
                          {selectedMainArea ? `اختر منطقة في ${selectedMainArea.name}` : 'اختر منطقة التوصيل'}
                        </h3>
                        <button
                          onClick={() => {
                            setShowServiceAreaPicker(false);
                            setSelectedMainArea(null);
                            setSubAreas([]);
                            setSearchQuery('');
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Search Input */}
                      <div className="relative">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="ابحث عن منطقة..."
                          className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                        />
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
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
                        {(selectedMainArea ? subAreas : serviceAreas)
                          .filter(area => area.name.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map((area) => (
                            <button
                              key={area.id}
                              onClick={() => {
                                if (selectedMainArea) {
                                  setSelectedCity(area.name);
                                  setShowServiceAreaPicker(false);
                                  setSelectedMainArea(null);
                                  setSubAreas([]);
                                  setSearchQuery('');
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

                        {/* No Results Message */}
                        {searchQuery && (selectedMainArea ? subAreas : serviceAreas)
                          .filter(area => area.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                          <div className="text-center py-8">
                            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">لا توجد مناطق تطابق البحث</p>
                            <button
                              onClick={() => setSearchQuery('')}
                              className="mt-3 text-brand hover:text-brand-light text-sm font-medium"
                            >
                              مسح البحث
                            </button>
                          </div>
                        )}
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