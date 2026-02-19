import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Plus, ChevronLeft, Home, Building, Navigation } from 'lucide-react';
import { supabase } from '../lib/supabase';
import NewAddressPage from './NewAddressPage';

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
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [selectedView, setSelectedView] = useState<'choose' | 'addresses' | 'areas'>('addresses');

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
    setShowAddressForm(true);
  };

  const handleAddressSaved = async (address: any) => {
    console.log('✅ Address saved, reloading addresses list');

    // Reload addresses to show the new one
    await loadSavedAddresses();

    // Close the address form
    setShowAddressForm(false);

    // Convert the saved address to our format and auto-select it
    const formattedAddress: SavedAddress = {
      id: address.id,
      customer_id: address.customer_id || address.customerId,
      address_label: address.name || address.address_label,
      address_line1: address.address || address.address_line1,
      city: address.city,
      zone_id: address.city,
      zone_name: address.city,
      latitude: address.coordinates?.lat || address.latitude,
      longitude: address.coordinates?.lng || address.longitude,
      is_default: address.isDefault || address.is_default
    };

    console.log('🔵 Auto-selecting new address:', formattedAddress);

    onAddressSelected(formattedAddress);
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
      className="fixed inset-0 z-[60] flex items-end justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(2px)', pointerEvents: 'auto' }}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="w-full max-w-lg flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxHeight: '75vh',
          paddingBottom: 'max(env(safe-area-inset-bottom), 20px)',
          background: 'transparent',
          pointerEvents: 'auto',
          display: showAddressForm ? 'none' : 'flex'
        }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2" style={{ background: 'transparent' }}>
          <div className="w-12 h-1.5 bg-white/60 rounded-full cursor-pointer" onClick={onClose}></div>
        </div>

        {/* Header and Content Container */}
        <div className="bg-white rounded-t-3xl shadow-2xl flex-1 flex flex-col">
        {/* Header */}
        <div className="px-6 pb-3 pt-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              {selectedView === 'addresses' && 'اختر موقع التوصيل'}
              {selectedView === 'areas' && 'إضافة عنوان جديد'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors text-sm font-medium"
            >
              إلغاء
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">حدد العنوان للمتابعة</p>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Addresses List - Show Directly */}
          {selectedView === 'addresses' && (
            <div className="space-y-3">
              {loading ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 border-4 border-[#B91C1C] border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-gray-600 mt-4">جاري التحميل...</p>
                </div>
              ) : savedAddresses.length === 0 ? (
                <div className="text-center py-8">
                  <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 mb-1">لا توجد عناوين محفوظة</p>
                  <p className="text-gray-500 text-sm mb-6">أضف عنوان جديد لبدء الطلب</p>
                  <button
                    onClick={handleSelectNewArea}
                    className="px-6 py-3 bg-gradient-to-r from-[#B91C1C] to-[#991B1B] text-white rounded-xl hover:shadow-lg transition-all font-semibold"
                  >
                    إضافة عنوان جديد
                  </button>
                </div>
              ) : (
                <>
                  {savedAddresses.map((address) => (
                    <motion.button
                      key={address.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleAddressClick(address)}
                      className={`w-full p-3.5 rounded-xl border-2 transition-all text-right ${
                        address.is_default
                          ? 'border-[#B91C1C] bg-red-50'
                          : 'border-gray-200 bg-white hover:border-[#B91C1C]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          address.is_default ? 'bg-[#B91C1C]' : 'bg-gray-100'
                        }`}>
                          <div className={address.is_default ? 'text-white' : 'text-gray-600'}>
                            {getAddressIcon(address.address_label)}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h4 className="font-semibold text-gray-900 text-sm">{address.address_label}</h4>
                            {address.is_default && (
                              <span className="text-xs bg-[#B91C1C] text-white px-2 py-0.5 rounded-full">
                                افتراضي
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 mb-1">{address.address_line1}</p>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Navigation className="w-3 h-3" />
                            <span>{address.zone_name || address.city}</span>
                          </div>
                        </div>
                        <ChevronLeft className="w-4 h-4 text-gray-400 flex-shrink-0 rotate-180 mt-2" />
                      </div>
                    </motion.button>
                  ))}

                  {/* Add New Address Button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSelectNewArea}
                    className="w-full p-4 bg-gradient-to-r from-[#B91C1C] to-[#991B1B] text-white rounded-xl hover:shadow-lg transition-all"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Plus className="w-5 h-5" />
                      <span className="font-semibold">إضافة عنوان جديد</span>
                    </div>
                  </motion.button>
                </>
              )}
            </div>
          )}
        </div>
        </div>
      </motion.div>

      {/* New Address Form */}
      {showAddressForm && (
        <NewAddressPage
          onClose={() => setShowAddressForm(false)}
          onSave={handleAddressSaved}
        />
      )}
    </motion.div>
  );
};

export default AddressOrAreaSelector;
