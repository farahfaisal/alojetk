import React, { useState, useEffect } from 'react';
import { MapPin, Shield, ChevronRight, Check, Clock, Star, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getMainServiceAreas, getSubServiceAreas, type ServiceArea } from '../lib/zones';

interface ServiceAreaSelectionProps {
  onSelectArea: (area: string) => void;
  onOpenPrivacyPolicy: () => void;
}

const ServiceAreaSelection: React.FC<ServiceAreaSelectionProps> = ({
  onSelectArea,
  onOpenPrivacyPolicy
}) => {
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedMainArea, setSelectedMainArea] = useState<ServiceArea | null>(null);
  const [subAreas, setSubAreas] = useState<ServiceArea[]>([]);

  useEffect(() => {
    const fetchAreas = async () => {
      try {
        setLoading(true);
        const areas = await getMainServiceAreas();
        setServiceAreas(areas);
      } catch (err) {
        console.error('Error fetching service areas:', err);
        setError('حدث خطأ في جلب مناطق الخدمة');
      } finally {
        setLoading(false);
      }
    };

    fetchAreas();
  }, []);

  const handleMainAreaClick = async (area: ServiceArea) => {
    try {
      setLoading(true);
      console.log('🔍 Fetching sub areas for main area:', area.id, area.name);
      const subs = await getSubServiceAreas(area.id);
      console.log('📍 Sub areas found:', subs.length, subs);

      if (subs.length > 0) {
        console.log('✅ Showing sub areas');
        setSelectedMainArea(area);
        setSubAreas(subs);
      } else {
        console.log('⚠️ No sub areas, selecting main area directly');
        handleAreaSelect(area.name);
      }
    } catch (err) {
      console.error('❌ Error fetching sub areas:', err);
      handleAreaSelect(area.name);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToMain = () => {
    setSelectedMainArea(null);
    setSubAreas([]);
  };

  const handleAreaSelect = (areaName: string) => {
    setSelectedArea(areaName);
    
    // Save selected area to localStorage
    localStorage.setItem('selectedServiceArea', areaName);
    
    // Animate selection and then proceed
    setTimeout(() => {
      onSelectArea(areaName);
    }, 800);
  };

  const getAreaIcon = (areaName: string) => {
    const icons: { [key: string]: string } = {
      'جنين': '🌾',
      'رام الله': '🏛️',
      'نابلس': '🏔️',
      'الخليل': '🕌',
      'بيت لحم': '⭐',
      'طولكرم': '🌿',
      'قلقيلية': '🌸',
      'أريحا': '🌴',
      'غزة': '🌊',
      'القدس': '🕊️',
      'يطا': '🏡',
      'دورا': '🏘️',
      'طوباس': '🌄',
      'سلفيت': '🌳',
      'خان يونس': '🏖️',
      'رفح': '🌅',
      'دير البلح': '🌺'
    };
    return icons[areaName] || '📍';
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-brand via-brand to-brand-dark flex items-center justify-center z-50">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full mx-auto mb-4"
          />
          <p className="text-white text-lg">جاري تحميل مناطق الخدمة...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-brand via-brand to-brand-dark flex flex-col z-50">
      {/* Decorative Background */}
      <div className="absolute inset-0">
        {/* Animated circles */}
        <motion.div
          animate={{
            x: [0, 100, 0],
            y: [0, -50, 0],
            scale: [1, 1.3, 1],
            opacity: [0.1, 0.3, 0.1]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-20 right-20 w-40 h-40 bg-white/10 rounded-full blur-2xl"
        />
        <motion.div
          animate={{
            x: [0, -80, 0],
            y: [0, 60, 0],
            scale: [1, 0.8, 1],
            opacity: [0.1, 0.2, 0.1]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-32 left-16 w-32 h-32 bg-yellow-400/20 rounded-full blur-xl"
        />
        <motion.div
          animate={{
            x: [0, 50, 0],
            y: [0, -30, 0],
            scale: [1, 1.2, 1],
            opacity: [0.05, 0.15, 0.05]
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 4 }}
          className="absolute top-1/2 left-8 w-28 h-28 bg-white/10 rounded-full blur-lg"
        />
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 text-center pt-16 pb-8"
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
          className="relative mx-auto mb-6"
        >
          <div className="w-24 h-24 mx-auto bg-white rounded-full shadow-2xl flex items-center justify-center relative overflow-hidden">
            <img
              src="https://rrhoxgfnikmtgsxwvjuv.supabase.co/storage/v1/object/public/general/categories/test.png"
              alt="الو جيتك"
              className="w-20 h-20 object-cover rounded-full"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "https://rrhoxgfnikmtgsxwvjuv.supabase.co/storage/v1/object/public/general/WhatsApp%20Image%202025-09-23%20at%2000.16.28.jpeg";
              }}
            />
            <div className="absolute inset-0 border-3 border-yellow-400 rounded-full"></div>
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="text-3xl font-bold text-white mb-2"
          style={{ fontFamily: 'TT Hoves Pro, Georgia, serif' }}
        >
          {selectedMainArea ? `اختر منطقة في ${selectedMainArea.name}` : 'اختر منطقة الخدمة'}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="text-white/90 text-lg"
        >
          {selectedMainArea ? 'اختر المنطقة الفرعية للتوصيل' : 'حدد المنطقة التي تريد الطلب منها'}
        </motion.p>
      </motion.div>

      {/* Service Areas Grid */}
      <div
        className="flex-1 overflow-y-auto px-4 scrollbar-thin scrollbar-thumb-brand scrollbar-track-gray-100"
        style={{
          paddingBottom: 'calc(96px + max(env(safe-area-inset-bottom), 0px))',
          overscrollBehavior: 'contain'
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.8 }}
          className="max-w-md mx-auto"
        >
          {selectedMainArea && (
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleBackToMain}
              className="mb-4 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl p-3 flex items-center gap-2 text-white hover:bg-white/30 transition-all"
            >
              <ChevronRight className="w-5 h-5" />
              <span className="font-medium">رجوع للمناطق الرئيسية</span>
            </motion.button>
          )}

          {error ? (
            <div className="bg-red-50 text-red-800 p-4 rounded-xl text-center">
              <p>{error}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {(selectedMainArea ? subAreas : serviceAreas).map((area, index) => (
                <motion.button
                  key={area.id}
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.2 + (index * 0.1), duration: 0.6 }}
                  whileHover={{
                    scale: 1.02,
                    boxShadow: "0 10px 30px rgba(255, 255, 255, 0.2)"
                  }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    if (area.status === 'active') {
                      if (selectedMainArea) {
                        handleAreaSelect(area.name);
                      } else {
                        handleMainAreaClick(area);
                      }
                    }
                  }}
                  disabled={area.status !== 'active' || selectedArea === area.name}
                  className={`relative bg-white/95 backdrop-blur-sm rounded-2xl p-4 shadow-lg transition-all ${
                    area.status === 'active' 
                      ? 'hover:bg-white cursor-pointer' 
                      : 'opacity-60 cursor-not-allowed'
                  } ${selectedArea === area.name ? 'ring-4 ring-yellow-400 bg-yellow-50' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Area Icon */}
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                        area.status === 'active' 
                          ? 'bg-brand/10' 
                          : 'bg-gray-100'
                      }`}>
                        {selectedArea === area.name ? (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center"
                          >
                            <Check className="w-5 h-5 text-white" />
                          </motion.div>
                        ) : (
                          <span>{getAreaIcon(area.name)}</span>
                        )}
                      </div>

                      {/* Area Info */}
                      <div className="text-right">
                        <h3 className="font-bold text-gray-900 text-lg">
                          {area.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          {area.status === 'active' && (
                            <div className="flex items-center gap-1 text-green-600">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                              <span className="text-sm font-medium">متاح الآن</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Arrow or Status */}
                    <div className="flex items-center">
                      {area.status === 'active' ? (
                        selectedArea === area.name ? (
                          <motion.div
                            initial={{ scale: 0, rotate: -90 }}
                            animate={{ scale: 1, rotate: 0 }}
                            className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center"
                          >
                            <Check className="w-5 h-5 text-white" />
                          </motion.div>
                        ) : (
                          <ChevronRight className="w-6 h-6 text-brand" />
                        )
                      ) : (
                        <div className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-xs font-bold">
                          قريباً
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Selection Animation */}
                  {selectedArea === area.name && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="absolute inset-0 bg-gradient-to-r from-green-400/20 to-green-500/20 rounded-2xl border-2 border-green-400 pointer-events-none"
                    />
                  )}

                  {/* Hover Effect */}
                  <motion.div
                    className="absolute inset-0 bg-brand/5 rounded-2xl opacity-0 pointer-events-none"
                    whileHover={{ opacity: area.status === 'active' ? 1 : 0 }}
                    transition={{ duration: 0.2 }}
                  />
                </motion.button>
              ))}
            </div>
          )}

          {/* Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 0.8 }}
            className="mt-8 bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-yellow-400/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Star className="w-6 h-6 text-yellow-300" />
              </div>
              <div>
                <h3 className="font-bold text-white mb-2">مرحباً بك في الو جيتك!</h3>
                <p className="text-white/80 text-sm leading-relaxed">
                  نقدم خدمة توصيل سريعة وموثوقة في جميع أنحاء فلسطين. 
                  اختر منطقتك لنبدأ رحلة التسوق معاً.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom Section with Privacy Policy */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.8, duration: 0.8 }}
        className="relative z-10 bg-white/10 backdrop-blur-sm border-t border-white/20"
        style={{
          paddingBottom: 'calc(1rem + max(env(safe-area-inset-bottom), 8px))'
        }}
      >
        <div className="max-w-md mx-auto px-4 py-6">
          {/* Privacy Policy Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onOpenPrivacyPolicy}
            className="w-full bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl p-4 flex items-center justify-center gap-3 hover:bg-white/30 transition-all"
          >
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 text-right">
              <h4 className="font-bold text-white">سياسة الخصوصية</h4>
              <p className="text-white/80 text-sm">اطلع على كيفية حماية بياناتك</p>
            </div>
            <ArrowRight className="w-5 h-5 text-white/70" />
          </motion.button>

          {/* Footer Text */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.2, duration: 0.8 }}
            className="text-center mt-4"
          >
            <p className="text-white/60 text-xs">
              باستخدام التطبيق، أنت توافق على شروط الخدمة وسياسة الخصوصية
            </p>
          </motion.div>
        </div>
      </motion.div>

      {/* Loading Animation for Selected Area */}
      <AnimatePresence>
        {selectedArea && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-20"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-2xl p-8 text-center shadow-2xl"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 border-4 border-brand/30 border-t-brand rounded-full mx-auto mb-4"
              />
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                جاري التحضير...
              </h3>
              <p className="text-gray-600">
                نقوم بإعداد خدماتنا في {selectedArea}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sparkle Effects */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ 
            opacity: [0, 1, 0],
            scale: [0, 1, 0],
            rotate: [0, 180, 360]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            delay: 2 + (i * 0.4),
            ease: "easeInOut"
          }}
          className="absolute text-yellow-300 text-lg pointer-events-none"
          style={{
            left: `${15 + (i * 10)}%`,
            top: `${20 + (i % 3) * 25}%`
          }}
        >
          ✨
        </motion.div>
      ))}
    </div>
  );
};

export default ServiceAreaSelection;