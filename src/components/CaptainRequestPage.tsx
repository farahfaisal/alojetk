import React, { useState, useEffect } from 'react';
import { X, MapPin, Navigation, User, Phone, Wallet, Banknote, Loader2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import MapAddressSelector from './MapAddressSelector';
import ServiceAreaPicker from './ServiceAreaPicker';
import { ServiceArea } from '../lib/zones';

interface CaptainRequestPageProps {
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

const CaptainRequestPage: React.FC<CaptainRequestPageProps> = ({ onClose }) => {
  const { user, isAuthenticated } = useAuth();
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [pickupAddress, setPickupAddress] = useState<Address | null>(null);
  const [destinationAddress, setDestinationAddress] = useState<Address | null>(null);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'wallet'>('cash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPickupAreaPicker, setShowPickupAreaPicker] = useState(false);
  const [showPickupMap, setShowPickupMap] = useState(false);
  const [showPickupOptions, setShowPickupOptions] = useState(false);
  const [showPickupManual, setShowPickupManual] = useState(false);
  const [showDestinationMap, setShowDestinationMap] = useState(false);
  const [showDestinationAreaPicker, setShowDestinationAreaPicker] = useState(false);
  const [showDestinationOptions, setShowDestinationOptions] = useState(false);
  const [showDestinationManual, setShowDestinationManual] = useState(false);
  const [manualAddress, setManualAddress] = useState('');

  useEffect(() => {
    document.body.style.overflow = 'hidden';

    const fetchUserData = async () => {
      if (!user) return;

      const customerId = user.customer_id || user.id;
      const { data, error } = await supabase
        .from('customers')
        .select('name, phone, address, city')
        .eq('id', customerId)
        .maybeSingle();

      if (data && !error) {
        setCustomerName(data.name || '');
        setCustomerPhone(data.phone || '');
      }
    };

    fetchUserData();

    return () => {
      document.body.style.overflow = '';
    };
  }, [user]);

  const calculateEstimatedFare = () => {
    if (!pickupAddress?.coordinates || !destinationAddress?.coordinates) {
      return null;
    }

    const R = 6371;
    const dLat = (destinationAddress.coordinates.lat - pickupAddress.coordinates.lat) * Math.PI / 180;
    const dLon = (destinationAddress.coordinates.lng - pickupAddress.coordinates.lng) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(pickupAddress.coordinates.lat * Math.PI / 180) *
      Math.cos(destinationAddress.coordinates.lat * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    const baseFare = 5;
    const perKmRate = 3;
    const estimatedFare = baseFare + (distance * perKmRate);

    return Math.round(estimatedFare * 10) / 10;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError('يجب تسجيل الدخول أولاً');
      return;
    }

    if (!pickupAddress || !destinationAddress) {
      setError('يرجى تحديد موقع الانطلاق والوجهة');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const estimatedFare = calculateEstimatedFare();

      const { data, error: insertError } = await supabase
        .from('captain_requests')
        .insert({
          customer_id: user.id,
          customer_name: customerName,
          customer_phone: user.phone || customerPhone,
          pickup_address: pickupAddress.address,
          pickup_latitude: pickupAddress.coordinates?.lat,
          pickup_longitude: pickupAddress.coordinates?.lng,
          destination_address: destinationAddress.address,
          destination_latitude: destinationAddress.coordinates?.lat,
          destination_longitude: destinationAddress.coordinates?.lng,
          notes: notes || null,
          payment_method: paymentMethod,
          estimated_fare: estimatedFare,
          status: 'pending'
        })
        .select()
        .single();

      if (insertError) throw insertError;

      alert('تم إرسال طلبك بنجاح! سيتم التواصل معك قريباً');
      onClose();
    } catch (err: any) {
      console.error('Error creating captain request:', err);
      setError(err.message || 'حدث خطأ أثناء إرسال الطلب');
    } finally {
      setLoading(false);
    }
  };

  const estimatedFare = calculateEstimatedFare();

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-[9998] backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed inset-0 z-[9999] bg-white overflow-hidden"
        style={{
          paddingTop: 'max(env(safe-area-inset-top), 0px)',
          paddingBottom: 'max(env(safe-area-inset-bottom), 0px)'
        }}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-brand to-red-600 text-white px-4 py-4 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <Navigation className="w-6 h-6" />
              <h2 className="text-xl font-bold">توصيل طرود</h2>
            </div>
            <div className="flex items-center gap-2">
              {/* Tracking Button - Only for authenticated users */}
              {isAuthenticated && (
                <button
                  onClick={() => {
                    onClose();
                    window.dispatchEvent(new CustomEvent('open-captain-tracking'));
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

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Customer Info */}
              <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-brand" />
                  معلومات العميل
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      الاسم الكامل
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent"
                      placeholder="أدخل اسمك"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Phone className="w-4 h-4 inline ml-1" />
                      رقم الهاتف
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      required
                      readOnly
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent bg-gray-50"
                      placeholder="05xxxxxxxx"
                    />
                    <p className="text-xs text-gray-500 mt-1">لا يمكن تغيير رقم الهاتف</p>
                  </div>
                </div>
              </div>

              {/* Pickup Location */}
              <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
                <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-green-600" />
                  موقع الانطلاق
                </h3>

                {pickupAddress ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-green-900">{pickupAddress.address}</p>
                    <button
                      type="button"
                      onClick={() => setShowPickupOptions(true)}
                      className="text-sm text-green-600 hover:text-green-700 mt-2"
                    >
                      تغيير الموقع
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setShowPickupAreaPicker(true)}
                      className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                    >
                      اختيار من مناطق الخدمة
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPickupMap(true)}
                      className="w-full py-3 border-2 border-green-600 text-green-600 rounded-lg hover:bg-green-50 transition-colors font-medium"
                    >
                      تحديد على الخريطة
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPickupManual(true)}
                      className="w-full py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    >
                      كتابة العنوان يدوياً
                    </button>
                  </div>
                )}
              </div>

              {/* Destination Location */}
              <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
                <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-brand" />
                  الوجهة
                </h3>

                {destinationAddress ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-red-900">{destinationAddress.address}</p>
                    <button
                      type="button"
                      onClick={() => setShowDestinationOptions(true)}
                      className="text-sm text-red-600 hover:text-red-700 mt-2"
                    >
                      تغيير الموقع
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setShowDestinationAreaPicker(true)}
                      className="w-full py-3 bg-brand text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                    >
                      اختيار من مناطق الخدمة
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDestinationMap(true)}
                      className="w-full py-3 border-2 border-brand text-brand rounded-lg hover:bg-red-50 transition-colors font-medium"
                    >
                      تحديد على الخريطة
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDestinationManual(true)}
                      className="w-full py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    >
                      كتابة العنوان يدوياً
                    </button>
                  </div>
                )}
              </div>

              {/* Estimated Fare */}
              {estimatedFare && (
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl shadow-md p-4 border border-yellow-200">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-700">التكلفة التقديرية:</span>
                    <span className="text-2xl font-bold text-brand">{estimatedFare} ₪</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">* السعر النهائي قد يختلف حسب المسافة الفعلية</p>
                </div>
              )}

              {/* Notes */}
              <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ملاحظات (اختياري)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent resize-none"
                  placeholder="أي تفاصيل إضافية..."
                />
              </div>

              {/* Payment Method */}
              <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
                <h3 className="font-bold text-lg mb-3">طريقة الدفع</h3>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      paymentMethod === 'cash'
                        ? 'border-brand bg-red-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Banknote className={`w-6 h-6 mx-auto mb-2 ${
                      paymentMethod === 'cash' ? 'text-brand' : 'text-gray-400'
                    }`} />
                    <span className={`text-sm font-medium ${
                      paymentMethod === 'cash' ? 'text-brand' : 'text-gray-600'
                    }`}>
                      كاش
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('wallet')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      paymentMethod === 'wallet'
                        ? 'border-brand bg-red-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Wallet className={`w-6 h-6 mx-auto mb-2 ${
                      paymentMethod === 'wallet' ? 'text-brand' : 'text-gray-400'
                    }`} />
                    <span className={`text-sm font-medium ${
                      paymentMethod === 'wallet' ? 'text-brand' : 'text-gray-600'
                    }`}>
                      محفظة
                    </span>
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !pickupAddress || !destinationAddress}
                className="w-full bg-gradient-to-r from-brand to-red-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    جاري الإرسال...
                  </>
                ) : (
                  <>
                    <Navigation className="w-5 h-5" />
                    إرسال الطلب
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </motion.div>

      {/* Pickup Area Picker */}
      <AnimatePresence>
        {showPickupAreaPicker && (
          <ServiceAreaPicker
            onAreaSelected={(area: ServiceArea) => {
              setPickupAddress({
                address: area.name,
                city: area.city || area.name,
                coordinates: area.center
              });
              setShowPickupAreaPicker(false);
              setShowPickupOptions(false);
            }}
            onClose={() => setShowPickupAreaPicker(false)}
            title="اختر منطقة الانطلاق"
            required={true}
          />
        )}
      </AnimatePresence>

      {/* Pickup Map Selector */}
      <AnimatePresence>
        {showPickupMap && (
          <MapAddressSelector
            onAddressSelected={(address) => {
              setPickupAddress(address);
              setShowPickupMap(false);
              setShowPickupOptions(false);
            }}
            onClose={() => setShowPickupMap(false)}
            title="حدد موقع الانطلاق"
          />
        )}
      </AnimatePresence>

      {/* Pickup Options Modal */}
      <AnimatePresence>
        {showPickupOptions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center p-4"
            onClick={() => setShowPickupOptions(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-4 text-center">اختر طريقة تحديد موقع الانطلاق</h3>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowPickupOptions(false);
                    setShowPickupAreaPicker(true);
                  }}
                  className="w-full py-4 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium shadow-lg"
                >
                  اختيار من مناطق الخدمة
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowPickupOptions(false);
                    setShowPickupMap(true);
                  }}
                  className="w-full py-4 border-2 border-green-600 text-green-600 rounded-xl hover:bg-green-50 transition-colors font-medium"
                >
                  تحديد على الخريطة
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowPickupOptions(false);
                    setShowPickupManual(true);
                  }}
                  className="w-full py-4 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                >
                  كتابة العنوان يدوياً
                </button>

                <button
                  type="button"
                  onClick={() => setShowPickupOptions(false)}
                  className="w-full py-3 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pickup Manual Address Input */}
      <AnimatePresence>
        {showPickupManual && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center p-4"
            onClick={() => setShowPickupManual(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-4 text-center">أدخل عنوان الانطلاق</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    العنوان الكامل
                  </label>
                  <textarea
                    value={manualAddress}
                    onChange={(e) => setManualAddress(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                    placeholder="مثال: شارع الملك فهد، حي النزهة، جدة"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (manualAddress.trim()) {
                      setPickupAddress({
                        address: manualAddress.trim(),
                        city: 'يدوي',
                        coordinates: undefined
                      });
                      setManualAddress('');
                      setShowPickupManual(false);
                      setShowPickupOptions(false);
                    }
                  }}
                  disabled={!manualAddress.trim()}
                  className="w-full py-4 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  تأكيد
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setManualAddress('');
                    setShowPickupManual(false);
                  }}
                  className="w-full py-3 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Destination Map Selector */}
      <AnimatePresence>
        {showDestinationMap && (
          <MapAddressSelector
            onAddressSelected={(address) => {
              setDestinationAddress(address);
              setShowDestinationMap(false);
              setShowDestinationOptions(false);
            }}
            onClose={() => setShowDestinationMap(false)}
            title="حدد الوجهة"
          />
        )}
      </AnimatePresence>

      {/* Destination Area Picker */}
      <AnimatePresence>
        {showDestinationAreaPicker && (
          <ServiceAreaPicker
            onAreaSelected={(area) => {
              setDestinationAddress({
                address: area.name,
                city: area.city,
                coordinates: area.center
              });
              setShowDestinationAreaPicker(false);
              setShowDestinationOptions(false);
            }}
            onClose={() => setShowDestinationAreaPicker(false)}
            title="اختر منطقة الوجهة"
            required={true}
          />
        )}
      </AnimatePresence>

      {/* Destination Options Modal */}
      <AnimatePresence>
        {showDestinationOptions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center p-4"
            onClick={() => setShowDestinationOptions(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-4 text-center">اختر طريقة تحديد الوجهة</h3>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowDestinationOptions(false);
                    setShowDestinationAreaPicker(true);
                  }}
                  className="w-full py-4 bg-brand text-white rounded-xl hover:bg-red-700 transition-colors font-medium shadow-lg"
                >
                  اختيار من مناطق الخدمة
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowDestinationOptions(false);
                    setShowDestinationMap(true);
                  }}
                  className="w-full py-4 border-2 border-brand text-brand rounded-xl hover:bg-red-50 transition-colors font-medium"
                >
                  تحديد على الخريطة
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowDestinationOptions(false);
                    setShowDestinationManual(true);
                  }}
                  className="w-full py-4 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                >
                  كتابة العنوان يدوياً
                </button>

                <button
                  type="button"
                  onClick={() => setShowDestinationOptions(false)}
                  className="w-full py-3 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Destination Manual Address Input */}
      <AnimatePresence>
        {showDestinationManual && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center p-4"
            onClick={() => setShowDestinationManual(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-4 text-center">أدخل عنوان الوجهة</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    العنوان الكامل
                  </label>
                  <textarea
                    value={manualAddress}
                    onChange={(e) => setManualAddress(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent resize-none"
                    placeholder="مثال: شارع الملك فهد، حي النزهة، جدة"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (manualAddress.trim()) {
                      setDestinationAddress({
                        address: manualAddress.trim(),
                        city: 'يدوي',
                        coordinates: undefined
                      });
                      setManualAddress('');
                      setShowDestinationManual(false);
                      setShowDestinationOptions(false);
                    }
                  }}
                  disabled={!manualAddress.trim()}
                  className="w-full py-4 bg-brand text-white rounded-xl hover:bg-red-700 transition-colors font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  تأكيد
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setManualAddress('');
                    setShowDestinationManual(false);
                  }}
                  className="w-full py-3 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default CaptainRequestPage;
