import React, { useState, useEffect } from 'react';
import { Star, Clock, MapPin, Tag } from 'lucide-react';
import { motion } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode } from 'swiper/modules';
import { supabase } from '../lib/supabase';

import 'swiper/css';
import 'swiper/css/free-mode';

interface VendorWithOffer {
  id: string;
  store_name: string;
  logo_url?: string;
  banner_url?: string;
  rating?: number;
  rating_count?: number;
  status: string;
  type?: string;
  address?: string;
  delivery_zones?: Array<{name: string; price: number}>;
  offer_count?: number;
}

interface VendorsWithOffersProps {
  onVendorClick: (vendor: VendorWithOffer) => void;
  type?: 'restaurant' | 'supermarket' | 'all';
  selectedCity?: string;
}

const BRAND = '#1759cb';

const VendorsWithOffers: React.FC<VendorsWithOffersProps> = ({ onVendorClick, type = 'all', selectedCity }) => {
  const [vendors, setVendors] = useState<VendorWithOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVendorsWithOffers = async () => {
      try {
        setLoading(true);
        setError(null);

        let dbType = null;
        if (type === 'restaurant') dbType = 'مطاعم';
        if (type === 'supermarket') dbType = 'ماركت';

        console.log('🔍 VendorsWithOffers: Fetching vendors with type:', type, 'dbType:', dbType, 'city:', selectedCity);

        // Get all areas to search in (main + sub areas)
        let searchAreas: string[] = [];
        if (selectedCity) {
          const { data: selectedArea } = await supabase
            .from('service_areas')
            .select('id, name, parent_id')
            .eq('name', selectedCity)
            .maybeSingle();

          if (selectedArea) {
            let mainAreaId = selectedArea.id;
            let mainAreaName = selectedArea.name;

            if (selectedArea.parent_id) {
              const { data: parentArea } = await supabase
                .from('service_areas')
                .select('id, name')
                .eq('id', selectedArea.parent_id)
                .maybeSingle();

              if (parentArea) {
                mainAreaId = parentArea.id;
                mainAreaName = parentArea.name;
              }
            }

            const { data: subAreas } = await supabase
              .from('service_areas')
              .select('name')
              .eq('parent_id', mainAreaId);

            searchAreas = [mainAreaName];
            if (subAreas && subAreas.length > 0) {
              searchAreas.push(...subAreas.map(area => area.name));
            }

            console.log('📍 VendorsWithOffers search areas:', searchAreas);
          }
        }

        let query = supabase
          .from('vendors')
          .select(`
            id,
            store_name,
            logo_url,
            banner_url,
            rating,
            rating_count,
            status,
            type,
            address,
            delivery_zones,
            service_areas,
            working_hours
          `)
          .eq('status', 'active');

        if (dbType) {
          query = query.eq('type', dbType);
        }

        const { data: vendorsData, error: vendorsError } = await query;

        if (vendorsError) throw vendorsError;

        console.log('✅ VendorsWithOffers: Found vendors:', vendorsData?.length);

        if (!vendorsData || vendorsData.length === 0) {
          setVendors([]);
          setLoading(false);
          return;
        }

        const { data: productsWithDiscounts, error: productsError } = await supabase
          .from('products')
          .select('vendor_id')
          .eq('status', 'active')
          .not('discount_price', 'is', null)
          .gt('discount_price', 0);

        if (productsError) throw productsError;

        console.log('✅ VendorsWithOffers: Found products with discounts:', productsWithDiscounts?.length);

        const vendorIdsWithOffers = new Set(productsWithDiscounts?.map(p => p.vendor_id) || []);

        console.log('✅ VendorsWithOffers: Unique vendors with offers:', vendorIdsWithOffers.size);

        let vendorsWithActiveOffers = vendorsData
          .filter(v => vendorIdsWithOffers.has(v.id))
          .map(v => ({
            ...v,
            offer_count: productsWithDiscounts?.filter(p => p.vendor_id === v.id).length || 0
          }));

        // Filter by selectedCity if specified
        if (selectedCity && searchAreas.length > 0) {
          // Get area IDs for the selected city
          const { data: areaData } = await supabase
            .from('service_areas')
            .select('id')
            .in('name', searchAreas);

          const searchAreaIds = areaData?.map(a => a.id) || [];

          vendorsWithActiveOffers = vendorsWithActiveOffers.filter((v: any) => {
            // Check service_areas (secondary method)
            if (v.service_areas && Array.isArray(v.service_areas) && v.service_areas.length > 0) {
              const hasServiceArea = v.service_areas.some((area: string) => searchAreas.includes(area));
              if (hasServiceArea) return true;
            }

            // Fallback: check delivery_zones
            if (v.delivery_zones && Array.isArray(v.delivery_zones) && v.delivery_zones.length > 0) {
              return v.delivery_zones.some((zone: any) => searchAreas.includes(zone.name));
            }

            // If vendor has no zones at all, don't show them
            return false;
          });
        }

        console.log('✅ VendorsWithOffers: Final vendors to show:', vendorsWithActiveOffers.length);

        setVendors(vendorsWithActiveOffers);
      } catch (error: any) {
        console.error('Error fetching vendors with offers:', error);
        setError('حدث خطأ في تحميل المتاجر');
      } finally {
        setLoading(false);
      }
    };

    fetchVendorsWithOffers();
  }, [type, selectedCity]);

  const getCategoryFallbackImage = (storeName: string) => {
    const firstChar = storeName.charAt(0).toUpperCase();
    return `https://via.placeholder.com/200x200/dc2626/ffffff?text=${firstChar}`;
  };

  console.log('🎨 VendorsWithOffers Render - loading:', loading, 'error:', error, 'vendors:', vendors.length);

  if (loading) {
    return (
      <div className="py-4">
        <div className="flex items-center justify-between mb-4 px-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-200 rounded animate-pulse" />
            <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex gap-3 px-4 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-shrink-0 w-40 h-52 bg-gray-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="py-4 bg-gray-50">
      <div className="flex items-center justify-between mb-4 px-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${BRAND}15` }}>
            <Tag className="w-5 h-5" style={{ color: BRAND }} />
          </div>
          <h2 className="text-xl font-bold text-gray-900">عروض خاصة</h2>
        </div>
      </div>

      {error && (
        <div className="px-4 py-6 text-center bg-white rounded-lg mx-4">
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      )}

      {!error && vendors.length === 0 && (
        <div className="px-4 py-6 text-center bg-white rounded-lg mx-4">
          <p className="text-gray-500 text-sm">لا توجد عروض متاحة حالياً</p>
        </div>
      )}

      {!error && vendors.length > 0 && (
        <Swiper
          modules={[FreeMode]}
          spaceBetween={12}
          slidesPerView="auto"
          freeMode={true}
          className="!px-4"
        >
          {vendors.map((vendor) => (
          <SwiperSlide key={vendor.id} className="!w-40">
            <motion.div
              whileTap={{ scale: 0.95 }}
              onClick={() => onVendorClick(vendor)}
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden cursor-pointer transition-all duration-200 flex flex-col h-full hover:shadow-[0_8px_30px_rgba(23,89,203,0.35)] hover:border-[#1759cb]/40"
              style={{ boxShadow: '0 2px 12px rgba(23,89,203,0.08)' }}
            >
              <div className="relative aspect-square bg-gray-50 overflow-hidden">
                <div className="absolute top-2 right-2 z-10 px-2 py-1 rounded-full text-xs font-bold text-white flex items-center gap-1 shadow-lg" style={{ backgroundColor: BRAND }}>
                  <Tag className="w-3 h-3" />
                  <span>عرض</span>
                </div>

                <div className="w-full h-full flex items-center justify-center p-3">
                  {vendor.logo_url ? (
                    <img
                      src={vendor.logo_url}
                      alt={`${vendor.store_name} logo`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = getCategoryFallbackImage(vendor.store_name);
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-sky-700 to-sky-800 flex items-center justify-center text-white font-bold text-xl">
                      {vendor.store_name.charAt(0)}
                    </div>
                  )}
                </div>
              </div>

              <div className="px-3 pb-3 bg-white flex-1 flex flex-col">
                <h3 className="font-bold text-gray-900 text-lg text-center line-clamp-2 leading-tight mb-0.5" style={{ height: '42px' }}>
                  {vendor.store_name}
                </h3>

                {(vendor.address || (vendor.delivery_zones && vendor.delivery_zones.length > 0)) && (
                  <div className="flex items-center justify-center gap-1 mb-2" style={{ height: '16px' }}>
                    <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <span className="text-xs text-gray-500 truncate">
                      {vendor.delivery_zones && vendor.delivery_zones.length > 0
                        ? vendor.delivery_zones[0].name
                        : vendor.address}
                    </span>
                  </div>
                )}

                {vendor.rating !== undefined && vendor.rating > 0 && (
                  <div className="flex items-center justify-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                    <span className="font-bold text-gray-900 text-sm">
                      {vendor.rating.toFixed(1)}
                    </span>
                    {vendor.rating_count !== undefined && vendor.rating_count > 0 && (
                      <span className="text-xs text-gray-500">
                        ({vendor.rating_count})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </SwiperSlide>
        ))}
        </Swiper>
      )}
    </div>
  );
};

export default VendorsWithOffers;
