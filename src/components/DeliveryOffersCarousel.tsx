import React, { useState, useEffect } from 'react';
import { Truck, Gift, Clock, ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode, Autoplay } from 'swiper/modules';
import { getActiveDeliveryOffers, formatOfferText, type DeliveryOffer } from '../lib/delivery-offers';

import 'swiper/css';
import 'swiper/css/free-mode';

interface DeliveryOffersCarouselProps {
  onOfferClick?: (offer: DeliveryOffer) => void;
  onViewAll?: () => void;
  vendorId?: string;
  categoryId?: string;
}

const DeliveryOffersCarousel: React.FC<DeliveryOffersCarouselProps> = ({
  onOfferClick,
  onViewAll,
  vendorId,
  categoryId
}) => {
  const [offers, setOffers] = useState<DeliveryOffer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOffers = async () => {
      try {
        setLoading(true);
        const offersData = await getActiveDeliveryOffers();

        let filteredOffers = offersData;
        if (vendorId) filteredOffers = offersData.filter(o => !o.vendor_id || o.vendor_id === vendorId);
        if (categoryId) filteredOffers = filteredOffers.filter(o => !o.category_id || o.category_id === categoryId);

        setOffers(filteredOffers);
      } catch (err) {
        console.error('Error fetching offers:', err);
        setOffers([]);
      } finally {
        setLoading(false);
      }
    };
    fetchOffers();
  }, [vendorId, categoryId]);

  if (loading) {
    return (
      <div className="py-4">
        <div className="flex items-center justify-between mb-4 px-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Truck className="w-5 h-5 text-brand" />
            عروض التوصيل
          </h2>
        </div>
        <div className="animate-pulse px-4">
          <Swiper slidesPerView={1.2} spaceBetween={16} freeMode modules={[FreeMode]}>
            {[...Array(3)].map((_, index) => (
              <SwiperSlide key={index}>
                <div className="bg-gray-200 rounded-xl h-28 w-full"></div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>
    );
  }

  if (offers.length === 0) return null;

  const handleOfferClick = (offer: DeliveryOffer) => {
    if (onOfferClick) onOfferClick(offer);
  };

  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-4 px-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Truck className="w-5 h-5 text-brand" />
          عروض التوصيل
        </h2>
        {offers.length > 2 && onViewAll && (
          <button
            onClick={onViewAll}
            className="text-brand hover:text-brand-light transition-colors text-sm font-bold flex items-center"
          >
            عرض الكل <ChevronLeft className="w-4 h-4 mr-1" />
          </button>
        )}
      </div>

      <div className="px-4">
        <Swiper
          slidesPerView={1.2}
          spaceBetween={16}
          freeMode
          autoplay={{ delay: 4000, disableOnInteraction: false }}
          loop={offers.length > 1}
          modules={[FreeMode, Autoplay]}
        >
          {offers.map((offer) => (
            <SwiperSlide key={offer.id}>
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleOfferClick(offer)}
                className="relative overflow-hidden rounded-xl shadow-md cursor-pointer h-28 border border-gray-300"
                style={{
                  backgroundColor: '#f3f4f6',
                }}
              >
                <div className="relative z-10 p-4 h-full flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-7 h-7 bg-gray-800 rounded-full flex items-center justify-center">
                        <Truck className="w-4 h-4 text-white" />
                      </div>
                      <h3 className="font-bold text-base text-black">{offer.title}</h3>
                    </div>
                    <p className="text-xs leading-tight font-medium pr-9 text-black mb-1">
                      {formatOfferText(offer)}
                    </p>
                    {offer.vendors && (
                      <div className="flex items-center gap-1.5 pr-9">
                        {offer.vendors.logo_url ? (
                          <img
                            src={offer.vendors.logo_url}
                            alt={offer.vendors.store_name}
                            className="w-4 h-4 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-4 h-4 bg-brand rounded-full flex items-center justify-center">
                            <span className="text-white text-[8px] font-bold">
                              {offer.vendors.store_name.charAt(0)}
                            </span>
                          </div>
                        )}
                        <span className="text-[10px] font-semibold text-gray-700">
                          {offer.vendors.store_name}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="w-11 h-11 bg-gray-800 rounded-full flex items-center justify-center flex-shrink-0 ml-3">
                    <Gift className="w-5 h-5 text-white" />
                  </div>
                </div>

                <div className="absolute bottom-2 right-3">
                  <div className="flex items-center gap-1 text-xs font-medium text-black/70">
                    <Clock className="w-3 h-3" />
                    <span>
                      {Math.ceil(
                        (new Date(offer.end_date).getTime() - new Date().getTime()) /
                          (1000 * 60 * 60 * 24)
                      )}{' '}
                      يوم
                    </span>
                  </div>
                </div>
              </motion.div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </div>
  );
};

export default DeliveryOffersCarousel;
