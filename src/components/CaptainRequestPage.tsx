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

  const [pickupArea, setPickupArea] = useState('');
  const [pickupMapLocation, setPickupMapLocation] = useState('');
  const [pickupManualText, setPickupManualText] = useState('');
  const [pickupCoordinates, setPickupCoordinates] = useState<{lat: number; lng: number} | undefined>(undefined);

  const [destinationArea, setDestinationArea] = useState('');
  const [destinationMapLocation, setDestinationMapLocation] = useState('');
  const [destinationManualText, setDestinationManualText] = useState('');
  const [destinationCoordinates, setDestinationCoordinates] = useState<{lat: number; lng: number} | undefined>(undefined);

  const [showPickupAreaPicker, setShowPickupAreaPicker] = useState(false);
  const [showPickupMap, setShowPickupMap] = useState(false);
  const [showDestinationMap, setShowDestinationMap] = useState(false);
  const [showDestinationAreaPicker, setShowDestinationAreaPicker] = useState(false);

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
    if (destinationArea) parts.push(destinationArea);
    if (destinationMapLocation) parts.push(destinationMapLocation);
    if (destinationManualText) parts.push(destinationManualText);

    if (parts.length > 0) {
      setDestinationAddress({
        address: parts.join(' - '),
        city: destinationArea || 'محدد',
        coordinates: destinationCoordinates
      });
    } else {
      setDestinationAddress(null);
    }
  }, [destinationArea, destinationMapLocation, destinationManualText, destinationCoordinates]);

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
      const customerId = user.customer_id || user.id;

      console.log('📝 Creating captain request with customer_id:', customerId, 'Full user:', user);

      const { data, error: insertError } = await supabase
        .from('captain_requests')
        .insert({
          customer_id: customerId,
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

      console.log('✅ Captain request created:', { data, insertError });

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
        className="fixed inset-0 bg-black/10 z-[9998] backdrop-blur-lg"
        onClick={onClose}
      />

      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed inset-0 z-40 bg-white"
        style={{
          paddingTop: 'max(env(safe-area-inset-top), 0px)',
          paddingBottom: 'calc(68px + max(env(safe-area-inset-bottom), 8px))'
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
          <div className="flex-1 overflow-y-auto p-4" style={{
            paddingBottom: 'max(env(safe-area-inset-bottom), 24px)'
          }}>
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

                <div className="space-y-3">
                  {/* Service Area */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">منطقة الخدمة</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={pickupArea}
                        readOnly
                        placeholder="اختر منطقة"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPickupAreaPicker(true)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                      >
                        اختر
                      </button>
                      {pickupArea && (
                        <button
                          type="button"
                          onClick={() => setPickupArea('')}
                          className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Map Location */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">الموقع على الخريطة</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={pickupMapLocation}
                        readOnly
                        placeholder="حدد على الخريطة"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPickupMap(true)}
                        className="px-4 py-2 border-2 border-green-600 text-green-600 rounded-lg hover:bg-green-50 transition-colors text-sm font-medium"
                      >
                        خريطة
                      </button>
                      {pickupMapLocation && (
                        <button
                          type="button"
                          onClick={() => { setPickupMapLocation(''); setPickupCoordinates(undefined); }}
                          className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Manual Address */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">تفاصيل إضافية</label>
                    <textarea
                      value={pickupManualText}
                      onChange={(e) => setPickupManualText(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                      placeholder="مثال: بجانب مسجد النور، عمارة 5"
                    />
                  </div>

                  {pickupAddress && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-xs text-gray-600 mb-1">العنوان الكامل:</p>
                      <p className="text-sm font-medium text-green-900">{pickupAddress.address}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Destination Location */}
              <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
                <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-brand" />
                  الوجهة
                </h3>

                <div className="space-y-3">
                  {/* Service Area */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">منطقة الخدمة</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={destinationArea}
                        readOnly
                        placeholder="اختر منطقة"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowDestinationAreaPicker(true)}
                        className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                      >
                        اختر
                      </button>
                      {destinationArea && (
                        <button
                          type="button"
                          onClick={() => setDestinationArea('')}
                          className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Map Location */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">الموقع على الخريطة</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={destinationMapLocation}
                        readOnly
                        placeholder="حدد على الخريطة"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowDestinationMap(true)}
                        className="px-4 py-2 border-2 border-brand text-brand rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                      >
                        خريطة
                      </button>
                      {destinationMapLocation && (
                        <button
                          type="button"
                          onClick={() => { setDestinationMapLocation(''); setDestinationCoordinates(undefined); }}
                          className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Manual Address */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">تفاصيل إضافية</label>
                    <textarea
                      value={destinationManualText}
                      onChange={(e) => setDestinationManualText(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent resize-none"
                      placeholder="مثال: بجانب مسجد النور، عمارة 5"
                    />
                  </div>

                  {destinationAddress && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-xs text-gray-600 mb-1">العنوان الكامل:</p>
                      <p className="text-sm font-medium text-red-900">{destinationAddress.address}</p>
                    </div>
                  )}
                </div>
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
              setPickupArea(area.name);
              if (area.center) {
                setPickupCoordinates(area.center);
              }
              setShowPickupAreaPicker(false);
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
              setPickupMapLocation(address.address);
              if (address.coordinates) {
                setPickupCoordinates(address.coordinates);
              }
              setShowPickupMap(false);
            }}
            onClose={() => setShowPickupMap(false)}
            title="حدد موقع الانطلاق"
          />
        )}
      </AnimatePresence>

      {/* Destination Map Selector */}
      <AnimatePresence>
        {showDestinationMap && (
          <MapAddressSelector
            onAddressSelected={(address) => {
              setDestinationMapLocation(address.address);
              if (address.coordinates) {
                setDestinationCoordinates(address.coordinates);
              }
              setShowDestinationMap(false);
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
              setDestinationArea(area.name);
              if (area.center) {
                setDestinationCoordinates(area.center);
              }
              setShowDestinationAreaPicker(false);
            }}
            onClose={() => setShowDestinationAreaPicker(false)}
            title="اختر منطقة الوجهة"
            required={true}
          />
        )}
      </AnimatePresence>

    </>
  );
};

export default CaptainRequestPage;
