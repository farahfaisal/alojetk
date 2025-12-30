import React, { useState, useEffect } from 'react';
import { X, MapPin, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getMainServiceAreas, getSubServiceAreas, ServiceArea } from '../lib/zones';

interface ServiceAreaPickerProps {
  onAreaSelected: (area: ServiceArea) => void;
  onClose: () => void;
  title?: string;
}

const ServiceAreaPicker: React.FC<ServiceAreaPickerProps> = ({
  onAreaSelected,
  onClose,
  title = 'اختر منطقة الخدمة'
}) => {
  const [mainAreas, setMainAreas] = useState<ServiceArea[]>([]);
  const [subAreas, setSubAreas] = useState<ServiceArea[]>([]);
  const [selectedMainArea, setSelectedMainArea] = useState<ServiceArea | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSubAreas, setLoadingSubAreas] = useState(false);

  useEffect(() => {
    loadMainAreas();
  }, []);

  const loadMainAreas = async () => {
    setLoading(true);
    try {
      const areas = await getMainServiceAreas();
      const activeAreas = areas.filter(area => area.status === 'active' || area.is_active);
      setMainAreas(activeAreas);
    } catch (error) {
      console.error('Error loading service areas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMainAreaClick = async (area: ServiceArea) => {
    setSelectedMainArea(area);
    setLoadingSubAreas(true);

    try {
      const subs = await getSubServiceAreas(area.id);

      if (subs.length > 0) {
        setSubAreas(subs);
      } else {
        onAreaSelected(area);
      }
    } catch (error) {
      console.error('Error loading sub areas:', error);
      onAreaSelected(area);
    } finally {
      setLoadingSubAreas(false);
    }
  };

  const handleSubAreaClick = (subArea: ServiceArea) => {
    onAreaSelected(subArea);
  };

  const handleBack = () => {
    setSelectedMainArea(null);
    setSubAreas([]);
  };

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
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed bottom-0 left-0 right-0 z-[9999] bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-hidden"
        style={{
          paddingBottom: 'max(env(safe-area-inset-bottom), 0px)'
        }}
      >
        <div className="flex flex-col h-full">
          <div className="bg-gradient-to-r from-brand to-red-600 text-white px-6 py-4 flex items-center justify-between rounded-t-3xl">
            <div className="flex items-center gap-3">
              {selectedMainArea && (
                <button
                  onClick={handleBack}
                  className="p-1 hover:bg-white/10 rounded-full transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <MapPin className="w-6 h-6" />
              <h2 className="text-xl font-bold">
                {selectedMainArea ? selectedMainArea.name : title}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-brand animate-spin" />
              </div>
            ) : loadingSubAreas ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-brand animate-spin" />
              </div>
            ) : subAreas.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 mb-4 px-2">اختر المنطقة التابعة:</p>
                {subAreas.map((subArea) => (
                  <motion.button
                    key={subArea.id}
                    onClick={() => handleSubAreaClick(subArea)}
                    className="w-full p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-brand hover:bg-red-50 transition-all flex items-center justify-between group"
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-brand to-red-600 rounded-full flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-white" />
                      </div>
                      <span className="font-bold text-gray-800 group-hover:text-brand">
                        {subArea.name}
                      </span>
                    </div>
                    <CheckCircle2 className="w-6 h-6 text-gray-300 group-hover:text-brand transition-colors" />
                  </motion.button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 mb-4 px-2">اختر المنطقة الرئيسية:</p>
                {mainAreas.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MapPin className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>لا توجد مناطق خدمة متاحة حالياً</p>
                  </div>
                ) : (
                  mainAreas.map((area) => (
                    <motion.button
                      key={area.id}
                      onClick={() => handleMainAreaClick(area)}
                      className="w-full p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-brand hover:bg-red-50 transition-all flex items-center justify-between group"
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-brand to-red-600 rounded-full flex items-center justify-center">
                          <MapPin className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-bold text-gray-800 group-hover:text-brand">
                          {area.name}
                        </span>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-brand transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </motion.button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
};

export default ServiceAreaPicker;
