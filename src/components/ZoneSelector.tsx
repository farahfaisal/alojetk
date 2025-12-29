import React, { useState, useEffect } from 'react';
import { X, MapPin, Loader2, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { getMainServiceAreas, getSubServiceAreas, ServiceArea } from '../lib/zones';

interface ZoneSelectorProps {
  onZoneSelected: (zone: ServiceArea) => void;
  onClose: () => void;
  title: string;
}

const ZoneSelector: React.FC<ZoneSelectorProps> = ({ onZoneSelected, onClose, title }) => {
  const [mainAreas, setMainAreas] = useState<ServiceArea[]>([]);
  const [subAreas, setSubAreas] = useState<ServiceArea[]>([]);
  const [selectedMainArea, setSelectedMainArea] = useState<ServiceArea | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSubAreas, setLoadingSubAreas] = useState(false);

  useEffect(() => {
    loadMainAreas();
  }, []);

  const loadMainAreas = async () => {
    try {
      setLoading(true);
      const areas = await getMainServiceAreas();
      // Filter only active areas
      setMainAreas(areas.filter(area => area.is_active));
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
        // No sub-areas, select the main area directly
        onZoneSelected(area);
      }
    } catch (error) {
      console.error('Error loading sub-areas:', error);
      // If error, just use main area
      onZoneSelected(area);
    } finally {
      setLoadingSubAreas(false);
    }
  };

  const handleSubAreaClick = (subArea: ServiceArea) => {
    onZoneSelected(subArea);
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
        className="fixed inset-0 z-[9999] bg-white overflow-hidden"
        style={{
          paddingTop: 'max(env(safe-area-inset-top), 0px)',
          paddingBottom: 'max(env(safe-area-inset-bottom), 0px)'
        }}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-brand to-red-600 text-white px-4 py-4 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              {selectedMainArea && (
                <button
                  onClick={handleBack}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  ←
                </button>
              )}
              <MapPin className="w-6 h-6" />
              <h2 className="text-xl font-bold">
                {selectedMainArea ? `مناطق ${selectedMainArea.name}` : title}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-brand" />
              </div>
            ) : selectedMainArea && subAreas.length > 0 ? (
              // Show sub-areas
              <div className="space-y-2">
                {loadingSubAreas ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="w-8 h-8 animate-spin text-brand" />
                  </div>
                ) : (
                  subAreas.map((subArea) => (
                    <button
                      key={subArea.id}
                      onClick={() => handleSubAreaClick(subArea)}
                      className="w-full bg-white border-2 border-gray-200 rounded-xl p-4 text-right hover:border-brand hover:bg-red-50 transition-all shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <MapPin className="w-5 h-5 text-brand" />
                          <span className="font-medium text-lg">{subArea.name}</span>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-gray-300" />
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : (
              // Show main areas
              <div className="space-y-2">
                {mainAreas.map((area) => (
                  <button
                    key={area.id}
                    onClick={() => handleMainAreaClick(area)}
                    className="w-full bg-white border-2 border-gray-200 rounded-xl p-4 text-right hover:border-brand hover:bg-red-50 transition-all shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-brand" />
                        <span className="font-medium text-lg">{area.name}</span>
                      </div>
                      <div className="text-gray-400">←</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
};

export default ZoneSelector;
