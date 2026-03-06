import React, { useState, useCallback, useEffect } from 'react';
import { MapPin, Navigation, X, Loader2, Check, AlertCircle, User, Phone, Home, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { SavedAddress, saveAddress, updateAddress, getSavedAddresses } from '../lib/storage';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import usePlacesAutocomplete, { getGeocode, getLatLng } from 'use-places-autocomplete';
import { getMainServiceAreas, getSubServiceAreas, ServiceArea } from '../lib/zones';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

interface AddressFormProps {
  onSave: (address: SavedAddress) => void;
  onCancel: () => void;
  initialAddress?: SavedAddress;
  isModal?: boolean;
  vendorLocation?: {
    lat: number;
    lng: number;
  };
  preselectedCity?: string;
}

const defaultMapCenter = { lat: 32.4594, lng: 35.2956 }; // Jenin coordinates

const mapContainerStyle = {
  width: '100%',
  height: '400px',
  borderRadius: '12px',
  overflow: 'hidden'
};

const AddressForm: React.FC<AddressFormProps> = ({
  onSave,
  onCancel,
  initialAddress,
  isModal = false,
  vendorLocation = defaultMapCenter,
  preselectedCity
}) => {
  const { user } = useAuth();

  // Get selected service area from localStorage
  const getDefaultCity = () => {
    if (preselectedCity) {
      return preselectedCity;
    }

    if (initialAddress?.city) {
      return initialAddress.city;
    }

    const selectedServiceArea = localStorage.getItem('selectedServiceArea');
    const selectedCity = localStorage.getItem('selectedCity');

    if (selectedServiceArea) {
      return selectedServiceArea;
    }

    if (selectedCity) {
      try {
        const parsed = JSON.parse(selectedCity);
        return typeof parsed === 'string' ? parsed : 'يطا';
      } catch {
        return selectedCity;
      }
    }

    return 'يطا';
  };

  const [formData, setFormData] = useState({
    name: initialAddress?.name || '',
    phone: initialAddress?.phone || '',
    address: initialAddress?.address || '',
    detailedAddress: initialAddress?.detailedAddress || '',
    city: getDefaultCity(),
    isDefault: initialAddress?.isDefault || false,
    coordinates: initialAddress?.coordinates || null,
    label: initialAddress?.label || ''
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markerPosition, setMarkerPosition] = useState(
    initialAddress?.coordinates || vendorLocation
  );
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [showServiceAreaPicker, setShowServiceAreaPicker] = useState(false);
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [selectedMainArea, setSelectedMainArea] = useState<ServiceArea | null>(null);
  const [subAreas, setSubAreas] = useState<ServiceArea[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Detect iOS
  useEffect(() => {
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(iOS);
    console.log('🔍 Device detection - iOS:', iOS);
  }, []);

  // Fetch service areas
  useEffect(() => {
    const fetchServiceAreas = async () => {
      const areas = await getMainServiceAreas();
      setServiceAreas(areas.filter(area => area.status === 'active'));
    };
    fetchServiceAreas();
  }, []);

  // Auto-fill user data when no initialAddress provided
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user || initialAddress) return;

      const customerId = user.customer_id || user.id;
      const { data, error } = await supabase
        .from('customers')
        .select('name, phone, address, city')
        .eq('id', customerId)
        .maybeSingle();

      if (data && !error) {
        setFormData(prev => ({
          ...prev,
          name: data.name || prev.name,
          phone: data.phone || prev.phone,
          address: data.address || prev.address,
          city: data.city || prev.city
        }));
      }
    };

    fetchUserData();
  }, [user, initialAddress]);

  const handleMainAreaClick = async (area: ServiceArea) => {
    try {
      const subs = await getSubServiceAreas(area.id);

      if (subs.length > 0) {
        setSelectedMainArea(area);
        setSubAreas(subs);
      } else {
        setFormData(prev => ({ ...prev, city: area.name }));
        setShowServiceAreaPicker(false);
      }
    } catch (err) {
      console.error('Error fetching sub areas:', err);
      setFormData(prev => ({ ...prev, city: area.name }));
      setShowServiceAreaPicker(false);
    }
  };

  const handleBackToMain = () => {
    setSelectedMainArea(null);
    setSubAreas([]);
  };

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ['places'],
    preventGoogleFontsLoading: true,
    language: 'ar',
    region: 'PS'
  });

  const {
    ready,
    value,
    suggestions: { status, data },
    setValue,
    clearSuggestions
  } = usePlacesAutocomplete({
    initOnMount: false,
    requestOptions: {
      componentRestrictions: { country: 'ps' },
      language: 'ar',
    },
    debounce: 300,
    cache: 86400,
  });

  // Initialize places autocomplete only when Google Maps is loaded
  useEffect(() => {
    if (isLoaded && ready) {
      console.log('🔍 Places autocomplete ready');
    }
  }, [isLoaded, ready]);

  // Check if this is a new default address
  const [isFirstAddress, setIsFirstAddress] = useState(false);

  useEffect(() => {
    const checkFirstAddress = async () => {
      const addresses = await getSavedAddresses();
      setIsFirstAddress(addresses.length === 0);
    };
    checkFirstAddress();
  }, []);

  const onLoad = useCallback((map: google.maps.Map) => {
    console.log('🗺️ Map loaded successfully');
    setMap(map);
    setMapLoaded(true);
    
    // iOS specific optimizations
    if (isIOS) {
      console.log('📱 Applying iOS-specific map settings');
      map.setOptions({
        gestureHandling: 'greedy',
        zoomControl: true,
        scrollwheel: true,
        draggable: true,
        clickableIcons: false,
        keyboardShortcuts: false,
        fullscreenControl: false,
        streetViewControl: false,
        mapTypeControl: false,
        scaleControl: false,
        rotateControl: false,
        panControl: false,
        disableDefaultUI: false,
        disableDoubleClickZoom: false
      });
      
      // Force resize after load for iOS
      setTimeout(() => {
        if (map && window.google?.maps) {
          console.log('🔄 Triggering map resize for iOS');
          window.google.maps.event.trigger(map, 'resize');
          map.setCenter(markerPosition);
          map.setZoom(15);
        }
      }, 500);
    }
  }, [isIOS, markerPosition]);

  const onUnmount = useCallback(() => {
    console.log('🗺️ Map unmounted');
    setMap(null);
    setMapLoaded(false);
  }, []);

  const getAddressFromLatLng = async (lat: number, lng: number) => {
    try {
      setIsLoadingAddress(true);
      console.log('📍 Getting address for coordinates:', { lat, lng });
      
      if (!window.google?.maps?.Geocoder) {
        throw new Error('Google Maps Geocoder not available');
      }
      
      const geocoder = new google.maps.Geocoder();
      const result = await geocoder.geocode({
        location: { lat, lng }
      });
      
      if (result?.results?.length > 0) {
        const addressResult = result.results[0];
        const isPlusCode = addressResult.formatted_address.includes('+');
        
        let finalAddress = addressResult.formatted_address;
        
        if (isPlusCode && result.results.length > 1) {
          const betterResult = result.results.find(r => !r.formatted_address.includes('+'));
          if (betterResult) {
            finalAddress = betterResult.formatted_address;
          }
        }
        
        console.log('✅ Address found:', finalAddress);
        return finalAddress;
      }
      
      console.log('⚠️ No address found for coordinates');
      return 'عنوان غير معروف';
    } catch (error) {
      console.error('❌ Error getting address:', error);
      return 'حدث خطأ في تحديد العنوان';
    } finally {
      setIsLoadingAddress(false);
    }
  };

  const handleMapClick = async (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      
      console.log('🎯 Map clicked at:', { lat, lng });
      setMarkerPosition({ lat, lng });
      
      const address = await getAddressFromLatLng(lat, lng);
      setFormData(prev => ({
        ...prev,
        address,
        coordinates: { lat, lng }
      }));
      
      // Clear coordinate errors
      if (errors.coordinates) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.coordinates;
          return newErrors;
        });
      }
    }
  };

  const handleMarkerDragEnd = async (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      
      console.log('🎯 Marker dragged to:', { lat, lng });
      setMarkerPosition({ lat, lng });
      
      const address = await getAddressFromLatLng(lat, lng);
      setFormData(prev => ({
        ...prev,
        address,
        coordinates: { lat, lng }
      }));
    }
  };

  const handlePlaceSelect = async (description: string) => {
    try {
      setIsLoadingAddress(true);
      console.log('🔍 Place selected:', description);
      clearSuggestions();
      setValue(description, false);
      
      const results = await getGeocode({ address: description });
      const { lat, lng } = getLatLng(results[0]);
      
      console.log('📍 Place coordinates:', { lat, lng });
      setMarkerPosition({ lat, lng });
      setFormData(prev => ({
        ...prev,
        address: description,
        coordinates: { lat, lng }
      }));
      
      if (map) {
        map.panTo({ lat, lng });
        map.setZoom(16);
      }
    } catch (error) {
      console.error('❌ Error selecting place:', error);
    } finally {
      setIsLoadingAddress(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    console.log('📍 Requesting current location...');
    setGettingLocation(true);

    try {
      // Check if running on native platform (iOS/Android)
      const isNative = Capacitor.isNativePlatform();

      if (isNative) {
        // Request permissions first on native platforms
        console.log('📱 Running on native platform, checking permissions...');
        const permissionStatus = await Geolocation.checkPermissions();
        console.log('Permission status:', permissionStatus.location);

        if (permissionStatus.location === 'denied') {
          setGettingLocation(false);
          return;
        }

        if (permissionStatus.location !== 'granted') {
          console.log('Requesting location permission...');
          const request = await Geolocation.requestPermissions();
          console.log('Permission request result:', request.location);

          if (request.location !== 'granted') {
            setGettingLocation(false);
            return;
          }
        }

        // Get current position using Capacitor
        console.log('Getting current position...');
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        });

        const pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };

        console.log('✅ Native location obtained:', pos);
        setMarkerPosition(pos);

        if (isLoaded && ready) {
          const address = await getAddressFromLatLng(pos.lat, pos.lng);
          setFormData(prev => ({
            ...prev,
            address,
            coordinates: pos
          }));
        }

        if (map) {
          map.panTo(pos);
          map.setZoom(16);
        }

        setGettingLocation(false);
      } else {
        // Running in web browser - use navigator.geolocation
        console.log('🌐 Running in web browser');

        if (!navigator.geolocation) {
          setGettingLocation(false);
          return;
        }

        const options = {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        };

        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const pos = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };

            console.log('✅ Web location obtained:', pos);
            setMarkerPosition(pos);

            if (isLoaded && ready) {
              const address = await getAddressFromLatLng(pos.lat, pos.lng);
              setFormData(prev => ({
                ...prev,
                address,
                coordinates: pos
              }));
            }

            if (map) {
              map.panTo(pos);
              map.setZoom(16);
            }

            setGettingLocation(false);
          },
          (error) => {
            setGettingLocation(false);
            console.error('❌ Geolocation error:', error);
          },
          options
        );
      }
    } catch (error: any) {
      console.error('❌ Error getting location:', error);
      setGettingLocation(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'الاسم مطلوب';
    if (!formData.phone.trim()) newErrors.phone = 'رقم الهاتف مطلوب';
    else if (!/^0\d{9}$/.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'رقم الهاتف يجب أن يبدأ بـ 0 ويتكون من 10 أرقام';
    }

    if (!formData.address.trim()) newErrors.address = 'العنوان التفصيلي مطلوب';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('📝 Form submitted with data:', formData);

    if (!validateForm()) {
      console.log('❌ Form validation failed:', errors);
      return;
    }

    // If this is the first address, make it default
    if (isFirstAddress && !formData.isDefault) {
      formData.isDefault = true;
    }

    try {
      setIsLoadingAddress(true);

      // Get service area ID from the selected city name
      let serviceAreaId: string | undefined;
      if (formData.city) {
        const { data: serviceArea } = await supabase
          .from('service_areas')
          .select('id')
          .eq('name', formData.city)
          .maybeSingle();

        serviceAreaId = serviceArea?.id;
        console.log('🌍 Service area ID for', formData.city, ':', serviceAreaId);
      }

      const addressData = {
        ...formData,
        coordinates: null,
        serviceAreaId,
        serviceAreaName: formData.city
      };

      let savedAddress: SavedAddress;

      if (initialAddress && initialAddress.id && !initialAddress.id.startsWith('temp_')) {
        console.log('📝 Updating existing address:', initialAddress.id);
        savedAddress = await updateAddress({
          ...addressData,
          id: initialAddress.id
        });
      } else {
        console.log('📝 Creating new address');
        savedAddress = await saveAddress(addressData);
      }

      console.log('✅ Address saved successfully:', savedAddress);
      onSave(savedAddress);
    } catch (error) {
      console.error('❌ Error saving address:', error);
      setErrors({
        submit: error instanceof Error ? error.message : 'حدث خطأ أثناء حفظ العنوان'
      });
    } finally {
      setIsLoadingAddress(false);
    }
  };

  // Initialize address from coordinates if available
  useEffect(() => {
    if (initialAddress?.coordinates && !formData.address && isLoaded && ready) {
      console.log('🔄 Loading address from initial coordinates');
      getAddressFromLatLng(initialAddress.coordinates.lat, initialAddress.coordinates.lng)
        .then(address => {
          setFormData(prev => ({
            ...prev,
            address
          }));
        });
    }
  }, [initialAddress, isLoaded, ready]);

  if (loadError) {
    console.error('❌ Google Maps load error:', loadError);
    return (
      <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col overflow-hidden modal-page-ios">
        <div className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-md mx-auto p-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">خطأ في تحميل الخريطة</h2>
            <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-[#b91c1c]/10 border border-[#b91c1c]/30 rounded-xl p-6 text-center max-w-md">
            <AlertCircle className="w-12 h-12 text-[#b91c1c] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[#b91c1c] mb-2">فشل في تحميل الخريطة</h3>
            <p className="text-[#b91c1c] mb-4">لا يمكن تحميل خرائط Google. يرجى التحقق من الاتصال بالإنترنت.</p>
            <button
              onClick={onCancel}
              className="bg-[#b91c1c] text-white px-6 py-2 rounded-lg hover:bg-[#b91c1c] transition-colors"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col overflow-hidden modal-page-ios">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10" style={{
        paddingTop: 'max(env(safe-area-inset-top), 0px)'
      }}>
        <div className="max-w-md mx-auto p-4 flex items-center justify-between">
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-gray-700"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="font-medium">رجوع</span>
          </button>
          <h2 className="text-xl font-bold text-gray-900">
            {initialAddress ? 'تعديل العنوان' : 'إضافة عنوان جديد'}
          </h2>
          <div className="w-[80px]"></div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto modal-scroll" style={{
        WebkitOverflowScrolling: 'touch',
        paddingBottom: 'calc(2rem + max(env(safe-area-inset-bottom), 34px))'
      }}>
        <div className="max-w-md mx-auto p-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-brand" />
                المعلومات الشخصية
              </h3>

              <div className="space-y-4">
                <div>
                  <label htmlFor="label" className="block text-sm font-medium text-gray-700 mb-1">
                    اسم العنوان (اختياري)
                  </label>
                  <input
                    type="text"
                    id="label"
                    name="label"
                    value={formData.label}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand border-gray-300"
                    placeholder="مثال: البيت، المدرسة، العمل"
                  />
                  <p className="text-xs text-gray-500 mt-1">اختر اسماً مميزاً للعنوان لسهولة التعرف عليه</p>
                </div>

                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    الاسم *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    disabled={true}
                    className={`w-full px-4 py-3 border rounded-lg bg-gray-100 cursor-not-allowed ${
                      errors.name ? 'border-[#b91c1c]' : 'border-gray-300'
                    }`}
                    placeholder="الاسم الكامل"
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-[#b91c1c]">{errors.name}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                    رقم الهاتف *
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="05xxxxxxxx"
                    disabled={true}
                    className={`w-full px-4 py-3 border rounded-lg bg-gray-100 cursor-not-allowed ${
                      errors.phone ? 'border-[#b91c1c]' : 'border-gray-300'
                    }`}
                    dir="ltr"
                  />
                  <p className="text-xs text-gray-500 mt-1">يتم استخدام رقم الهاتف المسجل في حسابك</p>
                  {errors.phone && (
                    <p className="mt-1 text-sm text-[#b91c1c]">{errors.phone}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Location Information */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-brand" />
                معلومات الموقع
              </h3>
              
              <div className="space-y-4">
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    منطقة التوصيل *
                  </label>
                  {preselectedCity ? (
                    <div className="w-full px-4 py-3 border-2 border-[#b91c1c] bg-[#b91c1c]/10 rounded-lg flex items-center justify-between">
                      <span className="text-gray-900 font-medium">{formData.city}</span>
                      <Check className="w-5 h-5 text-[#b91c1c]" />
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowServiceAreaPicker(!showServiceAreaPicker)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand bg-white hover:bg-gray-50 transition-colors flex items-center justify-between"
                      >
                        <span className="text-gray-900 font-medium">{formData.city}</span>
                        <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${showServiceAreaPicker ? 'rotate-90' : ''}`} />
                      </button>

                      {/* Service Area Dropdown */}
                      {showServiceAreaPicker && (
                        <>
                          {/* Backdrop */}
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => {
                              setShowServiceAreaPicker(false);
                              setSelectedMainArea(null);
                              setSubAreas([]);
                              setSearchQuery('');
                            }}
                          />

                          {/* Dropdown Menu */}
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-xl z-50 max-h-[400px] flex flex-col"
                          >
                            {/* Search Input */}
                            <div className="p-3 border-b border-gray-200">
                              <div className="relative">
                                <input
                                  type="text"
                                  value={searchQuery}
                                  onChange={(e) => setSearchQuery(e.target.value)}
                                  placeholder="ابحث عن منطقة..."
                                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                              </div>
                            </div>

                            {/* Areas List */}
                            <div className="flex-1 overflow-y-auto p-2">
                              {selectedMainArea && (
                                <button
                                  onClick={handleBackToMain}
                                  className="w-full mb-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2 text-gray-700 transition-colors"
                                >
                                  <ChevronRight className="w-4 h-4" />
                                  <span className="font-medium text-sm">رجوع للمناطق الرئيسية</span>
                                </button>
                              )}

                              <div className="space-y-1">
                                {(selectedMainArea ? subAreas : serviceAreas)
                                  .filter(area => area.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                  .map((area) => (
                                    <button
                                      key={area.id}
                                      onClick={() => {
                                        if (selectedMainArea) {
                                          setFormData(prev => ({ ...prev, city: area.name }));
                                          setShowServiceAreaPicker(false);
                                          setSelectedMainArea(null);
                                          setSubAreas([]);
                                          setSearchQuery('');
                                        } else {
                                          handleMainAreaClick(area);
                                        }
                                      }}
                                      className={`w-full p-3 rounded-lg transition-all text-right ${
                                        formData.city === area.name
                                          ? 'bg-brand/10 text-brand font-medium'
                                          : 'hover:bg-gray-50 text-gray-900'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium">{area.name}</span>
                                        {formData.city === area.name ? (
                                          <Check className="w-5 h-5 text-brand" />
                                        ) : !selectedMainArea && (
                                          <ChevronRight className="w-4 h-4 text-gray-400" />
                                        )}
                                      </div>
                                    </button>
                                  ))}

                                {/* No Results Message */}
                                {searchQuery && (selectedMainArea ? subAreas : serviceAreas)
                                  .filter(area => area.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                                  <div className="text-center py-6">
                                    <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                    <p className="text-gray-500 text-sm">لا توجد مناطق تطابق البحث</p>
                                    <button
                                      type="button"
                                      onClick={() => setSearchQuery('')}
                                      className="mt-2 text-brand hover:text-brand-light text-sm font-medium"
                                    >
                                      مسح البحث
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        </>
                      )}
                    </>
                  )}
                </div>

                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                    العنوان التفصيلي *
                  </label>
                  <textarea
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="أدخل العنوان التفصيلي (الشارع، رقم البناية، الحي...)"
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand resize-none ${
                      errors.address ? 'border-[#b91c1c]' : 'border-gray-300'
                    }`}
                    rows={4}
                  />
                  {errors.address && (
                    <p className="mt-1 text-sm text-[#b91c1c]">{errors.address}</p>
                  )}
                </div>

              </div>
            </div>


            {/* Additional Details */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Home className="w-5 h-5 text-brand" />
                تفاصيل إضافية
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="detailedAddress" className="block text-sm font-medium text-gray-700 mb-1">
                    العنوان التفصيلي (اختياري)
                  </label>
                  <textarea
                    id="detailedAddress"
                    name="detailedAddress"
                    value={formData.detailedAddress}
                    onChange={handleChange}
                    placeholder="أدخل تفاصيل إضافية للعنوان (رقم الشقة، الطابق، علامات مميزة...)"
                    className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand border-gray-300 resize-none"
                    rows={3}
                  />
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isDefault"
                    name="isDefault"
                    checked={formData.isDefault}
                    onChange={handleChange}
                    className="h-4 w-4 text-brand focus:ring-brand border-gray-300 rounded"
                  />
                  <label htmlFor="isDefault" className="mr-2 block text-sm text-gray-700">
                    تعيين كعنوان افتراضي
                  </label>
                </div>
              </div>
            </div>
            
            {errors.submit && (
              <div className="bg-[#b91c1c]/10 text-[#b91c1c] p-4 rounded-lg border border-[#b91c1c]/30">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p>{errors.submit}</p>
                </div>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 px-6 py-3 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                إلغاء
              </button>
              
              <button
                type="submit"
                disabled={isLoadingAddress}
                className="flex-1 px-6 py-3 bg-brand text-white rounded-lg hover:bg-brand-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoadingAddress ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    {initialAddress ? 'تحديث العنوان' : 'حفظ العنوان'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddressForm;