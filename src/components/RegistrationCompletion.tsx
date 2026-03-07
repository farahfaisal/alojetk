import React, { useState, useEffect } from 'react';
import { User, Mail, MapPin, X, Loader2, Check, Search, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [selectedMainAreaId, setSelectedMainAreaId] = useState<string>('');
  const [subAreas, setSubAreas] = useState<ServiceArea[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [subAreaSearchQuery, setSubAreaSearchQuery] = useState('');
  const [showSubAreaPicker, setShowSubAreaPicker] = useState(false);
  const [detailedAddress, setDetailedAddress] = useState('');
  const [addressLabel, setAddressLabel] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('');

  // Fetch service areas
  useEffect(() => {
    const fetchServiceAreas = async () => {
      const areas = await getMainServiceAreas();
      setServiceAreas(areas);
    };
    fetchServiceAreas();
  }, []);

  const handleMainAreaChange = async (areaId: string) => {
    setSelectedMainAreaId(areaId);
    setSelectedCity(''); // Reset sub area selection

    if (!areaId) {
      setSubAreas([]);
      setSelectedMainArea(null);
      return;
    }

    try {
      const area = serviceAreas.find(a => a.id === areaId);
      setSelectedMainArea(area || null);

      const subs = await getSubServiceAreas(areaId);
      setSubAreas(subs);

      // If no sub areas, use main area as selected city
      if (subs.length === 0 && area) {
        setSelectedCity(area.name);
      }
    } catch (err) {
      console.error('Error fetching sub areas:', err);
      setSubAreas([]);
    }
  };

  const handleSubAreaChange = (areaName: string) => {
    setSelectedCity(areaName);
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
          name: name,
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

              {/* Personal Information Section */}
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-brand" />
                  المعلومات الشخصية
                </h3>

                <div className="space-y-4">
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
                </div>
              </div>

              {/* Location Information Section */}
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-5 h-5 text-brand" />
                  <h3 className="text-lg font-bold text-gray-900">عنوان التوصيل</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">أضف عنوان التوصيل الخاص بك لتسهيل عملية الطلب</p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      تسمية العنوان <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={addressLabel}
                        onChange={(e) => setAddressLabel(e.target.value)}
                        placeholder="مثال: البيت، المدرسة، العمل، بيت جدي..."
                        className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                        required
                      />
                      <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    </div>
                    <p className="text-xs text-gray-600 mt-1.5 flex items-start gap-1">
                      <span className="text-brand mt-0.5">ℹ️</span>
                      <span>اختر اسماً مميزاً للعنوان لسهولة التعرف عليه عند الطلب</span>
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      المنطقة الرئيسية <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedMainAreaId}
                      onChange={(e) => handleMainAreaChange(e.target.value)}
                      className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand bg-white ${
                        !selectedMainAreaId ? 'border-red-300 text-gray-400' : 'border-gray-300 text-gray-900'
                      }`}
                      required
                    >
                      <option value="">اختر المنطقة الرئيسية</option>
                      {serviceAreas.map((area) => (
                        <option key={area.id} value={area.id}>
                          {area.name}
                        </option>
                      ))}
                    </select>
                    {!selectedMainAreaId && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <span>⚠️</span>
                        <span>يجب اختيار المنطقة الرئيسية</span>
                      </p>
                    )}
                  </div>

                  {selectedMainAreaId && subAreas.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        المنطقة الفرعية <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowSubAreaPicker(!showSubAreaPicker)}
                          className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand bg-white hover:bg-gray-50 transition-colors flex items-center justify-between ${
                            !selectedCity ? 'border-red-300 text-gray-400' : 'border-gray-300 text-gray-900'
                          }`}
                        >
                          <span className={selectedCity ? 'text-gray-900 font-medium' : 'text-gray-400'}>
                            {selectedCity || 'اختر المنطقة الفرعية'}
                          </span>
                          <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${showSubAreaPicker ? 'rotate-90' : ''}`} />
                        </button>

                        {/* Sub Area Dropdown */}
                        <AnimatePresence>
                          {showSubAreaPicker && (
                            <>
                              {/* Backdrop */}
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => {
                                  setShowSubAreaPicker(false);
                                  setSubAreaSearchQuery('');
                                }}
                              />

                              {/* Dropdown Menu */}
                              <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-xl z-50 max-h-[400px] flex flex-col"
                              >
                                {/* Search Input */}
                                <div className="p-3 border-b border-gray-200">
                                  <div className="relative">
                                    <input
                                      type="text"
                                      value={subAreaSearchQuery}
                                      onChange={(e) => setSubAreaSearchQuery(e.target.value)}
                                      placeholder="ابحث عن منطقة فرعية..."
                                      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                  </div>
                                </div>

                                {/* Sub Areas List */}
                                <div className="flex-1 overflow-y-auto p-2">
                                  <div className="space-y-1">
                                    {subAreas
                                      .filter(area => area.name.toLowerCase().includes(subAreaSearchQuery.toLowerCase()))
                                      .map((area) => (
                                        <button
                                          key={area.id}
                                          type="button"
                                          onClick={() => {
                                            handleSubAreaChange(area.name);
                                            setShowSubAreaPicker(false);
                                            setSubAreaSearchQuery('');
                                          }}
                                          className={`w-full p-3 rounded-lg transition-all text-right ${
                                            selectedCity === area.name
                                              ? 'bg-brand/10 text-brand font-medium'
                                              : 'hover:bg-gray-50 text-gray-900'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <span className="font-medium">{area.name}</span>
                                            {selectedCity === area.name && (
                                              <Check className="w-5 h-5 text-brand" />
                                            )}
                                          </div>
                                        </button>
                                      ))}

                                    {/* No Results Message */}
                                    {subAreaSearchQuery && subAreas
                                      .filter(area => area.name.toLowerCase().includes(subAreaSearchQuery.toLowerCase())).length === 0 && (
                                      <div className="text-center py-6">
                                        <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                        <p className="text-gray-500 text-sm">لا توجد مناطق تطابق البحث</p>
                                        <button
                                          type="button"
                                          onClick={() => setSubAreaSearchQuery('')}
                                          className="mt-2 text-brand hover:text-brand-light text-sm font-medium"
                                        >
                                          مسح البحث
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                      {!selectedCity && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <span>⚠️</span>
                          <span>يجب اختيار المنطقة الفرعية</span>
                        </p>
                      )}
                    </div>
                  )}

                  {selectedCity && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-sm text-green-800 font-medium flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        <span>المنطقة المختارة: {selectedCity}</span>
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      العنوان التفصيلي <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <textarea
                        value={detailedAddress}
                        onChange={(e) => setDetailedAddress(e.target.value)}
                        placeholder="أدخل العنوان التفصيلي (الشارع، رقم البناية، الحي...)"
                        className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand min-h-[100px] resize-none"
                        required
                      />
                      <MapPin className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">أدخل تفاصيل العنوان بدقة لتسهيل التوصيل</p>
                  </div>
                </div>
              </div>

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