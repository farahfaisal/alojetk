import React from 'react';
import { LogIn, ShoppingCart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LoginPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
}

const LoginPrompt: React.FC<LoginPromptProps> = ({ isOpen, onClose, onLogin }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden"
      >
        <div className="p-6 bg-gradient-to-br from-brand to-brand-light text-center">
          <div className="w-20 h-20 bg-white rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg">
            <ShoppingCart className="w-10 h-10 text-brand" />
          </div>
          <h2 className="text-2xl font-bold text-accent mb-2">تسجيل الدخول مطلوب</h2>
          <p className="text-accent/80">يرجى تسجيل الدخول للوصول إلى صفحة إتمام الطلب</p>
        </div>

        <div className="p-6">
          <p className="text-gray-600 mb-6 text-center">
            يجب عليك تسجيل الدخول أولاً لتتمكن من إتمام عملية الشراء
          </p>

          <div className="space-y-3">
            <button
              onClick={onLogin}
              className="w-full bg-brand text-accent py-3 rounded-lg hover:bg-brand-light transition-colors flex items-center justify-center gap-2 font-medium"
            >
              <LogIn className="w-5 h-5" />
              تسجيل الدخول
            </button>
            
            <button
              onClick={onClose}
              className="w-full border border-gray-200 bg-white text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              إلغاء
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPrompt;