import React, { useState, useEffect } from 'react';
import { X, MapPin, Navigation, User, Phone, Package, Loader2, Clock, Banknote, Wallet } from 'lucide-react';
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
  const [parcelType, setParcelType] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'wallet'>('cash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    const baseFare = 5;
    const perKmRate = 3;
    const estimatedFare = baseFare + (distance * perKmRate);

    return {
      fare: Math.round(estimatedFare * 10) / 10,
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
          parcel_type: parcelType || null,
          description: description || null,
          notes: notes || null,
          payment_method: paymentMethod,
          delivery_fee: estimate?.fare || 0,
          distance: estimate?.distance || null,
          status: 'pending'
        })
        .select()
        .single();

      console.log('✅ Parcel order created:', { data, insertError });

      if (insertError) throw insertError;

      alert('تم إرسال طلب الطرد بنجاح! سيتم التواصل معك قريباً');
      onClose();
    } catch (err: any) {
      console.error('Error creating parcel order:', err);
      setError(err.message || 'حدث خطأ أثناء إرسال الطلب');
    } finally {
      setLoading(false);
    }
  };

  const estimatedInfo = calculateEstimatedFee();

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
          <div className="bg-gradient-to-r from-brand to-red-600 text-white px-4 py-4 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <Package className="w-6 h-6" />
              <h2 className="text-xl font-bold">توصيل طرد</h2>
            </div>
            <div className="flex items-center gap-2">
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

          <div className="flex-1 overflow-y-auto p-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-brand" />
                  معلومات المرسل
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      الاسم الكامل
                    </label>
                    <input
                      type="text"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
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
                      value={senderPhone}
                      onChange={(e) => setSenderPhone(e.target.value)}
                      required
                      readOnly
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent bg-gray-50"
                      placeholder="05xxxxxxxx"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
                <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-green-600" />
                  عنوان الاستلام
                </h3>

                <div className="space-y-3">
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

              <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-600" />
                  معلومات المستلم
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      الاسم الكامل
                    </label>
                    <input
                      type="text"
                      value={receiverName}
                      onChange={(e) => setReceiverName(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="اسم المستلم"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Phone className="w-4 h-4 inline ml-1" />
                      رقم الهاتف
                    </label>
                    <input
                      type="tel"
                      value={receiverPhone}
                      onChange={(e) => setReceiverPhone(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="05xxxxxxxx"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
                <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-brand" />
                  عنوان التسليم
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">منطقة الخدمة</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={deliveryArea}
                        readOnly
                        placeholder="اختر منطقة"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowDeliveryAreaPicker(true)}
                        className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                      >
                        اختر
                      </button>
                      {deliveryArea && (
                        <button
                          type="button"
                          onClick={() => setDeliveryArea('')}
                          className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">الموقع على الخريطة</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={deliveryMapLocation}
                        readOnly
                        placeholder="حدد على الخريطة"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowDeliveryMap(true)}
                        className="px-4 py-2 border-2 border-brand text-brand rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                      >
                        خريطة
                      </button>
                      {deliveryMapLocation && (
                        <button
                          type="button"
                          onClick={() => { setDeliveryMapLocation(''); setDeliveryCoordinates(undefined); }}
                          className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">تفاصيل إضافية</label>
                    <textarea
                      value={deliveryManualText}
                      onChange={(e) => setDeliveryManualText(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent resize-none"
                      placeholder="مثال: بجانب مسجد النور، عمارة 5"
                    />
                  </div>

                  {deliveryAddress && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-xs text-gray-600 mb-1">العنوان الكامل:</p>
                      <p className="text-sm font-medium text-red-900">{deliveryAddress.address}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
                <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                  <Package className="w-5 h-5 text-purple-600" />
                  معلومات الطرد
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      نوع الطرد (اختياري)
                    </label>
                    <input
                      type="text"
                      value={parcelType}
                      onChange={(e) => setParcelType(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="مثال: مستندات، طعام، ملابس"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      وصف الطرد (اختياري)
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                      placeholder="وصف محتويات الطرد"
                    />
                  </div>
                </div>
              </div>

              {estimatedInfo && (
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl shadow-md p-4 border border-yellow-200">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-700">المسافة التقديرية:</span>
                      <span className="text-lg font-bold text-gray-800">{estimatedInfo.distance} كم</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-700">التكلفة التقديرية:</span>
                      <span className="text-2xl font-bold text-brand">{estimatedInfo.fare} ₪</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">* السعر النهائي قد يختلف حسب المسافة الفعلية</p>
                </div>
              )}

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

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !pickupAddress || !deliveryAddress || !receiverName || !receiverPhone}
                className="w-full bg-gradient-to-r from-brand to-red-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    جاري الإرسال...
                  </>
                ) : (
                  <>
                    <Package className="w-5 h-5" />
                    إرسال الطلب
                  </>
                )}
              </button>
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

    </>
  );
};

export default ParcelOrderPage;
