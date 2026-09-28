import React, { useState, useEffect, useCallback } from 'react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { supabase } from '../lib/supabase';
import { MapPin, Save, AlertCircle, CheckCircle2, Search, X, Navigation } from 'lucide-react';

interface Vendor {
  id: string;
  store_name: string;
  address: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  logo_url?: string;
}

interface MarkerPosition {
  lat: number;
  lng: number;
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const containerStyle = {
  width: '100%',
  height: '500px',
  borderRadius: '12px'
};

const defaultCenter = {
  lat: 31.5000,
  lng: 34.4500
};

export default function VendorLocationManager() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [markerPosition, setMarkerPosition] = useState<MarkerPosition | null>(null);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showWithoutLocation, setShowWithoutLocation] = useState(false);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY
  });

  const loadVendors = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('vendors')
        .select('id, store_name, address, city, latitude, longitude, logo_url')
        .order('store_name');

      if (showWithoutLocation) {
        query = query.or('latitude.is.null,longitude.is.null');
      }

      const { data, error } = await query;

      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error('Error loading vendors:', error);
      setMessage({ type: 'error', text: 'فشل تحميل المتاجر' });
    } finally {
      setLoading(false);
    }
  }, [showWithoutLocation]);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  const handleVendorSelect = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setSearchQuery('');

    if (vendor.latitude && vendor.longitude) {
      const position = { lat: vendor.latitude, lng: vendor.longitude };
      setMarkerPosition(position);
      setMapCenter(position);
    } else {
      setMarkerPosition(null);
      setMapCenter(defaultCenter);
    }

    setMessage(null);
  };

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng && selectedVendor) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setMarkerPosition({ lat, lng });
      setMessage(null);
    }
  };

  const handleSaveLocation = async () => {
    if (!selectedVendor || !markerPosition) {
      setMessage({ type: 'error', text: 'الرجاء تحديد متجر وموقع على الخريطة' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('vendors')
        .update({
          latitude: markerPosition.lat,
          longitude: markerPosition.lng
        })
        .eq('id', selectedVendor.id);

      if (error) throw error;

      setMessage({ type: 'success', text: `تم حفظ موقع ${selectedVendor.store_name} بنجاح` });

      await loadVendors();

      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving location:', error);
      setMessage({ type: 'error', text: 'فشل حفظ الموقع' });
    } finally {
      setSaving(false);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setMarkerPosition(pos);
          setMapCenter(pos);
          setMessage({ type: 'success', text: 'تم تحديد موقعك الحالي' });
        },
        () => {
          setMessage({ type: 'error', text: 'فشل تحديد موقعك الحالي' });
        }
      );
    }
  };

  const filteredVendors = vendors.filter(vendor =>
    vendor.store_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vendor.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const vendorsWithoutLocation = vendors.filter(v => !v.latitude || !v.longitude).length;

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل الخريطة...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <MapPin className="text-emerald-600" size={32} />
          إدارة مواقع المتاجر
        </h1>
        <p className="text-gray-600">
          حدد موقع كل متجر بدقة على الخريطة لضمان حساب دقيق لرسوم ووقت التوصيل
        </p>
      </div>

      {vendorsWithoutLocation > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-semibold text-amber-900">
              يوجد {vendorsWithoutLocation} متجر بدون موقع محدد
            </p>
            <p className="text-amber-700 text-sm mt-1">
              الرجاء تحديد مواقع جميع المتاجر لتحسين تجربة المستخدم
            </p>
          </div>
        </div>
      )}

      {message && (
        <div className={`rounded-lg p-4 mb-6 flex items-center gap-3 ${
          message.type === 'success'
            ? 'bg-emerald-50 border border-emerald-200'
            : 'bg-sky-50 border border-sky-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle2 className="text-emerald-600" size={20} />
          ) : (
            <AlertCircle className="text-sky-600" size={20} />
          )}
          <p className={message.type === 'success' ? 'text-emerald-900' : 'text-sky-900'}>
            {message.text}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-lg p-6 sticky top-6">
            <div className="mb-4">
              <label className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  checked={showWithoutLocation}
                  onChange={(e) => setShowWithoutLocation(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                />
                <span className="text-sm text-gray-700">عرض المتاجر بدون موقع فقط</span>
              </label>

              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث عن متجر..."
                  className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
                </div>
              ) : filteredVendors.length === 0 ? (
                <p className="text-center text-gray-500 py-8">لا توجد متاجر</p>
              ) : (
                filteredVendors.map((vendor) => (
                  <button
                    key={vendor.id}
                    onClick={() => handleVendorSelect(vendor)}
                    className={`w-full text-right p-3 rounded-lg transition-all ${
                      selectedVendor?.id === vendor.id
                        ? 'bg-emerald-50 border-2 border-emerald-500'
                        : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {vendor.logo_url ? (
                        <img src={vendor.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                          <MapPin className="text-emerald-600" size={20} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{vendor.store_name}</p>
                        <p className="text-sm text-gray-500 truncate">{vendor.address || vendor.city}</p>
                      </div>
                      {(!vendor.latitude || !vendor.longitude) && (
                        <AlertCircle className="text-amber-500 flex-shrink-0" size={18} />
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-lg p-6">
            {selectedVendor ? (
              <>
                <div className="mb-4">
                  <h2 className="text-xl font-bold text-gray-900 mb-1">{selectedVendor.store_name}</h2>
                  <p className="text-gray-600">{selectedVendor.address || selectedVendor.city}</p>
                  {markerPosition && (
                    <div className="mt-2 text-sm text-gray-500 font-mono">
                      Lat: {markerPosition.lat.toFixed(6)}, Lng: {markerPosition.lng.toFixed(6)}
                    </div>
                  )}
                </div>

                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900">
                    <strong>تعليمات:</strong> انقر على الخريطة لتحديد الموقع الدقيق للمتجر، أو استخدم زر موقعي الحالي إذا كنت في المتجر الآن
                  </p>
                </div>

                <GoogleMap
                  mapContainerStyle={containerStyle}
                  center={mapCenter}
                  zoom={15}
                  onClick={handleMapClick}
                  options={{
                    streetViewControl: false,
                    mapTypeControl: true,
                    fullscreenControl: true
                  }}
                >
                  {markerPosition && (
                    <Marker
                      position={markerPosition}
                      draggable={true}
                      onDragEnd={(e) => {
                        if (e.latLng) {
                          setMarkerPosition({
                            lat: e.latLng.lat(),
                            lng: e.latLng.lng()
                          });
                        }
                      }}
                    />
                  )}
                </GoogleMap>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleSaveLocation}
                    disabled={!markerPosition || saving}
                    className="flex-1 bg-emerald-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        جاري الحفظ...
                      </>
                    ) : (
                      <>
                        <Save size={20} />
                        حفظ الموقع
                      </>
                    )}
                  </button>

                  <button
                    onClick={getCurrentLocation}
                    className="bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <Navigation size={20} />
                    موقعي الحالي
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-[500px] text-center">
                <MapPin className="text-gray-300 mb-4" size={64} />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">اختر متجراً من القائمة</h3>
                <p className="text-gray-600 max-w-md">
                  اختر متجراً من القائمة اليمنى لبدء تحديد موقعه على الخريطة
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
