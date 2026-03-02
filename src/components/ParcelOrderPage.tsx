import React, { useState, useEffect } from 'react';
import { X, MapPin, User, Phone, Loader2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import MapAddressSelector from './MapAddressSelector';
import ServiceAreaPicker from './ServiceAreaPicker';
import { ServiceArea } from '../lib/zones';

interface ParcelOrderPageProps {
  onClose: () => void;
}

interface Address {
  address: string;
  city: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

const ParcelOrderPage: React.FC<ParcelOrderPageProps> = ({ onClose }) => {
  const { user, isAuthenticated } = useAuth();
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [pickupAddress, setPickupAddress] = useState<Address | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState<Address | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successOrderNumber, setSuccessOrderNumber] = useState<string | null>(null);

  const [pickupArea, setPickupArea] = useState('');
  const [pickupMapLocation, setPickupMapLocation] = useState('');
  const [pickupManualText, setPickupManualText] = useState('');
  const [pickupCoordinates, setPickupCoordinates] = useState<{lat: number; lng: number} | undefined>(undefined);

  const [deliveryArea, setDeliveryArea] = useState('');
  const [deliveryMapLocation, setDeliveryMapLocation] = useState('');
  const [deliveryManualText, setDeliveryManualText] = useState('');
  const [deliveryCoordinates, setDeliveryCoordinates] = useState<{lat: number; lng: number} | undefined>(undefined);

  const [showPickupAreaPicker, setShowPickupAreaPicker] = useState(false);
  const [showPickupMap, setShowPickupMap] = useState(false);
  const [showDeliveryMap, setShowDeliveryMap] = useState(false);
  const [showDeliveryAreaPicker, setShowDeliveryAreaPicker] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';

    const fetchUserData = async () => {
      if (!user) return;

      const customerId = user.customer_id || user.id;
      const { data, error } = await supabase
        .from('customers')
        .select('name, phone')
        .eq('id', customerId)
        .maybeSingle();

      if (data && !error) {
        setSenderName(data.name || '');
        setSenderPhone(data.phone || '');
      }
    };

    fetchUserData();

    return () => {
      document.body.style.overflow = '';
    };
  }, [user]);

  useEffect(() => {
    const parts = [];
    if (pickupArea) parts.push(pickupArea);
    if (pickupMapLocation) parts.push(pickupMapLocation);
    if (pickupManualText) parts.push(pickupManualText);

    if (parts.length > 0) {
      setPickupAddress({
        address: parts.join(' - '),
        city: pickupArea || 'محدد',
        coordinates: pickupCoordinates
      });
    } else {
      setPickupAddress(null);
    }
  }, [pickupArea, pickupMapLocation, pickupManualText, pickupCoordinates]);

  useEffect(() => {
    const parts = [];
    if (deliveryArea) parts.push(deliveryArea);
    if (deliveryMapLocation) parts.push(deliveryMapLocation);
    if (deliveryManualText) parts.push(deliveryManualText);

    if (parts.length > 0) {
      setDeliveryAddress({
        address: parts.join(' - '),
        city: deliveryArea || 'محدد',
        coordinates: deliveryCoordinates
      });
    } else {
      setDeliveryAddress(null);
    }
  }, [deliveryArea, deliveryMapLocation, deliveryManualText, deliveryCoordinates]);

  const calculateEstimatedFee = () => {
    if (!pickupAddress?.coordinates || !deliveryAddress?.coordinates) {
      return null;
    }

    const R = 6371;
    const dLat = (deliveryAddress.coordinates.lat - pickupAddress.coordinates.lat) * Math.PI / 180;
    const dLon = (deliveryAddress.coordinates.lng - pickupAddress.coordinates.lng) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(pickupAddress.coordinates.lat * Math.PI / 180) *
      Math.cos(deliveryAddress.coordinates.lat * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    const fixedFare = 20;

    return {
      fare: fixedFare,
      distance: Math.round(distance * 10) / 10
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError('يجب تسجيل الدخول أولاً');
      return;
    }

    if (!pickupAddress || !deliveryAddress) {
      setError('يرجى تحديد عنوان الاستلام والتسليم');
      return;
    }

    if (!receiverName || !receiverPhone) {
      setError('يرجى إدخال معلومات المستلم');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const estimate = calculateEstimatedFee();
      const customerId = user.customer_id || user.id;

      console.log('📦 Creating parcel order with customer_id:', customerId);

      const { data, error: insertError } = await supabase
        .from('parcel_orders')
        .insert({
          customer_id: customerId,
          sender_name: senderName,
          sender_phone: user.phone || senderPhone,
          sender_address: pickupAddress.address,
          sender_city: pickupAddress.city,
          sender_latitude: pickupAddress.coordinates?.lat,
          sender_longitude: pickupAddress.coordinates?.lng,
          receiver_name: receiverName,
          receiver_phone: receiverPhone,
          receiver_address: deliveryAddress.address,
          receiver_city: deliveryAddress.city,
          receiver_latitude: deliveryAddress.coordinates?.lat,
          receiver_longitude: deliveryAddress.coordinates?.lng,
          notes: notes || null,
          payment_method: 'cash',
          delivery_fee: estimate?.fare || 0,
          distance: estimate?.distance || null,
          status: 'pending'
        })
        .select()
        .single();

      console.log('✅ Parcel order created:', { data, insertError });

      if (insertError) throw insertError;

      setSuccessOrderNumber(data.order_number);
    } catch (err: any) {
      console.error('Error creating parcel order:', err);
      setError(err.message || 'حدث خطأ أثناء إرسال الطلب');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/10 z-[9998] backdrop-blur-lg"
        onClick={onClose}
      />

      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed inset-0 z-40 bg-gray-50"
        style={{
          paddingTop: 'max(env(safe-area-inset-top), 0px)',
          paddingBottom: 'calc(62px + env(safe-area-inset-bottom))'
        }}
      >
        <div className="h-full flex flex-col">
          <div className="bg-gradient-to-r from-brand to-red-700 text-white px-4 py-4 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 6h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM10 4h4v2h-4V4zm10 16H4V8h16v12z"/>
              </svg>
              <h2 className="text-xl font-bold">توصيل طرد</h2>
            </div>
            <div className="flex items-center gap-1">
              {isAuthenticated && (
                <button
                  onClick={() => {
                    onClose();
                    window.dispatchEvent(new CustomEvent('open-parcel-tracking'));
                  }}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  title="تتبع طلباتي"
                >
                  <Clock className="w-6 h-6" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto" style={{
            paddingBottom: 'max(env(safe-area-inset-bottom), 24px)'
          }}>
            <form onSubmit={handleSubmit} className="max-w-md mx-auto p-4 space-y-4">
              <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-base text-gray-800">معلومات المرسل</h3>
                  <User className="w-5 h-5 text-brand" />
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-2 text-right">الاسم الكامل</label>
                    <input
                      type="text"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      required
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent text-right text-sm"
                      placeholder="أدخل اسمك"
                      dir="rtl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-2 text-right flex items-center justify-end gap-1">
                      <span>رقم الهاتف</span>
                      <Phone className="w-3.5 h-3.5" />
                    </label>
                    <input
                      type="tel"
                      value={senderPhone}
                      readOnly
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-right text-sm"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-base text-gray-800">عنوان الاستلام</h3>
                  <MapPin className="w-5 h-5 text-green-600" />
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-2 text-right">منطقة الخدمة</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowPickupAreaPicker(true)}
                        className="px-5 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors text-sm font-medium whitespace-nowrap"
                      >
                        اختر
                      </button>
                      <input
                        type="text"
                        value={pickupArea}
                        readOnly
                        placeholder="اختر منطقة"
                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-right text-sm"
                        dir="rtl"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-2 text-right">الموقع على الخريطة</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowPickupMap(true)}
                        className="px-5 py-2.5 border-2 border-green-600 text-green-600 rounded-xl hover:bg-green-50 transition-colors text-sm font-medium whitespace-nowrap"
                      >
                        خريطة
                      </button>
                      <input
                        type="text"
                        value={pickupMapLocation}
                        readOnly
                        placeholder="حدد على الخريطة"
                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-right text-sm"
                        dir="rtl"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-2 text-right">تفاصيل إضافية</label>
                    <textarea
                      value={pickupManualText}
                      onChange={(e) => setPickupManualText(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none text-right text-sm"
                      placeholder="مثال: بجانب مسجد النور، عمارة 5"
                      dir="rtl"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-base text-gray-800">معلومات المستلم</h3>
                  <User className="w-5 h-5 text-blue-600" />
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-2 text-right">الاسم الكامل</label>
                    <input
                      type="text"
                      value={receiverName}
                      onChange={(e) => setReceiverName(e.target.value)}
                      required
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right text-sm"
                      placeholder="إسم المستلم"
                      dir="rtl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-2 text-right flex items-center justify-end gap-1">
                      <span>رقم الهاتف</span>
                      <Phone className="w-3.5 h-3.5" />
                    </label>
                    <input
                      type="tel"
                      value={receiverPhone}
                      onChange={(e) => setReceiverPhone(e.target.value)}
                      required
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right text-sm"
                      placeholder="05xxxxxxxx"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-base text-gray-800">عنوان التسليم</h3>
                  <MapPin className="w-5 h-5 text-brand" />
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-2 text-right">منطقة الخدمة</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowDeliveryAreaPicker(true)}
                        className="px-5 py-2.5 bg-brand text-white rounded-xl hover:bg-red-700 transition-colors text-sm font-medium whitespace-nowrap"
                      >
                        اختر
                      </button>
                      <input
                        type="text"
                        value={deliveryArea}
                        readOnly
                        placeholder="اختر منطقة"
                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-right text-sm"
                        dir="rtl"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-2 text-right">الموقع على الخريطة</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowDeliveryMap(true)}
                        className="px-5 py-2.5 border-2 border-brand text-brand rounded-xl hover:bg-red-50 transition-colors text-sm font-medium whitespace-nowrap"
                      >
                        خريطة
                      </button>
                      <input
                        type="text"
                        value={deliveryMapLocation}
                        readOnly
                        placeholder="حدد على الخريطة"
                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-right text-sm"
                        dir="rtl"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-2 text-right">تفاصيل إضافية</label>
                    <textarea
                      value={deliveryManualText}
                      onChange={(e) => setDeliveryManualText(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent resize-none text-right text-sm"
                      placeholder="مثال: بجانب مسجد النور، عمارة 5"
                      dir="rtl"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm text-right">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !pickupAddress || !deliveryAddress || !receiverName || !receiverPhone}
                className="w-full bg-gradient-to-r from-brand to-red-700 text-white py-4 rounded-xl font-bold text-base shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>جاري الإرسال...</span>
                  </>
                ) : (
                  <span>إرسال الطلب</span>
                )}
              </button>

              <div className="h-8"></div>
            </form>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showPickupAreaPicker && (
          <ServiceAreaPicker
            onAreaSelected={(area: ServiceArea) => {
              setPickupArea(area.name);
              if (area.center) {
                setPickupCoordinates(area.center);
              }
              setShowPickupAreaPicker(false);
            }}
            onClose={() => setShowPickupAreaPicker(false)}
            title="اختر منطقة الاستلام"
            required={true}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPickupMap && (
          <MapAddressSelector
            onAddressSelected={(address) => {
              setPickupMapLocation(address.address);
              if (address.coordinates) {
                setPickupCoordinates(address.coordinates);
              }
              setShowPickupMap(false);
            }}
            onClose={() => setShowPickupMap(false)}
            title="حدد موقع الاستلام"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeliveryMap && (
          <MapAddressSelector
            onAddressSelected={(address) => {
              setDeliveryMapLocation(address.address);
              if (address.coordinates) {
                setDeliveryCoordinates(address.coordinates);
              }
              setShowDeliveryMap(false);
            }}
            onClose={() => setShowDeliveryMap(false)}
            title="حدد موقع التسليم"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeliveryAreaPicker && (
          <ServiceAreaPicker
            onAreaSelected={(area) => {
              setDeliveryArea(area.name);
              if (area.center) {
                setDeliveryCoordinates(area.center);
              }
              setShowDeliveryAreaPicker(false);
            }}
            onClose={() => setShowDeliveryAreaPicker(false)}
            title="اختر منطقة التسليم"
            required={true}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {successOrderNumber && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 z-[10000] backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[10001] bg-white rounded-3xl shadow-2xl overflow-hidden max-w-md mx-auto"
            >
              <div className="bg-gradient-to-br from-green-500 to-green-600 p-8 text-center text-white">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                  className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4"
                >
                  <svg className="w-12 h-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
                <h3 className="text-2xl font-bold mb-2">تم إرسال الطلب بنجاح!</h3>
                <p className="text-green-50 text-sm">سيتم التواصل معك قريباً</p>
              </div>

              <div className="p-6 text-center">
                <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 mb-6">
                  <p className="text-sm text-gray-600 mb-2">رقم الطلب</p>
                  <p className="text-3xl font-bold text-brand" dir="ltr">#{successOrderNumber}</p>
                </div>

                <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                  يمكنك متابعة حالة طلبك من خلال صفحة طلباتي
                </p>

                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setSuccessOrderNumber(null);
                      onClose();
                      setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('open-parcel-tracking'));
                      }, 200);
                    }}
                    className="w-full bg-gradient-to-r from-brand to-red-700 text-white py-4 rounded-xl font-bold text-base shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                  >
                    <Clock className="w-5 h-5" />
                    <span>عرض طلباتي</span>
                  </button>

                  <button
                    onClick={() => {
                      setSuccessOrderNumber(null);
                      onClose();
                    }}
                    className="w-full border-2 border-gray-300 text-gray-700 py-4 rounded-xl font-bold text-base hover:bg-gray-50 transition-all"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </>
  );
};

export default ParcelOrderPage;
