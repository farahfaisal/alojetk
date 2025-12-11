import React, { useState, useEffect } from 'react';
import { X, MapPin, Check, ChevronRight, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getMainServiceAreas, getSubServiceAreas, type ServiceArea } from '../lib/zones';

interface CitySelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCity: (cityName: string) => void;
  currentCity?: string;
}

const CitySelector: React.FC<CitySelectorProps> = ({
  isOpen,
  onClose,
  onSelectCity,
  currentCity
}) => {
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMainArea, setSelectedMainArea] = useState<ServiceArea | null>(null);
  const [subAreas, setSubAreas] = useState<ServiceArea[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadServiceAreas();
      setSearchQuery('');
    }
  }, [isOpen]);

  const loadServiceAreas = async () => {
    try {
      setLoading(true);
      setSelectedMainArea(null);
      setSubAreas([]);
      setSearchQuery('');
      const areas = await getMainServiceAreas();
      setServiceAreas(areas);
    } catch (error) {
      console.error('Error loading service areas:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAreas = (areas: ServiceArea[]) => {
    if (!searchQuery.trim()) return areas;

    const query = searchQuery.toLowerCase().trim();
    return areas.filter(area =>
      area.name.toLowerCase().includes(query)
    );
  };

  const handleMainAreaClick = async (area: ServiceArea) => {
    try {
      setLoading(true);
      const subs = await getSubServiceAreas(area.id);

      if (subs.length > 0) {
        setSelectedMainArea(area);
        setSubAreas(subs);
      } else {
        handleSelectArea(area);
      }
    } catch (err) {
      console.error('Error fetching sub areas:', err);
      handleSelectArea(area);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToMain = () => {
    setSelectedMainArea(null);
    setSubAreas([]);
  };

  const handleSelectArea = (area: ServiceArea) => {
    if (area.is_active || area.status === 'active') {
      onSelectCity(area.name);
      onClose();
    }
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
          className="w-full bg-white rounded-t-3xl shadow-2xl max-h-[70vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-br from-[#c21d14] to-[#8b1a1a] px-6 py-5 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <MapPin className="w-6 h-6 text-white" />
              <h2 className="text-xl font-bold text-white">
                {selectedMainArea ? `اختر منطقة في ${selectedMainArea.name}` : 'اختر منطقة التوصيل'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors backdrop-blur-sm"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Search Box */}
          <div className="sticky top-0 bg-white px-4 pt-4 pb-2 border-b border-gray-100 z-10">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن المنطقة..."
                className="w-full pr-11 pl-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#c21d14]/20 focus:border-[#c21d14] transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 160px)' }}>
            {loading ? (
              <div className="p-8 flex items-center justify-center">
                <div className="w-8 h-8 border-3 border-gray-200 border-t-[#c21d14] rounded-full animate-spin" />
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {selectedMainArea && (
                  <motion.button
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleBackToMain}
                    className="mb-4 bg-gray-100 hover:bg-gray-200 rounded-xl p-3 flex items-center gap-2 text-gray-700 transition-all"
                  >
                    <ChevronRight className="w-5 h-5" />
                    <span className="font-medium">رجوع للمناطق الرئيسية</span>
                  </motion.button>
                )}

                {(() => {
                  const currentAreas = selectedMainArea ? subAreas : serviceAreas;
                  const filteredAreas = filterAreas(currentAreas);

                  if (filteredAreas.length === 0) {
                    return (
                      <div className="py-12 text-center">
                        <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 text-lg font-medium">
                          لم يتم العثور على نتائج
                        </p>
                        <p className="text-gray-400 text-sm mt-1">
                          جرب البحث بكلمات أخرى
                        </p>
                      </div>
                    );
                  }

                  return filteredAreas.map((area) => {
                    const isActive = area.is_active || area.status === 'active';
                    return (
                      <motion.button
                        key={area.id}
                        onClick={() => {
                          if (isActive) {
                            if (selectedMainArea) {
                              handleSelectArea(area);
                            } else {
                              handleMainAreaClick(area);
                            }
                          }
                        }}
                        disabled={!isActive}
                        className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${
                          isActive
                            ? 'bg-white hover:bg-gray-50 border-2 border-gray-100 hover:border-[#c21d14]/30'
                            : 'bg-gray-50 cursor-not-allowed opacity-60'
                        } ${currentCity === area.name ? 'border-[#c21d14] bg-red-50' : ''}`}
                        whileHover={isActive ? { scale: 1.01 } : {}}
                        whileTap={isActive ? { scale: 0.99 } : {}}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                            currentCity === area.name
                              ? 'bg-[#c21d14]'
                              : isActive
                              ? 'bg-gray-100'
                              : 'bg-gray-200'
                          }`}>
                            <MapPin className={`w-6 h-6 ${
                              currentCity === area.name ? 'text-white' : 'text-gray-500'
                            }`} />
                          </div>
                          <div className="text-right">
                            <h3 className="text-lg font-bold text-gray-900">{area.name}</h3>
                            {isActive && (
                              <p className="text-sm text-green-600 font-medium flex items-center gap-1 justify-end">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                متاح الآن
                              </p>
                            )}
                          </div>
                        </div>
                        {isActive ? (
                          currentCity === area.name && (
                            <div className="w-8 h-8 rounded-full bg-[#c21d14] flex items-center justify-center">
                              <Check className="w-5 h-5 text-white" />
                            </div>
                          )
                        ) : (
                          <div className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-xs font-bold">
                            قريباً
                          </div>
                        )}
                      </motion.button>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CitySelector;
