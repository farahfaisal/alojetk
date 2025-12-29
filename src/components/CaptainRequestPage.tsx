import React, { useState, useEffect } from 'react';
import { X, MapPin, Navigation, User, Phone, Wallet, Banknote, Loader2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import ZoneSelector from './ZoneSelector';
import { ServiceArea } from '../lib/zones';

interface CaptainRequestPageProps {
  onClose: () => void;
}

const CaptainRequestPage: React.FC<CaptainRequestPageProps> = ({ onClose }) => {
  const { user, isAuthenticated } = useAuth();
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [pickupZone, setPickupZone] = useState<ServiceArea | null>(null);
  const [destinationZone, setDestinationZone] = useState<ServiceArea | null>(null);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'wallet'>('cash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPickupSelector, setShowPickupSelector] = useState(false);
  const [showDestinationSelector, setShowDestinationSelector] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;

      const customerId = user.customer_id || user.id;
      const { data, error } = await supabase
        .from('customers')
        .select('name, phone')
        .eq('id', customerId)
        .maybeSingle();

      if (data && !error) {
        setCustomerName(data.name || '');
        setCustomerPhone(data.phone || '');
      }
    };

    fetchUserData();
  }, [user]);

  const calculateEstimatedFare = () => {
    if (!pickupZone || !destinationZone) {
      return null;
    }

    // Base fare calculation based on zones
    const baseFare = 10;

    // If same zone, cheaper rate
    if (pickupZone.id === destinationZone.id) {
      return baseFare;
    }

    // If same parent zone, medium rate
    if (pickupZone.parent_id && pickupZone.parent_id === destinationZone.parent_id) {
      return baseFare + 5;
    }

    // Different zones, higher rate
    return baseFare + 15;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError('يجب تسجيل الدخول أولاً');
      return;
    }

    if (!pickupZone || !destinationZone) {
      setError('يرجى تحديد منطقة الانطلاق ومنطقة الوجهة');
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
          pickup_zone_id: pickupZone.id,
          pickup_address: pickupZone.name,
          destination_zone_id: destinationZone.id,
          destination_address: destinationZone.name,
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

              {/* Pickup Zone */}
              <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
                <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-green-600" />
                  منطقة الانطلاق
                </h3>

                {pickupZone ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-green-900">{pickupZone.name}</p>
                    <button
                      type="button"
                      onClick={() => setShowPickupSelector(true)}
                      className="text-sm text-green-600 hover:text-green-700 mt-2"
                    >
                      تغيير المنطقة
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowPickupSelector(true)}
                    className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-brand hover:text-brand transition-colors"
                  >
                    اضغط لاختيار منطقة الانطلاق
                  </button>
                )}
              </div>

              {/* Destination Zone */}
              <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
                <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-brand" />
                  منطقة الوجهة
                </h3>

                {destinationZone ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-red-900">{destinationZone.name}</p>
                    <button
                      type="button"
                      onClick={() => setShowDestinationSelector(true)}
                      className="text-sm text-red-600 hover:text-red-700 mt-2"
                    >
                      تغيير المنطقة
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowDestinationSelector(true)}
                    className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-brand hover:text-brand transition-colors"
                  >
                    اضغط لاختيار منطقة الوجهة
                  </button>
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
                disabled={loading || !pickupZone || !destinationZone}
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

      {/* Pickup Zone Selector */}
      <AnimatePresence>
        {showPickupSelector && (
          <ZoneSelector
            onZoneSelected={(zone) => {
              setPickupZone(zone);
              setShowPickupSelector(false);
            }}
            onClose={() => setShowPickupSelector(false)}
            title="اختر منطقة الانطلاق"
          />
        )}
      </AnimatePresence>

      {/* Destination Zone Selector */}
      <AnimatePresence>
        {showDestinationSelector && (
          <ZoneSelector
            onZoneSelected={(zone) => {
              setDestinationZone(zone);
              setShowDestinationSelector(false);
            }}
            onClose={() => setShowDestinationSelector(false)}
            title="اختر منطقة الوجهة"
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default CaptainRequestPage;
