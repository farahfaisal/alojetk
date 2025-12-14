import React from 'react';
import { Bell, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3 }}
            className="absolute top-0 right-0 h-full w-full sm:w-96 bg-white shadow-xl z-10"
            style={{
              paddingTop: 'max(env(safe-area-inset-top), 0px)'
            }}
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="p-4 border-b flex items-center justify-between bg-white shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Bell className="w-6 h-6 text-accent" />
                  الإشعارات
                </h2>
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              
              {/* Empty state */}
              <div className="flex flex-col items-center justify-center h-full p-4">
                <Bell className="w-16 h-16 text-gray-300 mb-4" />
                <p className="text-gray-500 text-lg font-medium">لا توجد إشعارات</p>
                <p className="text-gray-400 text-sm mt-2">ستظهر الإشعارات الجديدة هنا</p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default NotificationCenter;