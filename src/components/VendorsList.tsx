import React, { useState, useEffect } from 'react';
import { Store, Star, MapPin, Clock, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode } from 'swiper/modules';
import { supabase } from '../lib/supabase';
import StorePage from './StorePage';

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
  city?: string;
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
        let query;
        
        // Check if we need to filter by category
        if (categoryId) {
          query = supabase
            .from('vendors')
            .select(`
              *,
              products!inner (
                id,
                category_id
              )
            `);
          // Filter by category
          query = query.eq('products.category_id', categoryId);
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
        
        // Apply limit if specified
        if (limit) {
          query = query.limit(limit);
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
        
        // Execute query
        const { data: vendors, error: fetchError, count } = await query;
        
        if (fetchError) throw fetchError;
        
        // Filter out duplicates by vendor ID
        const uniqueVendors = vendors ? Array.from(new Set(vendors.map(v => v.id)))
          .map(id => vendors.find(v => v.id === id))
          .filter(Boolean) : [];
        
        console.log("Fetched vendors:", uniqueVendors);
        
        setVendors(uniqueVendors as Vendor[]);
        setTotalCount(count || uniqueVendors.length);
      } catch (err) {
        console.error('Error fetching vendors:', err);
        setError('حدث خطأ في جلب قائمة المتاجر');
      } finally {
        setLoading(false);
      }
    };

    fetchVendors();
  }, [categoryId, type, includeInactive, sortBy, limit]);

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
                {(vendor.address || vendor.city) && (
                  <div className="flex items-center justify-center gap-1 mb-2" style={{ height: '16px' }}>
                    <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-500 text-[10px] truncate">
                      {vendor.city || vendor.address}
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
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${
                    vendor.status === 'active'
                      ? 'bg-green-500/90 text-white'
                      : vendor.status === 'busy'
                        ? 'bg-orange-500/90 text-white'
                        : vendor.status === 'suspended'
                          ? 'bg-red-500/90 text-white'
                          : 'bg-red-700/90 text-white'
                  }`}>
                    {vendor.status === 'active' ? 'مفتوح الآن' :
                     vendor.status === 'busy' ? 'مشغول' :
                     vendor.status === 'suspended' ? 'معلق' : 'مغلق'}
                  </span>
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
                status: selectedVendor.status
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