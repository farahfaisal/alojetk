import React, { useState, useCallback, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { MapPin, Search, Navigation, Loader2, Check, AlertCircle } from 'lucide-react';
import usePlacesAutocomplete, { getGeocode, getLatLng } from 'use-places-autocomplete';
import { motion } from 'framer-motion';

interface MapAddressSelectorProps {
  onSelectLocation?: (location: {
    lat: number;
    lng: number;
    address: string;
  }) => void;
  onAddressSelected?: (address: {
    address: string;
    city: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  }) => void;
  onClose?: () => void;
  title?: string;
  vendorLocation?: {
    lat: number;
    lng: number;
  };
  defaultCenter?: {
    lat: number;
    lng: number;
  };
  height?: string;
}

const containerStyle = {
  width: '100%',
  height: '100%',
  minHeight: '400px',
  position: 'relative' as const,
  touchAction: 'manipulation'
};

// Default center is Jenin, Palestine
const defaultMapCenter = { lat: 32.4594, lng: 35.2956 }; // Jenin coordinates

const MapAddressSelector: React.FC<MapAddressSelectorProps> = ({
  onSelectLocation,
  onAddressSelected,
  onClose,
  title = 'حدد الموقع',
  vendorLocation = defaultMapCenter,
  defaultCenter,
  height = '400px'
}) => {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [center, setCenter] = useState(defaultCenter || vendorLocation);
  const [markerPosition, setMarkerPosition] = useState(center);
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmButton, setShowConfirmButton] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Detect iOS
  useEffect(() => {
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);
  }, []);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ['places'],
    preventGoogleFontsLoading: true,
    language: 'ar',
    region: 'PS',
    onLoad: () => {
      console.log('📍 Google Maps API loaded successfully');
      setMapError(null);
    },
    onError: (error) => {
      console.error('❌ Google Maps API failed to load:', error);
      setMapError('فشل في تحميل خرائط Google. يرجى التحقق من الاتصال بالإنترنت.');
    }
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
      componentRestrictions: { country: 'ps' }, // Restrict to Palestine
      language: 'ar', // Arabic language
    },
    debounce: 300,
    cache: 86400,
  });

  // Initialize places autocomplete only when Google Maps is loaded
  useEffect(() => {
    if (isLoaded && ready) {
      console.log('🔍 Places autocomplete ready in MapAddressSelector');
    }
  }, [isLoaded, ready]);

  useEffect(() => {
    // Only get address when Google Maps API is fully loaded
    if (isLoaded && ready) {
      if (defaultCenter) {
        setCenter(defaultCenter);
        setMarkerPosition(defaultCenter);
        getAddressFromLatLng(defaultCenter.lat, defaultCenter.lng);
      } else {
        setCenter(vendorLocation);
        setMarkerPosition(vendorLocation);
        getAddressFromLatLng(vendorLocation.lat, vendorLocation.lng);
      }
    }
  }, [defaultCenter, vendorLocation, isLoaded, ready]);

  const onLoad = useCallback((map: google.maps.Map) => {
    console.log('🗺️ Map component loaded successfully');
    setMap(map);
    setMapLoaded(true);
    setMapError(null);
    
    // iOS specific fixes
    if (isIOS) {
      console.log('📱 Applying iOS-specific map settings');
      // Disable zoom on double tap to prevent conflicts
      map.setOptions({
        disableDoubleClickZoom: false,
        gestureHandling: 'greedy',
        zoomControl: true,
        scrollwheel: true,
        draggable: true,
        clickableIcons: false,
        keyboardShortcuts: false,
        fullscreenControl: false,
        streetViewControl: false,
        mapTypeControl: false
      });
      
      // Force a resize after a short delay to ensure proper rendering on iOS
      setTimeout(() => {
        if (map && window.google && window.google.maps) {
          window.google.maps.event.trigger(map, 'resize');
          map.setCenter(center);
        }
      }, 500);
    }
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
    setMapLoaded(false);
  }, []);

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setMarkerPosition({ lat, lng });
      getAddressFromLatLng(lat, lng);
      setShowConfirmButton(true);
    }
  };

  const handleMarkerDragEnd = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      console.log('📍 Marker dragged to:', { lat, lng });
      setMarkerPosition({ lat, lng });
      getAddressFromLatLng(lat, lng);
      setShowConfirmButton(true);
    }
  };

  const getAddressFromLatLng = async (lat: number, lng: number) => {
    try {
      setIsLoading(true);
      
      if (!window.google?.maps?.Geocoder) {
        console.error('Google Maps Geocoder not available');
        setAddress('خطأ في تحميل خرائط Google');
        setIsLoading(false);
        return;
      }
      
      try {
        const geocoder = new google.maps.Geocoder();
        const result = await geocoder.geocode({
          location: { lat, lng }
        });
        
        // Add proper error handling for geocoding results
        if (result && result.results && result.results.length > 0) {
          // Get the most detailed address possible
          const addressResult = result.results[0];
          
          // Check if we got a plus code (format like 8G4QG847+8J)
          const isPlusCode = addressResult.formatted_address.includes('+');
          
          // If it's a plus code and we have more results, try to find a better one
          if (isPlusCode && result.results.length > 1) {
            // Find the first result that isn't a plus code
            const betterResult = result.results.find(r => !r.formatted_address.includes('+'));
            if (betterResult) {
              setAddress(betterResult.formatted_address);
            } else {
              // If all results are plus codes, use the first one but add a descriptive note
              setAddress(`${addressResult.formatted_address} (بالقرب من هذا الموقع)`);
            }
          } else {
            setAddress(addressResult.formatted_address);
          }
        } else {
          setAddress('عنوان غير معروف');
          console.warn('No geocoding results found for the given coordinates');
        }
      } catch (geocodeError) {
        console.error('Geocoding error:', geocodeError);
        setAddress('حدث خطأ في تحديد العنوان');
      }
    } catch (error) {
      console.error('Error getting address:', error);
      setAddress('حدث خطأ في الحصول على العنوان');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlaceSelect = async (description: string) => {
    try {
      setIsLoading(true);
      clearSuggestions();
      setValue(description, false);
      
      const results = await getGeocode({ address: description });
      const { lat, lng } = getLatLng(results[0]);
      
      setCenter({ lat, lng });
      setMarkerPosition({ lat, lng });
      setAddress(description);
      setShowConfirmButton(true);
      
      if (map) {
        map.panTo({ lat, lng });
        map.setZoom(16);
      }
    } catch (error) {
      console.error('Error selecting place:', error);
      setAddress('حدث خطأ في تحديد الموقع');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmLocation = () => {
    if (!markerPosition || !address) {
      setLocationError('يرجى تحديد موقع صحيح أولاً');
      return;
    }

    // Support both callback formats
    if (onSelectLocation) {
      onSelectLocation({
        lat: markerPosition.lat,
        lng: markerPosition.lng,
        address
      });
    }

    if (onAddressSelected) {
      onAddressSelected({
        address: address,
        city: address.split(',')[0] || address,
        coordinates: {
          lat: markerPosition.lat,
          lng: markerPosition.lng
        }
      });
    }

    // Clear any previous errors
    setLocationError(null);
  };

  const handleUseCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setLocationError('متصفحك لا يدعم تحديد الموقع');
      return;
    }
    
    setGettingLocation(true);
    setLocationError(null);
    
    // Check if we're on iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                       (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    const options = {
      enableHighAccuracy: true,
      timeout: isIOSDevice ? 20000 : 15000, // Longer timeout for iOS
      maximumAge: 60000 // Allow cached location for better reliability
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
          (position) => {
            const pos = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            
            console.log('✅ iOS location obtained:', pos);
            setCenter(pos);
            setMarkerPosition(pos);
            
            if (isLoaded && ready) {
              getAddressFromLatLng(pos.lat, pos.lng);
            }
            
            if (map) {
              map.panTo(pos);
              map.setZoom(16);
            }
            setShowConfirmButton(true);
            setGettingLocation(false);
          },
          (error) => {
            setGettingLocation(false);
            console.error('❌ iOS Geolocation error:', error);
            
            let errorMessage = 'فشل في الحصول على موقعك الحالي';
            if (error.code === 1) {
              errorMessage = 'تم رفض الوصول للموقع. يرجى السماح بالوصول للموقع في إعدادات Safari.';
            } else if (error.code === 2) {
              errorMessage = 'موقعك غير متاح حالياً. يرجى التأكد من تفعيل خدمات الموقع في إعدادات iOS.';
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
      (position) => {
        console.log('📍 Location obtained:', position.coords);
        const pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setCenter(pos);
        setMarkerPosition(pos);
        
        if (isLoaded && ready) {
          getAddressFromLatLng(pos.lat, pos.lng);
        }
        
        if (map) {
          map.panTo(pos);
          map.setZoom(16);
        }
        setShowConfirmButton(true);
        setGettingLocation(false);
      },
      (error) => {
        setGettingLocation(false);
        console.error('Geolocation error:', error);
        
        let errorMessage = 'فشل في الحصول على موقعك الحالي';
        if (error.code === 1) {
          errorMessage = 'تم رفض الوصول للموقع. يرجى السماح بالوصول للموقع في إعدادات المتصفح.';
        } else if (error.code === 2) {
          errorMessage = 'موقعك غير متاح حالياً. يرجى المحاولة مرة أخرى.';
        } else if (error.code === 3) {
          errorMessage = 'انتهت مهلة تحديد الموقع. يرجى المحاولة مرة أخرى.';
        }
        
        setLocationError(errorMessage);
      },
      options
    );
  };

  if (!isLoaded) {
    return (
      <div style={{ height: height }} className="flex flex-col items-center justify-center bg-gray-100 rounded-lg">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-brand animate-spin mb-4 mx-auto" />
          <p className="text-gray-600">جاري تحميل الخريطة...</p>
          {retryCount > 0 && (
            <p className="text-sm text-gray-500 mt-2">
              محاولة {retryCount + 1}/3
            </p>
          )}
        </div>
      </div>
    );
  }

  // Show error state with retry option
  if (mapError) {
    return (
      <div style={{ height: height }} className="flex flex-col items-center justify-center bg-red-50 rounded-lg border border-red-200 p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4 mx-auto" />
          <h3 className="text-lg font-semibold text-red-700 mb-2">خطأ في تحميل الخريطة</h3>
          <p className="text-red-600 mb-4">{mapError}</p>
          {retryCount < 2 && (
            <button
              onClick={() => {
                setRetryCount(prev => prev + 1);
                setMapError(null);
                window.location.reload();
              }}
              className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
            >
              إعادة المحاولة
            </button>
          )}
          {retryCount >= 2 && (
            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 mt-4">
              <p className="text-yellow-700 text-sm">
                يمكنك كتابة العنوان يدوياً أو المحاولة لاحقاً
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Full screen modal version
  if (onClose) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 z-[10000] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-brand to-red-600 text-white px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <MapPin className="w-6 h-6" />
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
            {/* Search Box */}
            <div className="relative">
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={!ready}
                placeholder="ابحث عن عنوان أو اكتب العنوان يدوياً..."
                className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />

              {/* Suggestions Dropdown */}
              {status === 'OK' && (
                <ul className="absolute z-40 w-full bg-white mt-1 border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {data.map(({ place_id, description }) => (
                    <li
                      key={place_id}
                      onClick={() => handlePlaceSelect(description)}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-right"
                    >
                      {description}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Manual Address Input */}
            <div className="relative">
              <input
                type="text"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setShowConfirmButton(true);
                }}
                placeholder="أو اكتب العنوان يدوياً هنا..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>

            {/* Current Location Button */}
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={gettingLocation}
              className="w-full py-3 rounded-lg flex items-center justify-center gap-2 bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
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

            {/* Map Container */}
            <div className="flex-1 rounded-xl overflow-hidden border-2 border-gray-300 relative">
              {!isLoaded ? (
                <div className="flex items-center justify-center h-full bg-gray-100">
                  <Loader2 className="w-8 h-8 animate-spin text-brand" />
                </div>
              ) : mapError ? (
                <div className="flex flex-col items-center justify-center h-full bg-red-50 p-4">
                  <AlertCircle className="w-12 h-12 text-red-500 mb-2" />
                  <p className="text-red-700 text-center">{mapError}</p>
                </div>
              ) : (
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '100%' }}
                  center={center}
                  zoom={15}
                  onLoad={onLoad}
                  onClick={handleMapClick}
                  options={{
                    zoomControl: true,
                    streetViewControl: false,
                    mapTypeControl: false,
                    fullscreenControl: false,
                  }}
                >
                  {markerPosition && (
                    <Marker
                      position={markerPosition}
                      draggable={true}
                      onDragEnd={handleMarkerDragEnd}
                    />
                  )}
                </GoogleMap>
              )}
            </div>

            {/* Error Message */}
            {locationError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm flex items-center gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {locationError}
              </div>
            )}

            {/* Selected Address Display */}
            {address && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-900">
                  <MapPin className="w-4 h-4 inline ml-1" />
                  <strong>العنوان المحدد:</strong> {address}
                </p>
              </div>
            )}

            {/* Confirm Button */}
            <button
              type="button"
              onClick={handleConfirmLocation}
              disabled={!markerPosition || !address}
              className="w-full py-4 rounded-lg flex items-center justify-center gap-2 bg-gradient-to-r from-brand to-red-600 text-white font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-all"
            >
              <Check className="w-6 h-6" />
              تأكيد الموقع
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4" style={{ height: height === '100%' ? '100%' : 'auto' }}>
      {/* Search Box */}
      <div className={`relative ${height === '100%' ? 'absolute top-16 left-4 right-4 z-30 bg-white rounded-lg shadow-lg p-2' : ''}`}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={!ready}
          placeholder="ابحث عن عنوان..."
          className={`w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand ${height === '100%' ? 'text-sm' : ''}`}
        />
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        
        {/* Suggestions Dropdown */}
        {status === 'OK' && (
          <ul className="absolute z-40 w-full bg-white mt-1 border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {data.map(({ place_id, description }) => (
              <li
                key={place_id}
                onClick={() => handlePlaceSelect(description)}
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
              >
                {description}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Current Location Button */}
      {height !== '100%' && (
        <button 
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={gettingLocation}
          className="w-full py-2 rounded-lg flex items-center justify-center gap-2 bg-brand text-white hover:bg-brand-light transition-colors disabled:opacity-50 shadow-lg"
        >
          {gettingLocation ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Navigation className="w-5 h-5" />
          )}
          استخدم موقعي الحالي
        </button>
      )}
      
      {/* Confirm Current Location Button - Only for non-fullscreen */}
      {height !== '100%' && (
        <button 
          type="button"
          onClick={handleConfirmLocation}
          disabled={isLoading || !address || gettingLocation}
          className="w-full py-3 rounded-lg flex items-center justify-center gap-2 bg-green-500 text-white hover:bg-green-600 transition-colors disabled:opacity-50 mt-2 shadow-md font-medium"
        >
          {isLoading || gettingLocation ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Check className="w-5 h-5" />
          )}
          {address ? 'تأكيد هذا الموقع' : 'تأكيد الموقع'}
        </button>
      )}

      {/* Selected Address Display */}
      <div className={`bg-gray-50 p-4 rounded-lg ${height === '100%' ? 'hidden' : ''}`}>
        <div className="flex items-start gap-2">
          <MapPin className="w-5 h-5 text-brand mt-1 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-gray-900 mb-1">العنوان المحدد</h3>
            <p className="text-gray-600 text-sm">{isLoading ? 'جاري تحميل العنوان...' : address}</p>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div 
        className={`${height === '100%' ? 'absolute inset-0' : 'rounded-lg overflow-hidden shadow-md mt-2 relative'}`}
        style={{ 
          height: height === '100%' ? '100%' : '400px', 
          width: '100%', 
          minHeight: height === '100%' ? '100%' : '400px',
          position: height === '100%' ? 'absolute' : 'relative',
          top: height === '100%' ? '0' : 'auto',
          left: height === '100%' ? '0' : 'auto',
          right: height === '100%' ? '0' : 'auto',
          bottom: height === '100%' ? '0' : 'auto',
          zIndex: 1
        }}
      >
        <GoogleMap
          id="google-map-checkout"
          mapContainerStyle={{
            width: '100%',
            height: height === '100%' ? '100%' : '400px',
            minHeight: height === '100%' ? '100%' : '400px',
            position: height === '100%' ? 'absolute' : 'relative',
            top: height === '100%' ? '0' : 'auto',
            left: height === '100%' ? '0' : 'auto',
            right: height === '100%' ? '0' : 'auto',
            bottom: height === '100%' ? '0' : 'auto',
            touchAction: isIOS ? 'manipulation' : 'auto',
            zIndex: 1
          }}
          center={center}
          zoom={15}
          onLoad={onLoad}
          onUnmount={onUnmount}
          onClick={handleMapClick}
          onError={(error) => {
            console.error('❌ Google Map component error:', error);
            setMapError('حدث خطأ في عرض الخريطة');
          }}
          options={{
            fullscreenControl: false,
            streetViewControl: false,
            mapTypeControl: false,
            zoomControl: height === '100%',
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
            panControl: height === '100%',
            overviewMapControl: false,
            styles: isIOS ? [
              {
                featureType: 'all',
                elementType: 'all',
                stylers: [
                  { saturation: 0 },
                  { gamma: 1.0 }
                ]
              }
            ] : undefined
          }}
        >
          {/* Loading overlay */}
          {!mapLoaded && (
            <div className="absolute inset-0 bg-white/90 flex items-center justify-center z-50">
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-brand animate-spin mb-4 mx-auto" />
                <p className="text-gray-700 font-medium">جاري تحميل الخريطة...</p>
                <p className="text-gray-500 text-sm mt-2">يرجى الانتظار قليلاً</p>
              </div>
            </div>
          )}

          {/* Location Error Message */}
          {locationError && (
            <div className={`absolute ${height === '100%' ? 'top-20 left-4 right-4' : 'top-4 left-4 right-4'} z-50 bg-red-50 border border-red-200 rounded-lg p-3 shadow-lg`}>
              <p className="text-red-600 text-sm">{locationError}</p>
            </div>
          )}

          {/* Current Location Button */}
          <div className={`absolute ${height === '100%' ? 'top-4 right-4' : 'top-4 right-4'} z-40`}>
            <button 
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={gettingLocation}
              className={`bg-brand text-white p-3 rounded-full shadow-xl flex items-center justify-center transition-colors ${
                isIOS ? 'active:bg-brand-light' : 'hover:bg-brand-light'
              } disabled:opacity-50`}
              title="استخدم موقعي الحالي"
            >
              {gettingLocation ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Navigation className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Marker for selected location */}
          {mapLoaded && (
            <Marker
              position={markerPosition}
              draggable={true}
              animation={mapLoaded && window.google?.maps?.Animation ? window.google.maps.Animation.DROP : undefined}
              onDragEnd={(e) => {
                if (e.latLng) {
                  const lat = e.latLng.lat();
                  const lng = e.latLng.lng();
                  console.log('📍 Marker dragged to:', { lat, lng });
                  setMarkerPosition({ lat, lng });
                  getAddressFromLatLng(lat, lng);
                  setShowConfirmButton(true);
                }
              }}
              title="اسحب لتحديد الموقع"
              icon={{
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                  <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="20" cy="20" r="12" fill="#FFD700" stroke="#024959" stroke-width="3"/>
                    <circle cx="20" cy="20" r="5" fill="#024959"/>
                  </svg>
                `),
                scaledSize: new window.google.maps.Size(40, 40),
                anchor: new window.google.maps.Point(20, 20)
              }}
            />
          )}
          
          {/* Marker for vendor location */}
          {mapLoaded && vendorLocation && vendorLocation.lat && vendorLocation.lng && (
            <Marker
              position={vendorLocation}
              icon={{
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                  <svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="18" cy="18" r="10" fill="#024959" stroke="#FFD700" stroke-width="3"/>
                    <circle cx="18" cy="18" r="4" fill="#FFD700"/>
                  </svg>
                `),
                scaledSize: new window.google.maps.Size(36, 36),
                anchor: new window.google.maps.Point(18, 18)
              }}
              title="موقع المتجر"
            />
          )}
        </GoogleMap>
      </div>

      {/* Confirm Button - Only shown when a location is selected */}
      {showConfirmButton && height !== '100%' && (
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          type="button"
          onClick={handleConfirmLocation}
          disabled={isLoading || !address || gettingLocation}
          className="w-full bg-green-500 text-white py-3 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-md font-medium"
        >
          {isLoading || gettingLocation ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Check className="w-5 h-5" />
          )}
          تأكيد هذا الموقع
        </motion.button>
      )}
      
      {/* Floating Confirm Button for embedded map */}
      {showConfirmButton && height === '100%' && (
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed bottom-8 left-1/2 transform -translate-x-1/2 px-8 py-4 bg-green-500 text-white font-bold rounded-xl shadow-2xl z-[100] flex items-center gap-3 min-w-[250px] justify-center hover:bg-green-600 transition-all active:scale-95"
          style={{
            bottom: `calc(2rem + max(env(safe-area-inset-bottom), 0px))`,
            fontSize: '18px'
          }}
          onClick={handleConfirmLocation}
          disabled={isLoading || !address || gettingLocation}
        >
          <Check className="w-6 h-6" />
          {isLoading || gettingLocation ? 'جاري التحميل...' : 'تأكيد هذا الموقع'}
        </motion.button>
      )}
      
      {/* Floating Current Location Button */}
      {height === '100%' && (
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`fixed right-4 p-4 bg-brand text-white rounded-full shadow-2xl z-[100] flex items-center justify-center ${
            isIOS ? 'active:bg-brand-light' : 'hover:bg-brand-light'
          } transition-all active:scale-95`}
          style={{
            top: `calc(1rem + max(env(safe-area-inset-top), 0px))`
          }}
          onClick={handleUseCurrentLocation}
          disabled={gettingLocation}
          title="استخدم موقعي الحالي"
        >
          {gettingLocation ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <Navigation className="w-6 h-6" />
          )}
        </motion.button>
      )}
      
      {/* Address Display for Fullscreen */}
      {height === '100%' && address && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-32 left-4 right-4 bg-white/95 backdrop-blur-md rounded-xl p-4 shadow-xl z-[90] border border-gray-200"
          style={{
            bottom: `calc(8rem + max(env(safe-area-inset-bottom), 0px))`
          }}
        >
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-brand mt-1 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-medium text-gray-900 mb-1">العنوان المحدد</h3>
              <p className="text-gray-700 text-sm leading-relaxed">
                {isLoading ? 'جاري تحميل العنوان...' : address}
              </p>
            </div>
          </div>
        </motion.div>
      )}
      
      {/* Location Status Indicator */}
      {(gettingLocation || locationError) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`fixed left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-xl shadow-2xl z-[110] ${
            gettingLocation 
              ? 'bg-blue-500 text-white' 
              : 'bg-red-500 text-white'
          } font-medium`}
          style={{
            bottom: height === '100%' 
              ? `calc(16rem + max(env(safe-area-inset-bottom), 0px))`
              : `calc(8rem + max(env(safe-area-inset-bottom), 0px))`
          }}
        >
          {gettingLocation ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>جاري تحديد موقعك...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>فشل تحديد الموقع</span>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default MapAddressSelector;