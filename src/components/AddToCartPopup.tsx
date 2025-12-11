import React, { useEffect } from 'react';
import { X, ShoppingCart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AddToCartPopupProps {
  visible: boolean;
  onClose: () => void;
  productName?: string;
  onViewCart?: () => void;
}

const ADD_TO_CART_SOUND = 'https://assets.mixkit.co/sfx/preview/mixkit-clear-announce-tones-2867.mp3';

const AddToCartPopup: React.FC<AddToCartPopupProps> = ({
  visible,
  onClose,
  productName = 'المنتج',
  onViewCart
}) => {
  useEffect(() => {
    if (visible) {
      const sound = new Audio(ADD_TO_CART_SOUND);
      sound.play().catch(() => {}); // تجاهل الخطأ إذا لم يُسمح تلقائيًا

      const timeoutId = setTimeout(() => {
        onClose();
      }, 3000);

      return () => clearTimeout(timeoutId);
    }
  }, [visible, onClose]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed top-[72px] left-1/2 transform -translate-x-1/2 z-[100] bg-white rounded-xl shadow-xl p-6 max-w-sm w-[90%] text-center"
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingCart className="w-8 h-8 text-green-600" />
          </div>
          
          <h3 className="text-xl font-bold text-gray-900 mb-2">تم إضافة المنتج للسلة</h3>
          <p className="text-gray-600 mb-6">{productName}</p>
          
          <div className="flex gap-3">
            <button
              onClick={onViewCart || onClose}
              className="flex-1 bg-brand text-accent py-3 rounded-lg font-medium hover:bg-brand-light transition-colors"
            >
              عرض السلة
            </button>
             
            <button
              onClick={onClose}
              className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200 transition-colors"
            >
              متابعة التسوق
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AddToCartPopup;