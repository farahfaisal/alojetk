import React, { useState, useEffect } from 'react';
import { Store, Star, MapPin, Clock, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode } from 'swiper/modules';
import { supabase } from '../lib/supabase';
import StorePage from './StorePage';
import { checkVendorWorkingStatus, getStatusText, getStatusBadgeClasses } from '../lib/store-hours';

import 'swiper/css';
import 'swiper/css/free-mode';

interface Vendor {
  id: string;
  store_name: string;
  logo_url?: string;
  banner_url?: string;
  rating?: number;
  rating_count?: number;
  status: string;
  address?: string;
  service_areas?: string[];
  type?: string;
  working_hours?: any;
  vacation_mode?: boolean;
}

interface VendorsListProps {
  limit?: number;
  type?: 'restaurant' | 'supermarket' | 'all';
  categoryId?: number | null;
  onViewAll?: () => void;
  selectedCity?: string;
  sortBy?: 'featured' | 'newest' | 'rating';
  includeInactive?: boolean;
}

const VendorsList: React.FC<VendorsListProps> = ({
  limit,
  type = 'restaurant',
  categoryId = null,
  onViewAll,
  selectedCity,
  sortBy = 'featured',
  includeInactive = true
}) => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

  // Map UI type to database type
  const mapTypeToDbValue = (uiType: string): string => {
    if (uiType === 'restaurant') return 'مطاعم';
    if (uiType === 'supermarket') return 'ماركت';
    return uiType;
  };

  // Fetch vendors for this category
  useEffect(() => {
    const fetchVendors = async () => {
      setLoading(true);
      try {
        // Get all areas to search in (main + sub areas) if selectedCity is provided
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

            console.log('📍 VendorsList search areas:', searchAreas);
          }
        }

        let query;

        // Check if we need to filter by category
        if (categoryId) {
          // First get all products in this category
          const { data: productsData } = await supabase
            .from('products')
            .select('vendor_id')
            .eq('category_id', categoryId)
            .eq('status', 'active');

          if (!productsData || productsData.length === 0) {
            setVendors([]);
            setTotalCount(0);
            setLoading(false);
            return;
          }

          // Get unique vendor IDs
          const vendorIds = [...new Set(productsData.map(p => p.vendor_id))];

          // Now fetch vendors
          query = supabase
            .from('vendors')
            .select('*', { count: 'exact' })
            .in('id', vendorIds);
        } else {
          // No category filter, just get all vendors
          query = supabase
            .from('vendors')
            .select('*', { count: 'exact' });
        }

        // Filter by type if specified
        if (type !== 'all') {
          const dbType = mapTypeToDbValue(type);
          query = query.eq('type', dbType);
        }

        // Filter by status if includeInactive is false
        if (!includeInactive) {
          query = query.eq('status', 'active');
        }

        // Apply sorting
        switch (sortBy) {
          case 'newest':
            query = query.order('created_at', { ascending: false });
            break;
          case 'rating':
            query = query.order('rating', { ascending: false });
            break;
          case 'featured':
          default:
            query = query.order('featured_order', { ascending: true, nullsLast: true })
                        .order('rating', { ascending: false });
            break;
        }

        // Execute query without limit first if we need to filter by city
        const { data: allVendors, error: fetchError, count } = await query;

        if (fetchError) throw fetchError;

        // Filter by city/area if specified
        let filteredVendors = allVendors || [];
        if (selectedCity && searchAreas.length > 0) {
          // Get area IDs for the selected city
          const { data: areaData } = await supabase
            .from('service_areas')
            .select('id')
            .in('name', searchAreas);

          const searchAreaIds = areaData?.map(a => a.id) || [];

          filteredVendors = filteredVendors.filter((v: any) => {
            // Check main_service_area_id first (most reliable)
            if (v.main_service_area_id && searchAreaIds.includes(v.main_service_area_id)) {
              return true;
            }

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

        // Apply limit AFTER filtering by city
        if (limit) {
          filteredVendors = filteredVendors.slice(0, limit);
        }

        console.log("Fetched vendors:", filteredVendors);

        setVendors(filteredVendors);
        setTotalCount(filteredVendors.length);
      } catch (err) {
        console.error('Error fetching vendors:', err);
        setError('حدث خطأ في جلب قائمة المتاجر');
      } finally {
        setLoading(false);
      }
    };

    fetchVendors();
  }, [categoryId, type, includeInactive, sortBy, limit, selectedCity]);

  const handleVendorClick = (vendor: Vendor) => {
    if (vendor) {
      setSelectedVendor(vendor);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4 animate-spin" />
        <p className="text-gray-500">جاري تحميل المتاجر...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-2">
        <Store className="w-5 h-5" />
        <p>{error}</p>
      </div>
    );
  }

  if (vendors.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 text-gray-300 mx-auto mb-4">
          <Store className="w-full h-full" />
        </div>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">لا توجد متاجر</h3>
        <p className="text-gray-500">لم يتم العثور على متاجر متاحة</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Swiper
        slidesPerView={2.2}
        spaceBetween={12}
        freeMode={true}
        modules={[FreeMode]}
        className="!overflow-visible"
      >
        {vendors.map((vendor) => (
          <SwiperSlide key={vendor.id}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleVendorClick(vendor)}
              className="bg-white rounded-lg overflow-hidden transition-all cursor-pointer w-full border border-gray-200 flex flex-col"
              style={{ height: '230px' }}
            >
              {/* Logo Section - Centered - Fixed Height */}
              <div className="flex flex-col items-center pt-4 pb-1 bg-white" style={{ height: '100px' }}>
                <div className="w-20 h-20 rounded-full overflow-hidden bg-white border-2 border-gray-100">
                  {vendor.logo_url ? (
                    <img
                      src={vendor.logo_url}
                      alt={vendor.store_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-red-700 to-red-800 flex items-center justify-center text-white font-bold text-xl">
                      {vendor.store_name.charAt(0)}
                    </div>
                  )}
                </div>
              </div>

              {/* Store Info - Fixed Height */}
              <div className="px-3 pb-3 bg-white flex-1 flex flex-col">
                {/* Store Name - Fixed Height */}
                <h3 className="font-bold text-gray-900 text-lg text-center line-clamp-2 leading-tight mb-0.5" style={{ height: '42px' }}>
                  {vendor.store_name}
                </h3>

                {/* Location - Fixed Height */}
                {vendor.address && (
                  <div className="flex items-center justify-center gap-1 mb-2" style={{ height: '16px' }}>
                    <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-500 text-[10px] truncate">
                      {vendor.address}
                    </span>
                  </div>
                )}

                {/* Divider */}
                <div className="w-full h-px bg-gray-200 my-1.5"></div>

                {/* Rating Section - Fixed Height */}
                <div className="flex items-center justify-center gap-1 mb-1.5" style={{ height: '18px' }}>
                  <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                  <span className="font-bold text-gray-900 text-xs">
                    {vendor.rating ? vendor.rating : 'جديد'}
                  </span>
                  {vendor.rating_count && (
                    <span className="text-gray-500 text-[11px]">({vendor.rating_count > 999 ? '+1000' : `+${vendor.rating_count}`})</span>
                  )}
                </div>

                {/* Status Badge - Fixed Height */}
                <div className="flex items-center justify-center" style={{ height: '18px' }}>
                  {(() => {
                    const workingStatus = checkVendorWorkingStatus(vendor);
                    return (
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${getStatusBadgeClasses(workingStatus)}`}>
                        {getStatusText(workingStatus)}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </motion.button>
          </SwiperSlide>
        ))}

        {/* View All Slide */}
        {totalCount > (limit || 0) && onViewAll && (
          <SwiperSlide className="!w-40">
            <motion.button
              whileHover={{ scale: 1.02 }}
              onClick={onViewAll}
              className="h-full w-full bg-accent/5 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-accent/10 transition-colors"
            >
              <span className="text-accent font-medium">عرض الكل</span>
              <ChevronLeft className="w-5 h-5 text-accent" />
              <span className="text-sm text-gray-500">
                {totalCount} {type === 'restaurant' ? 'مطعم' : 'متجر'}
              </span>
            </motion.button>
          </SwiperSlide>
        )}
      </Swiper>

      <AnimatePresence>
        {selectedVendor && (
          <div className="fixed inset-0 z-[999999]">
            <StorePage
              vendor={{
                id: selectedVendor.id,
                store_name: selectedVendor.store_name,
                banner: selectedVendor.banner_url,
                logo: selectedVendor.logo_url,
                rating: selectedVendor.rating,
                status: selectedVendor.status,
                address: selectedVendor.address
              }}
              categoryId={categoryId || null}
              onClose={() => setSelectedVendor(null)}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VendorsList;