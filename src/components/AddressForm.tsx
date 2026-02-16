import React, { useState, useCallback, useEffect } from 'react';
import { MapPin, Navigation, X, Loader2, Check, AlertCircle, User, Phone, Home, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { SavedAddress, saveAddress, updateAddress, getSavedAddresses } from '../lib/storage';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import usePlacesAutocomplete, { getGeocode, getLatLng } from 'use-places-autocomplete';
import { getMainServiceAreas, getSubServiceAreas, ServiceArea } from '../lib/zones';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface AddressFormProps {
  onSave: (address: SavedAddress) => void;
  onCancel: () => void;
  initialAddress?: SavedAddress;
  isModal?: boolean;
  vendorLocation?: {
    lat: number;
    lng: number;
  };
}

const defaultMapCenter = { lat: 32.4594, lng: 35.2956 }; // Jenin coordinates

const mapContainerStyle = {
  width: '100%',
  height: '300px',
  borderRadius: '12px',
  overflow: 'hidden'
};

const AddressForm: React.FC<AddressFormProps> = ({
  onSave,
  onCancel,
  initialAddress,
  isModal = false,
  vendorLocation = defaultMapCenter
}) => {
  const { user } = useAuth();

  // Get selected service area from localStorage
  const getDefaultCity = () => {
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
    coordinates: initialAddress?.coordinates || null
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
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showServiceAreaPicker, setShowServiceAreaPicker] = useState(false);
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [selectedMainArea, setSelectedMainArea] = useState<ServiceArea | null>(null);
  const [subAreas, setSubAreas] = useState<ServiceArea[]>([]);

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

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('متصفحك لا يدعم تحديد الموقع');
      return;
    }
    
    console.log('📍 Requesting current location...');
    setGettingLocation(true);
    setLocationError(null);
    
    // Check if we're on iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                       (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    const options = {
      enableHighAccuracy: true,
      timeout: isIOSDevice ? 20000 : 15000, // Longer timeout for iOS
      maximumAge: isIOSDevice ? 0 : 60000 // Fresh location for iOS
    };
    
    // For iOS, show a user-friendly prompt
    if (isIOSDevice) {
      // Create a permission prompt overlay
      const promptOverlay = document.createElement('div');
      promptOverlay.style.position = 'fixed';
      promptOverlay.style.top = '0';
      promptOverlay.style.left = '0';
      promptOverlay.style.right = '0';
      promptOverlay.style.bottom = '0';
      promptOverlay.style.backgroundColor = 'rgba(0,0,0,0.7)';
      promptOverlay.style.zIndex = '99999';
      promptOverlay.style.display = 'flex';
      promptOverlay.style.alignItems = 'center';
      promptOverlay.style.justifyContent = 'center';
      promptOverlay.style.padding = '20px';
      
      const promptCard = document.createElement('div');
      promptCard.style.backgroundColor = 'white';
      promptCard.style.borderRadius = '12px';
      promptCard.style.padding = '24px';
      promptCard.style.maxWidth = '320px';
      promptCard.style.textAlign = 'center';
      promptCard.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
      
      promptCard.innerHTML = `
        <div style="margin-bottom: 16px;">
          <div style="width: 60px; height: 60px; background: #FFD700; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#024959" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
          <h3 style="color: #024959; font-size: 18px; font-weight: bold; margin-bottom: 8px;">تحديد موقعك</h3>
          <p style="color: #666; font-size: 14px; line-height: 1.4;">نحتاج إلى موقعك لتحديد عنوان التوصيل بدقة</p>
        </div>
        <button id="allow-location" style="
          width: 100%; 
          background: #FFD700; 
          color: #024959; 
          border: none; 
          padding: 12px; 
          border-radius: 8px; 
          font-size: 16px; 
          font-weight: bold; 
          cursor: pointer;
          margin-bottom: 8px;
        ">السماح بالوصول للموقع</button>
        <button id="cancel-location" style="
          width: 100%; 
          background: transparent; 
          color: #666; 
          border: 1px solid #ddd; 
          padding: 12px; 
          border-radius: 8px; 
          font-size: 14px; 
          cursor: pointer;
        ">إلغاء</button>
      `;
      
      promptOverlay.appendChild(promptCard);
      document.body.appendChild(promptOverlay);
      
      const allowButton = promptCard.querySelector('#allow-location');
      const cancelButton = promptCard.querySelector('#cancel-location');
      
      allowButton?.addEventListener('click', () => {
        document.body.removeChild(promptOverlay);
        
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const pos = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            
            console.log('✅ iOS location obtained:', pos);
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
            console.error('❌ iOS Geolocation error:', error);
            
            let errorMessage = 'فشل في الحصول على موقعك الحالي';
            if (error.code === 1) {
              errorMessage = 'تم رفض الوصول للموقع. يرجى السماح بالوصول للموقع في إعدادات Safari.';
            } else if (error.code === 2) {
              errorMessage = 'موقعك غير متاح حالياً. يرجى التأكد من تفعيل خدمات الموقع.';
            } else if (error.code === 3) {
              errorMessage = 'انتهت مهلة تحديد الموقع. يرجى المحاولة مرة أخرى.';
            }
            
            setLocationError(errorMessage);
            setTimeout(() => setLocationError(null), 5000);
          },
          options
        );
      });
      
      cancelButton?.addEventListener('click', () => {
        document.body.removeChild(promptOverlay);
        setGettingLocation(false);
        setLocationError('تم إلغاء طلب الموقع');
        setTimeout(() => setLocationError(null), 3000);
      });
      
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        
        console.log('✅ Current location obtained:', pos);
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
        
        let errorMessage = 'فشل في الحصول على موقعك الحالي';
        if (error.code === 1) {
          errorMessage = isIOSDevice 
            ? 'تم رفض الوصول للموقع. يرجى السماح بالوصول للموقع في إعدادات Safari.'
            : 'تم رفض الوصول للموقع. يرجى السماح بالوصول للموقع في إعدادات المتصفح.';
        } else if (error.code === 2) {
          errorMessage = isIOSDevice
            ? 'موقعك غير متاح حالياً. يرجى التأكد من تفعيل خدمات الموقع في إعدادات iOS.'
            : 'موقعك غير متاح حالياً. يرجى المحاولة مرة أخرى.';
        } else if (error.code === 3) {
          errorMessage = 'انتهت مهلة تحديد الموقع. يرجى المحاولة مرة أخرى.';
        }
        
        setLocationError(errorMessage);
        setTimeout(() => setLocationError(null), 5000);
      },
      options
    );
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
    
    if (!formData.address.trim()) newErrors.address = 'العنوان مطلوب';
    if (!formData.coordinates) newErrors.coordinates = 'يرجى تحديد الموقع على الخريطة';
    
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
      const addressData = {
        ...formData,
        coordinates: formData.coordinates
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
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center max-w-md">
            <AlertCircle className="w-12 h-12 text-red-700 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-700 mb-2">فشل في تحميل الخريطة</h3>
            <p className="text-red-800 mb-4">لا يمكن تحميل خرائط Google. يرجى التحقق من الاتصال بالإنترنت.</p>
            <button
              onClick={onCancel}
              className="bg-red-700 text-white px-6 py-2 rounded-lg hover:bg-red-800 transition-colors"
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
                      errors.name ? 'border-red-700' : 'border-gray-300'
                    }`}
                    placeholder="الاسم الكامل"
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-800">{errors.name}</p>
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
                      errors.phone ? 'border-red-700' : 'border-gray-300'
                    }`}
                    dir="ltr"
                  />
                  <p className="text-xs text-gray-500 mt-1">يتم استخدام رقم الهاتف المسجل في حسابك</p>
                  {errors.phone && (
                    <p className="mt-1 text-sm text-red-800">{errors.phone}</p>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    منطقة التوصيل *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowServiceAreaPicker(true)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand bg-white hover:bg-gray-50 transition-colors flex items-center justify-between"
                  >
                    <span className="text-gray-900 font-medium">{formData.city}</span>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                {/* Service Area Picker Modal */}
                {showServiceAreaPicker && (
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[70vh] flex flex-col"
                    >
                      <div className="p-4 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-bold text-gray-900">
                            {selectedMainArea ? `اختر منطقة في ${selectedMainArea.name}` : 'اختر منطقة التوصيل'}
                          </h3>
                          <button
                            onClick={() => {
                              setShowServiceAreaPicker(false);
                              setSelectedMainArea(null);
                              setSubAreas([]);
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto p-4">
                        {selectedMainArea && (
                          <button
                            onClick={handleBackToMain}
                            className="mb-3 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2 text-gray-700 transition-colors"
                          >
                            <ChevronRight className="w-4 h-4" />
                            <span className="font-medium text-sm">رجوع للمناطق الرئيسية</span>
                          </button>
                        )}

                        <div className="space-y-2">
                          {(selectedMainArea ? subAreas : serviceAreas).map((area) => (
                            <button
                              key={area.id}
                              onClick={() => {
                                if (selectedMainArea) {
                                  setFormData(prev => ({ ...prev, city: area.name }));
                                  setShowServiceAreaPicker(false);
                                  setSelectedMainArea(null);
                                  setSubAreas([]);
                                } else {
                                  handleMainAreaClick(area);
                                }
                              }}
                              className={`w-full p-4 rounded-lg border-2 transition-all text-right ${
                                formData.city === area.name
                                  ? 'bg-brand/10 border-brand'
                                  : 'bg-white border-gray-200 hover:border-brand/50'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-gray-900">{area.name}</span>
                                {formData.city === area.name && (
                                  <Check className="w-5 h-5 text-brand" />
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  </div>
                )}

                {/* Search Box */}
                {isLoaded && ready && (
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      البحث عن عنوان
                    </label>
                    <input
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      disabled={!ready}
                      placeholder="ابحث عن عنوان..."
                      className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                    <MapPin className="absolute left-3 top-10 text-gray-400 w-5 h-5" />
                    
                    {/* Search Suggestions */}
                    {status === 'OK' && (
                      <div className="absolute z-50 w-full bg-white mt-1 border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {data.map(({ place_id, description }) => (
                          <button
                            key={place_id}
                            type="button"
                            onClick={() => handlePlaceSelect(description)}
                            className="w-full text-right px-4 py-2 hover:bg-gray-100 transition-colors"
                          >
                            {description}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Current Location Button */}
                <button 
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={gettingLocation}
                  className="w-full py-3 bg-brand text-white rounded-lg hover:bg-brand-light transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {gettingLocation ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      جاري تحديد موقعك...
                    </>
                  ) : (
                    <>
                      <Navigation className="w-5 h-5" />
                      استخدم موقعي الحالي
                    </>
                  )}
                </button>

                {/* Location Error */}
                {locationError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-red-700 flex-shrink-0" />
                      <p className="text-red-800 text-sm">{locationError}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Map Section */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-brand" />
                حدد موقعك على الخريطة
              </h3>
              
              <div className="space-y-4">
                {/* Map Container */}
                <div className="relative">
                  {!isLoaded ? (
                    <div className="w-full h-[300px] bg-gray-100 rounded-xl flex items-center justify-center">
                      <div className="text-center">
                        <Loader2 className="w-10 h-10 text-brand animate-spin mb-4 mx-auto" />
                        <p className="text-gray-600">جاري تحميل الخريطة...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="relative w-full h-[300px] rounded-xl overflow-hidden border border-gray-200 shadow-sm map-container-embedded">
                      <GoogleMap
                        mapContainerStyle={mapContainerStyle}
                        center={markerPosition}
                        zoom={15}
                        onLoad={onLoad}
                        onUnmount={onUnmount}
                        onClick={handleMapClick}
                        options={{
                          fullscreenControl: false,
                          streetViewControl: false,
                          mapTypeControl: false,
                          zoomControl: true,
                          scrollwheel: true,
                          gestureHandling: isIOS ? 'greedy' : 'auto',
                          language: 'ar',
                          disableDefaultUI: false,
                          clickableIcons: false,
                          disableDoubleClickZoom: false,
                          draggable: true,
                          keyboardShortcuts: false,
                          scaleControl: false,
                          rotateControl: false,
                          panControl: false,
                          styles: [
                            {
                              featureType: 'poi',
                              elementType: 'labels',
                              stylers: [{ visibility: 'off' }]
                            }
                          ]
                        }}
                      >
                        {/* Loading overlay */}
                        {!mapLoaded && (
                          <div className="absolute inset-0 bg-white/90 flex items-center justify-center z-50 rounded-xl">
                            <div className="text-center">
                              <Loader2 className="w-8 h-8 text-brand animate-spin mb-2 mx-auto" />
                              <p className="text-gray-600 text-sm">جاري تحميل الخريطة...</p>
                            </div>
                          </div>
                        )}

                        {/* User Location Marker */}
                        {mapLoaded && markerPosition && (
                          <Marker
                            position={markerPosition}
                            draggable={true}
                            onDragEnd={handleMarkerDragEnd}
                            title="موقعك - اسحب لتحديد موقع دقيق"
                            icon={{
                              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                                <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                                  <circle cx="20" cy="20" r="15" fill="#FFD700" stroke="#024959" stroke-width="3"/>
                                  <circle cx="20" cy="20" r="6" fill="#024959"/>
                                </svg>
                              `),
                              scaledSize: new window.google.maps.Size(40, 40),
                              anchor: new window.google.maps.Point(20, 20)
                            }}
                          />
                        )}
                        
                        {/* Vendor Location Marker */}
                        {mapLoaded && vendorLocation && vendorLocation.lat && vendorLocation.lng && (
                          <Marker
                            position={vendorLocation}
                            title="موقع المتجر"
                            icon={{
                              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                                <svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
                                  <circle cx="18" cy="18" r="12" fill="#024959" stroke="#FFD700" stroke-width="3"/>
                                  <circle cx="18" cy="18" r="5" fill="#FFD700"/>
                                </svg>
                              `),
                              scaledSize: new window.google.maps.Size(36, 36),
                              anchor: new window.google.maps.Point(18, 18)
                            }}
                          />
                        )}
                      </GoogleMap>
                      
                      {/* Map Instructions Overlay */}
                      <div className="absolute top-2 left-2 right-2 bg-white/95 backdrop-blur-sm rounded-lg p-3 shadow-sm border border-gray-200">
                        <p className="text-sm text-gray-700 text-center">
                          انقر على الخريطة أو اسحب العلامة لتحديد موقعك الدقيق
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Selected Address Display */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-brand mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 mb-1">العنوان المحدد</h4>
                      <p className="text-gray-700 text-sm leading-relaxed">
                        {isLoadingAddress ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            جاري تحميل العنوان...
                          </span>
                        ) : formData.address || 'لم يتم تحديد عنوان بعد'}
                      </p>
                      {formData.coordinates && (
                        <p className="text-xs text-gray-500 mt-1">
                          الإحداثيات: {formData.coordinates.lat.toFixed(6)}, {formData.coordinates.lng.toFixed(6)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {errors.coordinates && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-red-700 flex-shrink-0" />
                      <p className="text-red-800 text-sm">{errors.coordinates}</p>
                    </div>
                  </div>
                )}
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
              <div className="bg-red-50 text-red-800 p-4 rounded-lg border border-red-200">
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