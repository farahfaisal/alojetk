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
    <div className="fixed inset-0 z-50">
      {/* Semi-transparent backdrop - allows home page to be visible */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      {/* Bottom sheet for area selection */}
      <div className="absolute inset-0 flex items-end justify-center pointer-events-none">
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="bg-white rounded-t-3xl w-full max-w-lg shadow-2xl flex flex-col pointer-events-auto"
          style={{
            maxHeight: '85vh',
            paddingBottom: 'max(env(safe-area-inset-bottom), 20px)'
          }}
        >
          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
          </div>

          {/* Header */}
          <div className="px-6 pb-4 border-b border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 text-center">
              {selectedMainArea ? `اختر منطقة في ${selectedMainArea.name}` : 'اختر موقع التوصيل'}
            </h2>
          </div>

      {/* Service Areas Grid - scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-md mx-auto">
          {selectedMainArea && (
            <button
              onClick={handleBackToMain}
              className="mb-4 bg-gray-100 rounded-xl p-3 flex items-center gap-2 text-gray-700 hover:bg-gray-200 transition-all w-full"
            >
              <ChevronRight className="w-5 h-5" />
              <span className="font-medium">رجوع للمناطق الرئيسية</span>
            </button>
          )}

          {error ? (
            <div className="bg-red-50 text-red-800 p-4 rounded-xl text-center">
              <p>{error}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {(selectedMainArea ? subAreas : serviceAreas).map((area, index) => (
                <button
                  key={area.id}
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
                  className={`relative bg-white rounded-2xl p-4 shadow-md border-2 transition-all ${
                    area.status === 'active'
                      ? 'hover:shadow-lg cursor-pointer border-gray-100 hover:border-brand/30'
                      : 'opacity-60 cursor-not-allowed border-gray-100'
                  } ${selectedArea === area.name ? 'ring-4 ring-green-400 bg-green-50 border-green-200' : ''}`}
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

                </button>
              ))}
            </div>
          )}
        </div>
      </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ServiceAreaSelection;