import React, { useState } from 'react';
import { X, ShoppingBag, Loader2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface CustomOrderModalProps {
  vendorId: string;
  vendorName: string;
  onClose: () => void;
  userAddress?: {
    address: string;
    city: string;
    latitude?: number;
    longitude?: number;
  };
}

const CustomOrderModal: React.FC<CustomOrderModalProps> = ({
  vendorId,
  vendorName,
  onClose,
  userAddress
}) => {
  const { user } = useAuth();
  const [customRequest, setCustomRequest] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customRequest.trim()) {
      setError('يرجى كتابة تفاصيل طلبك');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cartItems = localStorage.getItem('cartItems');
      let cart = cartItems ? JSON.parse(cartItems) : {};

      const customItemId = `custom_${Date.now()}`;

      cart[customItemId] = {
        id: customItemId,
        product_id: null,
        name: 'طلب خاص',
        price: 0,
        quantity: 1,
        image: null,
        vendor_id: vendorId,
        vendor_name: vendorName,
        is_custom: true,
        custom_details: customRequest,
        addons: []
      };

      localStorage.setItem('cartItems', JSON.stringify(cart));
      window.dispatchEvent(new Event('cartUpdated'));

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Error adding custom order to cart:', err);
      setError('حدث خطأ أثناء إضافة الطلب للسلة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/20 z-[10001] backdrop-blur-md flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-brand to-red-600 text-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-6 h-6" />
              <div>
                <h2 className="text-lg font-bold">طلب مخصص</h2>
                <p className="text-sm text-white/90">{vendorName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {success ? (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center py-8"
              >
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">تمت الإضافة للسلة!</h3>
                <p className="text-gray-600">يمكنك الآن إتمام الطلب من السلة</p>
              </motion.div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    اكتب تفاصيل طلبك
                  </label>
                  <textarea
                    value={customRequest}
                    onChange={(e) => setCustomRequest(e.target.value)}
                    placeholder="مثال: أريد 2 كيلو لحم مفروم، 1 كيلو دجاج..."
                    rows={6}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    سيتم إضافة طلبك للسلة وسيقوم المتجر بتحديد السعر النهائي
                  </p>
                </div>

                {userAddress && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-900">
                      <strong>عنوان التوصيل:</strong> {userAddress.address}
                    </p>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !customRequest.trim()}
                    className="flex-1 py-3 bg-gradient-to-r from-brand to-red-600 text-white rounded-lg font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        جاري الإرسال...
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="w-5 h-5" />
                        إضافة للسلة
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CustomOrderModal;
