import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay } from 'swiper/modules';
import { supabase } from '../lib/supabase';

import 'swiper/css';

interface Advertisement {
  id: string;
  title: string;
  description?: string;
  image_url: string;
  link?: string;
  status: 'active' | 'pending' | 'expired';
  start_date: string;
  end_date: string;
  type?: string;
  position?: string;
}

interface FeaturedSliderProps {
  type?: 'restaurant' | 'supermarket';
  position?: string;
}

const FeaturedSlider: React.FC<FeaturedSliderProps> = ({ type, position = 'home' }) => {
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAds = async () => {
      try {
        setLoading(true);
        setError(null);

        // Build query for active advertisements
        let query = supabase
          .from('advertisements')
          .select('*')
          .eq('status', 'active')
          .eq('type', 'slider');

        // Filter by position if provided
        if (position) {
          query = query.eq('position', position);
        }

        // Order by priority
        query = query.order('priority', { ascending: false });

        const { data, error } = await query;

        if (error) throw error;
        console.log('FeaturedSlider ads:', data);
        setAds(data || []);
      } catch (err) {
        console.error('Error fetching advertisements:', err);
        setError('حدث خطأ في جلب الإعلانات');
      } finally {
        setLoading(false);
      }
    };

    fetchAds();
  }, [position, type]);

  if (loading) {
    return (
      <div className="relative -mx-4 h-[250px] bg-gray-200 animate-pulse">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-t-transparent border-brand rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (error || ads.length === 0) {
    return null;
  }

  return (
    <div className="relative w-screen overflow-hidden" dir="ltr" style={{ marginLeft: 'calc(-50vw + 50%)' }}>
      <Swiper
        modules={[Autoplay]}
        spaceBetween={0}
        slidesPerView={1}
        autoplay={{
          delay: 3000,
          disableOnInteraction: false,
        }}
        loop={true}
        className="h-[250px]"
        slidesPerGroup={1}
        dir="ltr"
      >
        {ads.map((ad) => (
          <SwiperSlide key={ad.id}>
            <div
              className="relative w-full h-full cursor-pointer"
              onClick={() => ad.link && window.open(ad.link, '_blank')}
            >
              <img
                src={ad.image_url}
                alt={ad.title}
                className="w-full h-full object-cover"
                style={{ display: 'block' }}
              />
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
};

export default FeaturedSlider;