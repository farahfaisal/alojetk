import React, { useState, useEffect } from 'react';
import { Star, MapPin, Crown } from 'lucide-react';
import { motion } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode } from 'swiper/modules';
import { supabase } from '../lib/supabase';
import { checkVendorWorkingStatus, getStatusText, getStatusBadgeClasses } from '../lib/store-hours';

import 'swiper/css';
import 'swiper/css/free-mode';

interface SponsoredVendor {
  id: string;
  store_name: string;
  logo_url?: string;
  banner_url?: string;
  rating?: number;
  rating_count?: number;
  status: string;
  address?: string;
  type?: string;
  working_hours?: any;
  vacation_mode?: boolean;
}

interface SponsoredVendorsProps {
  onVendorClick: (vendor: SponsoredVendor) => void;
  type?: 'restaurant' | 'supermarket' | 'all';
}

const SponsoredVendors: React.FC<SponsoredVendorsProps> = ({ onVendorClick, type = 'all' }) => {
  const [vendors, setVendors] = useState<SponsoredVendor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSponsoredVendors = async () => {
      try {
        setLoading(true);

        let dbType = null;
        if (type === 'restaurant') dbType = 'مطاعم';
        if (type === 'supermarket') dbType = 'ماركت';

        const query = supabase
          .from('vendors')
          .select('*')
          .eq('sponsored', true)
          .order('rating', { ascending: false });

        if (dbType) {
          query.eq('type', dbType);
        }

        const { data, error } = await query;

        if (error) throw error;
        setVendors(data || []);
      } catch (err) {
        console.error('Error fetching sponsored vendors:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSponsoredVendors();
  }, [type]);

  if (loading) {
    return (
      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Crown className="w-5 h-5 text-amber-500" />
          متاجر ممولة
        </h2>
        <div className="animate-pulse">
          <Swiper
            slidesPerView={2.2}
            spaceBetween={16}
            freeMode={true}
            modules={[FreeMode]}
          >
            {[...Array(3)].map((_, index) => (
              <SwiperSlide key={index}>
                <div className="bg-gray-200 rounded-xl h-48 w-full"></div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>
    );
  }

  if (vendors.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Crown className="w-5 h-5 text-amber-500" />
        متاجر ممولة
      </h2>
      <Swiper
        slidesPerView={2.2}
        spaceBetween={16}
        freeMode={true}
        modules={[FreeMode]}
        loop={false}
      >
        {vendors.map((vendor) => (
          <SwiperSlide key={vendor.id}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={(e) => {
                e.preventDefault();
                onVendorClick(vendor);
              }}
              className="bg-white rounded-lg overflow-hidden transition-all cursor-pointer w-full border border-gray-200 relative flex flex-col"
              style={{ height: '230px' }}
            >
              <div className="absolute top-2 right-2 z-10">
                <div className="bg-amber-500 text-white px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1">
                  <Crown className="w-3 h-3 fill-white" />
                  ممول
                </div>
              </div>

              <div className="flex flex-col items-center pt-4 pb-1 bg-white" style={{ height: '100px' }}>
                <div className="w-20 h-20 rounded-full overflow-hidden bg-white border-2 border-gray-100">
                  {vendor.logo_url ? (
                    <img
                      src={vendor.logo_url}
                      alt={`${vendor.store_name} logo`}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = `https://via.placeholder.com/100?text=${vendor.store_name.charAt(0)}`; }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white font-bold text-xl">
                      {vendor.store_name.charAt(0)}
                    </div>
                  )}
                </div>
              </div>

              <div className="px-3 pb-3 bg-white flex-1 flex flex-col">
                <h3 className="font-bold text-gray-900 text-base text-center line-clamp-2 leading-tight" style={{ height: '48px' }}>
                  {vendor.store_name}
                </h3>

                {vendor.address && (
                  <div className="flex items-center justify-center gap-1 mb-2" style={{ height: '18px' }}>
                    <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-500 text-xs truncate">
                      {vendor.address}
                    </span>
                  </div>
                )}

                <div className="w-full h-px bg-gray-200 my-1.5"></div>

                <div className="flex items-center justify-center gap-1 mb-1.5" style={{ height: '20px' }}>
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  <span className="font-bold text-gray-900 text-sm">
                    {vendor.rating ? vendor.rating : 'جديد'}
                  </span>
                  {vendor.rating_count && (
                    <span className="text-gray-500 text-sm">({vendor.rating_count > 999 ? '+1000' : `+${vendor.rating_count}`})</span>
                  )}
                </div>

                <div className="flex items-center justify-center" style={{ height: '20px' }}>
                  {(() => {
                    const workingStatus = checkVendorWorkingStatus(vendor);
                    return (
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClasses(workingStatus)}`}>
                        {getStatusText(workingStatus)}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </motion.button>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
};

export default SponsoredVendors;
