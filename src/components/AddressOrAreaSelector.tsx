import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Plus, ChevronLeft, Home, Building, Navigation, ChevronRight, Check, Search, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import NewAddressPage from './NewAddressPage';
import AddressForm from './AddressForm';
import { getMainServiceAreas, getSubServiceAreas, ServiceArea } from '../lib/zones';
import { SavedAddress as StorageAddress } from '../lib/storage';

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
  onAddressFormStateChange?: (isOpen: boolean) => void;
}

const AddressOrAreaSelector: React.FC<AddressOrAreaSelectorProps> = ({
  onClose,
  onAddressSelected,
  onAreaSelected,
  onAddressFormStateChange
}) => {
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddressForm, setShowAddressForm] = useState(false);
  // Always start with addresses view to show saved addresses
  const [selectedView, setSelectedView] = useState<'addresses' | 'main-areas' | 'sub-areas'>('addresses');
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [selectedMainArea, setSelectedMainArea] = useState<ServiceArea | null>(null);
  const [subAreas, setSubAreas] = useState<ServiceArea[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [allSubAreas, setAllSubAreas] = useState<ServiceArea[]>([]);

  useEffect(() => {
    loadSavedAddresses();
    loadServiceAreas();
  }, []);

  // Notify parent when address form state changes
  useEffect(() => {
    if (onAddressFormStateChange) {
      onAddressFormStateChange(showAddressForm);
    }
  }, [showAddressForm, onAddressFormStateChange]);

  const loadServiceAreas = async () => {
    try {
      const areas = await getMainServiceAreas();
      setServiceAreas(areas);

      // Load all sub areas for search
      const allSubs: ServiceArea[] = [];
      for (const area of areas) {
        const subs = await getSubServiceAreas(area.id);
        allSubs.push(...subs);
      }
      setAllSubAreas(allSubs);
    } catch (error) {
      console.error('Error loading service areas:', error);
    }
  };

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
        address_label: addr.label || `بدون عنوان - ${addr.phone}`,
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

  const handleAddressClick = async (address: SavedAddress) => {
    // Always set the selected address as default
    if (!address.is_default) {
      try {
        const storedUser = localStorage.getItem('auth_user');
        if (storedUser) {
          const user = JSON.parse(storedUser);

          // Update the address to be default in database
          await supabase
            .from('customer_addresses')
            .update({ is_default: true })
            .eq('id', address.id)
            .eq('customer_id', user.id);

          // The trigger will automatically set all other addresses to false
          // Update local state
          address.is_default = true;
        }
      } catch (error) {
        console.error('Error setting default address:', error);
      }
    }

    onAddressSelected(address);
    onClose();
  };

  const handleSelectNewArea = () => {
    setSelectedView('main-areas');
  };

  const handleMainAreaClick = async (area: ServiceArea) => {
    setSelectedMainArea(area);
    const subs = await getSubServiceAreas(area.id);
    setSubAreas(subs);
    setSelectedView('sub-areas');
  };

  const handleSubAreaClick = (area: ServiceArea) => {
    setSelectedCity(area.name);
    setShowAddressForm(true);
  };

  const handleBackToAddresses = () => {
    // For guests, don't allow back to addresses view - stay in main areas
    const storedUser = localStorage.getItem('auth_user');
    if (!storedUser) {
      setSelectedView('main-areas');
    } else if (!hasSelectedArea) {
      setSelectedView('main-areas');
    } else {
      setSelectedView('addresses');
    }
    setSelectedMainArea(null);
    setSubAreas([]);
    setSelectedCity('');
  };

  const handleBackToMainAreas = () => {
    setSelectedView('main-areas');
    setSelectedMainArea(null);
    setSubAreas([]);
  };

  const handleDeleteAddress = async (e: React.MouseEvent, addressId: string) => {
    e.stopPropagation();

    if (!confirm('هل أنت متأكد من حذف هذا العنوان؟')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('customer_addresses')
        .delete()
        .eq('id', addressId);

      if (error) throw error;

      // Reload addresses
      await loadSavedAddresses();
    } catch (error) {
      console.error('Error deleting address:', error);
      alert('حدث خطأ أثناء حذف العنوان');
    }
  };

  // Filter service areas and sub areas based on search query
  const searchLower = searchQuery.toLowerCase();

  // For main areas view: show both main areas and matching sub areas
  const filteredServiceAreas = serviceAreas.filter(area =>
    area.name.toLowerCase().includes(searchLower)
  );

  const matchingSubAreasFromAll = searchQuery
    ? allSubAreas.filter(area => area.name.toLowerCase().includes(searchLower))
    : [];

  // Filter sub areas based on search query (for sub-areas view)
  const filteredSubAreas = subAreas.filter(area =>
    area.name.toLowerCase().includes(searchLower)
  );

  const handleAddressSaved = async (address: any) => {
    console.log('✅ Address saved, reloading addresses list');

    // Reload addresses to show the new one
    await loadSavedAddresses();

    // Close the address form and return to addresses view
    setShowAddressForm(false);
    setSelectedView('addresses');
    setSelectedMainArea(null);
    setSubAreas([]);
    setSelectedCity('');

    // Don't auto-select or close - let user choose from the list
    console.log('🔵 Showing addresses list for user to select');
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

  const hasSelectedArea = !!localStorage.getItem('selectedServiceArea');

  // Never close on background click - user must select an address
  const handleBackgroundClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Do nothing - never close on background click
  };

  return (
    <>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(2px)', pointerEvents: 'auto' }}
      onClick={handleBackgroundClick}
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
        {/* Handle bar - Disabled (cannot close) */}
        <div className="flex justify-center pt-3 pb-2" style={{ background: 'transparent' }}>
          <div
            className="w-12 h-1.5 bg-white/60 rounded-full cursor-not-allowed opacity-50"
          ></div>
        </div>

        {/* Header and Content Container */}
        <div className="bg-white rounded-t-3xl shadow-2xl flex-1 flex flex-col">
        {/* Header */}
        <div className="px-6 pb-3 pt-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {(selectedView === 'main-areas' || selectedView === 'sub-areas') && (
              <button
                onClick={selectedView === 'main-areas' ? handleBackToAddresses : handleBackToMainAreas}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
            <h2 className="text-xl font-bold text-black flex-1">
              {selectedView === 'addresses' && 'اختر موقع التوصيل'}
              {selectedView === 'main-areas' && 'اختر المنطقة الرئيسية'}
              {selectedView === 'sub-areas' && `اختر منطقة في ${selectedMainArea?.name}`}
            </h2>
            {/* Close button - only show if service area is already selected */}
            {hasSelectedArea && (
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            )}
          </div>
          <p className="text-sm mt-1 font-medium text-gray-700">
            {selectedView === 'addresses' && 'حدد العنوان للمتابعة'}
            {selectedView === 'main-areas' && 'اختر المنطقة الرئيسية أولاً'}
            {selectedView === 'sub-areas' && 'اختر المنطقة الفرعية'}
          </p>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4 address-selector-scroll" style={{ maxHeight: '50vh' }}>
          {/* Main Service Areas */}
          {selectedView === 'main-areas' && (
            <div className="space-y-3">
              {/* Search Box */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث عن منطقة..."
                  className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b91c1c]"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              </div>

              {filteredServiceAreas.length === 0 && matchingSubAreasFromAll.length === 0 ? (
                <div className="text-center py-8">
                  <MapPin className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-black font-semibold">لا توجد نتائج للبحث</p>
                </div>
              ) : (
                <>
                  {/* Main Areas */}
                  {filteredServiceAreas.length > 0 && (
                    <>
                      {searchQuery && (
                        <h3 className="text-sm font-semibold text-gray-600 px-2 mt-2">المناطق الرئيسية</h3>
                      )}
                      {filteredServiceAreas.map((area) => (
                        <motion.button
                          key={area.id}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleMainAreaClick(area)}
                          className="w-full p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-[#b91c1c] transition-all text-right"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-black">{area.name}</span>
                            <ChevronLeft className="w-5 h-5 text-gray-500 rotate-180" />
                          </div>
                        </motion.button>
                      ))}
                    </>
                  )}

                  {/* Sub Areas matching search */}
                  {matchingSubAreasFromAll.length > 0 && (
                    <>
                      <h3 className="text-sm font-semibold text-gray-600 px-2 mt-4">المناطق الفرعية</h3>
                      {matchingSubAreasFromAll.map((area) => (
                        <motion.button
                          key={area.id}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleSubAreaClick(area)}
                          className="w-full p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-[#b91c1c] transition-all text-right"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-black">{area.name}</span>
                            <Check className="w-5 h-5 text-[#b91c1c]" />
                          </div>
                        </motion.button>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* Sub Service Areas */}
          {selectedView === 'sub-areas' && (
            <div className="space-y-3">
              {/* Search Box */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث عن منطقة..."
                  className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#b91c1c]"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              </div>

              {filteredSubAreas.length === 0 ? (
                <div className="text-center py-8">
                  <MapPin className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-black font-semibold">لا توجد نتائج للبحث</p>
                </div>
              ) : (
                filteredSubAreas.map((area) => (
                  <motion.button
                    key={area.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSubAreaClick(area)}
                    className="w-full p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-[#b91c1c] transition-all text-right"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-black">{area.name}</span>
                      <ChevronLeft className="w-5 h-5 text-gray-500 rotate-180" />
                    </div>
                  </motion.button>
                ))
              )}
            </div>
          )}

          {/* Addresses List - Show Directly */}
          {selectedView === 'addresses' && (
            <div className="space-y-3">
              {loading ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 border-4 border-[#b91c1c] border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-black font-semibold mt-4">جاري التحميل...</p>
                </div>
              ) : savedAddresses.length === 0 && localStorage.getItem('auth_user') ? (
                <div className="h-full">
                  <AddressForm
                    onSave={async (storageAddress: StorageAddress) => {
                      // Reload addresses from database
                      await loadSavedAddresses();

                      // Convert StorageAddress to SavedAddress format
                      const dbAddress: SavedAddress = {
                        id: storageAddress.id,
                        customer_id: '', // Will be filled by loadSavedAddresses
                        address_label: storageAddress.address,
                        address_line1: storageAddress.detailedAddress || storageAddress.address,
                        city: storageAddress.city,
                        zone_id: storageAddress.serviceAreaId || '',
                        zone_name: storageAddress.serviceAreaName,
                        latitude: storageAddress.coordinates?.lat,
                        longitude: storageAddress.coordinates?.lng,
                        is_default: storageAddress.isDefault
                      };

                      onAddressSelected(dbAddress);
                      onClose();
                    }}
                    onCancel={onClose}
                    isModal={true}
                    preselectedCity={selectedCity}
                  />
                </div>
              ) : savedAddresses.length === 0 ? (
                <div className="text-center py-8">
                  <MapPin className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-black font-semibold mb-2">لا توجد عناوين محفوظة</p>
                  <p className="text-gray-600 text-sm mb-4">اختر منطقة للمتابعة</p>
                  <button
                    onClick={handleSelectNewArea}
                    className="px-6 py-3 bg-[#b91c1c] text-white rounded-xl font-semibold hover:bg-[#991515] transition-colors"
                  >
                    اختر منطقة
                  </button>
                </div>
              ) : (
                <>
                  {savedAddresses.map((address) => (
                    <motion.div
                      key={address.id}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full p-4 rounded-xl border-2 transition-all text-right relative ${
                        address.is_default
                          ? 'border-[#b91c1c] bg-red-50'
                          : 'border-gray-200 bg-white hover:border-[#b91c1c]'
                      }`}
                    >
                      <div
                        onClick={() => handleAddressClick(address)}
                        className="flex items-start gap-3 cursor-pointer"
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          address.is_default ? 'bg-[#b91c1c]' : 'bg-gray-100'
                        }`}>
                          <div className={address.is_default ? 'text-white' : 'text-gray-600'}>
                            {getAddressIcon(address.address_label)}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-black text-base">{address.address_label}</h4>
                            {address.is_default && (
                              <span className="text-xs bg-[#b91c1c] text-white px-2 py-0.5 rounded-full font-semibold">
                                افتراضي
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-800 mb-1.5 leading-relaxed font-medium">{address.address_line1}</p>
                          <div className="flex items-center gap-1.5 text-sm text-gray-800 bg-gray-50 rounded-lg px-2 py-1 w-fit">
                            <Navigation className="w-3.5 h-3.5 text-[#b91c1c]" />
                            <span className="font-semibold">{address.zone_name || address.city}</span>
                          </div>
                        </div>
                        <ChevronLeft className="w-4 h-4 text-gray-400 flex-shrink-0 rotate-180 mt-2" />
                      </div>

                      {/* Delete Button */}
                      <button
                        onClick={(e) => handleDeleteAddress(e, address.id)}
                        className="absolute left-2 top-2 w-8 h-8 flex items-center justify-center rounded-lg bg-red-100 hover:bg-red-200 text-red-600 transition-colors"
                        aria-label="حذف العنوان"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}

                  {/* Add New Address Button */}
                  {localStorage.getItem('auth_user') && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSelectNewArea}
                      className="w-full p-4 bg-gradient-to-r from-[#b91c1c] to-[#b91c1c] text-white rounded-xl hover:shadow-lg transition-all"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Plus className="w-5 h-5" />
                        <span className="font-semibold">إضافة عنوان جديد</span>
                      </div>
                    </motion.button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        </div>
      </motion.div>

    </motion.div>

      {/* New Address Form - Outside motion.div to have proper z-index */}
      {showAddressForm && (
        <NewAddressPage
          onClose={() => {
            setShowAddressForm(false);
            setSelectedView('addresses');
            setSelectedMainArea(null);
            setSubAreas([]);
            setSelectedCity('');
          }}
          onSave={handleAddressSaved}
          preselectedCity={selectedCity}
        />
      )}
    </>
  );
};

export default AddressOrAreaSelector;
