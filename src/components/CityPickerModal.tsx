import React, { useState, useEffect } from 'react';
import { X, MapPin, Check, Clock, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getMainServiceAreas, getSubServiceAreas, type ServiceArea } from '../lib/zones';

interface CityPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCity: (cityName: string) => void;
  currentCity?: string;
}

const CityPickerModal: React.FC<CityPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectCity,
  currentCity
}) => {
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedMainArea, setSelectedMainArea] = useState<ServiceArea | null>(null);
  const [subAreas, setSubAreas] = useState<ServiceArea[]>([]);

  useEffect(() => {
    if (isOpen) {
      const fetchAreas = async () => {
        try {
          setLoading(true);
          setSelectedMainArea(null);
          setSubAreas([]);
          const areas = await getMainServiceAreas();
          setServiceAreas(areas);
        } catch (err) {
          console.error('Error fetching service areas:', err);
        } finally {
          setLoading(false);
        }
      };

      fetchAreas();
    }
  }, [isOpen]);

  const handleMainAreaClick = async (area: ServiceArea) => {
    try {
      setLoading(true);
      const subs = await getSubServiceAreas(area.id);

      if (subs.length > 0) {
        setSelectedMainArea(area);
        setSubAreas(subs);
      } else {
        handleCitySelect(area.name, area.status || 'active');
      }
    } catch (err) {
      console.error('Error fetching sub areas:', err);
      handleCitySelect(area.name, area.status || 'active');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToMain = () => {
    setSelectedMainArea(null);
    setSubAreas([]);
  };

  const handleCitySelect = (cityName: string, status: string) => {
    if (status === 'active') {
      setSelectedCity(cityName);
      setTimeout(() => {
        onSelectCity(cityName);
        onClose();
      }, 300);
    }
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
      'القدس': '🕊️'
    };
    return icons[areaName] || '📍';
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-end"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full bg-gradient-to-br from-brand via-brand to-brand-dark rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white/10 backdrop-blur-sm px-6 py-5 flex items-center justify-between border-b border-white/20">
            <div className="flex items-center gap-3">
              <MapPin className="w-6 h-6 text-white" />
              <h2 className="text-xl font-bold text-white">
                {selectedMainArea ? `اختر منطقة في ${selectedMainArea.name}` : 'اختر المدينة'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors backdrop-blur-sm"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4" style={{
            paddingBottom: 'max(env(safe-area-inset-bottom), 16px)'
          }}>
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

            {loading ? (
              <div className="p-8 flex items-center justify-center">
                <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 max-w-md mx-auto">
                {(selectedMainArea ? subAreas : serviceAreas).map((area, index) => (
                  <motion.button
                    key={area.id}
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.4 }}
                    onClick={() => {
                      if (area.status === 'active') {
                        if (selectedMainArea) {
                          handleCitySelect(area.name, area.status);
                        } else {
                          handleMainAreaClick(area);
                        }
                      }
                    }}
                    disabled={area.status !== 'active'}
                    className={`relative bg-white/95 backdrop-blur-sm rounded-2xl p-4 shadow-lg transition-all ${
                      area.status === 'active'
                        ? 'hover:bg-white cursor-pointer'
                        : 'opacity-60 cursor-not-allowed'
                    } ${(selectedCity === area.name || currentCity === area.name) ? 'ring-4 ring-yellow-400 bg-yellow-50' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                          area.status === 'active'
                            ? 'bg-brand/10'
                            : 'bg-gray-100'
                        }`}>
                          {(selectedCity === area.name || currentCity === area.name) ? (
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

                      <div className="flex items-center">
                        {area.status === 'active' ? (
                          (selectedCity === area.name || currentCity === area.name) ? (
                            <motion.div
                              initial={{ scale: 0, rotate: -90 }}
                              animate={{ scale: 1, rotate: 0 }}
                              className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center"
                            >
                              <Check className="w-5 h-5 text-white" />
                            </motion.div>
                          ) : (
                            <div className="w-8 h-8" />
                          )
                        ) : (
                          <div className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-xs font-bold">
                            قريباً
                          </div>
                        )}
                      </div>
                    </div>

                    {(selectedCity === area.name || currentCity === area.name) && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="absolute inset-0 bg-gradient-to-r from-green-400/20 to-green-500/20 rounded-2xl border-2 border-green-400 pointer-events-none"
                      />
                    )}

                    <motion.div
                      className="absolute inset-0 bg-brand/5 rounded-2xl opacity-0 pointer-events-none"
                      whileHover={{ opacity: area.status === 'active' ? 1 : 0 }}
                      transition={{ duration: 0.2 }}
                    />
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CityPickerModal;
