import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Plus, ChevronLeft, Home, Building, Navigation } from 'lucide-react';
import { supabase } from '../lib/supabase';
import CitySelector from './CitySelector';

interface SavedAddress {
  id: string;
  customer_id: string;
  address_label: string;
  address_line1: string;
  city: string;
  zone_id: string;
  zone_name?: string;
  latitude?: number;
  longitude?: number;
  is_default: boolean;
}

interface AddressOrAreaSelectorProps {
  onClose: () => void;
  onAddressSelected: (address: SavedAddress) => void;
  onAreaSelected: (area: string) => void;
}

const AddressOrAreaSelector: React.FC<AddressOrAreaSelectorProps> = ({
  onClose,
  onAddressSelected,
  onAreaSelected
}) => {
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCitySelector, setShowCitySelector] = useState(false);
  const [selectedView, setSelectedView] = useState<'choose' | 'addresses' | 'areas'>('choose');

  useEffect(() => {
    loadSavedAddresses();
  }, []);

  const loadSavedAddresses = async () => {
    try {
      const storedUser = localStorage.getItem('auth_user');
      if (!storedUser) {
        setLoading(false);
        return;
      }

      const user = JSON.parse(storedUser);

      const { data, error } = await supabase
        .from('customer_addresses')
        .select('*')
        .eq('customer_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedAddresses = data?.map(addr => ({
        id: addr.id,
        customer_id: addr.customer_id,
        address_label: addr.name,
        address_line1: addr.address,
        city: addr.city,
        zone_id: addr.city,
        zone_name: addr.city,
        latitude: addr.latitude,
        longitude: addr.longitude,
        is_default: addr.is_default
      })) || [];

      setSavedAddresses(formattedAddresses);
    } catch (error) {
      console.error('Error loading addresses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddressClick = (address: SavedAddress) => {
    onAddressSelected(address);
    onClose();
  };

  const handleSelectNewArea = () => {
    setSelectedView('areas');
    setShowCitySelector(true);
  };

  const handleAreaSelect = (area: string) => {
    onAreaSelected(area);
    setShowCitySelector(false);
    onClose();
  };

  const getAddressIcon = (label: string) => {
    if (label.includes('منزل') || label.includes('بيت')) {
      return <Home className="w-5 h-5" />;
    } else if (label.includes('عمل') || label.includes('مكتب')) {
      return <Building className="w-5 h-5" />;
    } else {
      return <MapPin className="w-5 h-5" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[999999] flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="bg-white rounded-t-3xl w-full max-w-lg shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
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
          <div className="flex items-center gap-4">
            {selectedView !== 'choose' && (
              <button
                onClick={() => setSelectedView('choose')}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
            )}
            <h2 className="text-2xl font-bold text-gray-900 flex-1">
              {selectedView === 'choose' && 'اختر موقع التوصيل'}
              {selectedView === 'addresses' && 'العناوين المحفوظة'}
              {selectedView === 'areas' && 'اختر منطقة التوصيل'}
            </h2>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Initial Choice View */}
          {selectedView === 'choose' && (
            <div className="space-y-4">
              {/* Saved Addresses Option - Always show */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedView('addresses')}
                className="w-full p-6 bg-gradient-to-br from-[#B91C1C] to-[#991B1B] rounded-2xl text-white shadow-lg hover:shadow-xl transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                    <MapPin className="w-7 h-7" />
                  </div>
                  <div className="flex-1 text-right">
                    <h3 className="text-xl font-bold mb-1">عناوين محفوظة</h3>
                    <p className="text-white/80 text-sm">
                      {savedAddresses.length > 0
                        ? `لديك ${savedAddresses.length} ${savedAddresses.length === 1 ? 'عنوان محفوظ' : 'عناوين محفوظة'}`
                        : 'اختر من عناوينك المحفوظة'
                      }
                    </p>
                  </div>
                  <ChevronLeft className="w-6 h-6 rotate-180" />
                </div>
              </motion.button>

              {/* New Area Option */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSelectNewArea}
                className="w-full p-6 bg-white border-2 border-gray-200 rounded-2xl hover:border-[#B91C1C] hover:bg-red-50 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-[#B91C1C]/10 rounded-xl flex items-center justify-center">
                    <Plus className="w-7 h-7 text-[#B91C1C]" />
                  </div>
                  <div className="flex-1 text-right">
                    <h3 className="text-xl font-bold text-gray-900 mb-1">اختر منطقة جديدة</h3>
                    <p className="text-gray-600 text-sm">اختر منطقة التوصيل من القائمة</p>
                  </div>
                  <ChevronLeft className="w-6 h-6 text-gray-400 rotate-180" />
                </div>
              </motion.button>
            </div>
          )}

          {/* Saved Addresses List */}
          {selectedView === 'addresses' && (
            <div className="space-y-3">
              {loading ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 border-4 border-[#B91C1C] border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-gray-600 mt-4">جاري التحميل...</p>
                </div>
              ) : savedAddresses.length === 0 ? (
                <div className="text-center py-12">
                  <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 mb-6">لا توجد عناوين محفوظة</p>
                  <button
                    onClick={handleSelectNewArea}
                    className="px-6 py-3 bg-[#B91C1C] text-white rounded-xl hover:bg-[#991B1B] transition-colors"
                  >
                    اختر منطقة جديدة
                  </button>
                </div>
              ) : (
                <>
                  {savedAddresses.map((address) => (
                    <motion.button
                      key={address.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleAddressClick(address)}
                      className={`w-full p-4 rounded-xl border-2 transition-all text-right ${
                        address.is_default
                          ? 'border-[#B91C1C] bg-red-50'
                          : 'border-gray-200 bg-white hover:border-[#B91C1C] hover:bg-red-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          address.is_default ? 'bg-[#B91C1C]' : 'bg-gray-100'
                        }`}>
                          <div className={address.is_default ? 'text-white' : 'text-gray-600'}>
                            {getAddressIcon(address.address_label)}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-gray-900">{address.address_label}</h4>
                            {address.is_default && (
                              <span className="text-xs bg-[#B91C1C] text-white px-2 py-0.5 rounded-full">
                                افتراضي
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-1">{address.address_line1}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Navigation className="w-3 h-3" />
                            <span>{address.zone_name || address.city}</span>
                          </div>
                        </div>
                        <ChevronLeft className="w-5 h-5 text-gray-400 flex-shrink-0 rotate-180 mt-3" />
                      </div>
                    </motion.button>
                  ))}

                  {/* Add New Area Button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSelectNewArea}
                    className="w-full p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-[#B91C1C] hover:bg-red-50 transition-all"
                  >
                    <div className="flex items-center justify-center gap-2 text-gray-600 hover:text-[#B91C1C]">
                      <Plus className="w-5 h-5" />
                      <span className="font-semibold">اختر منطقة جديدة</span>
                    </div>
                  </motion.button>
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* City Selector Modal */}
      {showCitySelector && (
        <CitySelector
          isOpen={showCitySelector}
          onSelectCity={handleAreaSelect}
          currentCity={null}
          required={true}
        />
      )}
    </motion.div>
  );
};

export default AddressOrAreaSelector;
