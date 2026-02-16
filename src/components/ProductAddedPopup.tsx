import React, { useEffect } from 'react';
import { X, ShoppingCart, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProductAddedPopupProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  onViewCart: () => void;
  onContinueShopping: () => void;
}

const ADD_TO_CART_SOUND = 'https://assets.mixkit.co/sfx/preview/mixkit-clear-announce-tones-2867.mp3';

const ProductAddedPopup: React.FC<ProductAddedPopupProps> = ({
  isOpen,
  onClose,
  productName,
  onViewCart,
  onContinueShopping
}) => {
  // Close popup automatically after 5 seconds
  useEffect(() => {
    if (isOpen) {
      const sound = new Audio(ADD_TO_CART_SOUND);
      sound.play().catch(() => {}); // تجاهل الخطأ إذا لم يُسمح تلقائيًا

      const timer = setTimeout(() => {
        onClose();
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/10 backdrop-blur-lg"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-white rounded-xl shadow-xl w-full max-w-md z-10 overflow-hidden"
          >
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Check className="w-5 h-5 text-green-500" />
                تمت الإضافة للسلة
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-brand/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <ShoppingCart className="w-6 h-6 text-brand" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">تمت إضافة المنتج للسلة</p>
                  <p className="text-gray-600">{productName}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={onViewCart}
                  className="bg-brand text-accent py-2.5 px-4 rounded-lg font-medium hover:bg-brand-light transition-colors"
                >
                  إتمام الطلب
                </button>
                <button
                  onClick={onContinueShopping}
                  className="bg-gray-100 text-gray-700 py-2.5 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  متابعة التسوق
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ProductAddedPopup;