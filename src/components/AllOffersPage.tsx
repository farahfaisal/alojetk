import React, { useState, useEffect } from 'react';
import { X, Truck, Gift, Clock, Store, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getActiveDeliveryOffers, formatOfferText, type DeliveryOffer } from '../lib/delivery-offers';

interface AllOffersPageProps {
  onClose: () => void;
  onOfferClick: (offer: DeliveryOffer) => void;
}

const AllOffersPage: React.FC<AllOffersPageProps> = ({ onClose, onOfferClick }) => {
  const [offers, setOffers] = useState<DeliveryOffer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOffers = async () => {
      try {
        setLoading(true);
        const offersData = await getActiveDeliveryOffers();
        setOffers(offersData);
      } catch (err) {
        console.error('Error fetching offers:', err);
        setOffers([]);
      } finally {
        setLoading(false);
      }
    };
    fetchOffers();
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-white z-50 overflow-y-auto"
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Truck className="w-6 h-6 text-brand" />
              <h1 className="text-xl font-bold text-gray-900">جميع عروض التوصيل</h1>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="p-4 pb-24">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-12 h-12 text-brand animate-spin mb-4" />
              <p className="text-gray-600">جاري التحميل...</p>
            </div>
          ) : offers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Gift className="w-16 h-16 text-gray-300 mb-4" />
              <p className="text-gray-600 text-center">لا توجد عروض متاحة حالياً</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {offers.map((offer) => (
                <motion.div
                  key={offer.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    onOfferClick(offer);
                    onClose();
                  }}
                  className="relative overflow-hidden rounded-xl shadow-md cursor-pointer border border-gray-300"
                  style={{
                    backgroundColor: '#f3f4f6',
                  }}
                >
                  <div className="relative z-10 p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center">
                            <Truck className="w-5 h-5 text-white" />
                          </div>
                          <h3 className="font-bold text-lg text-black">{offer.title}</h3>
                        </div>
                      </div>
                      <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center flex-shrink-0">
                        <Gift className="w-6 h-6 text-white" />
                      </div>
                    </div>

                    <p className="text-sm leading-relaxed font-medium text-black mb-3">
                      {formatOfferText(offer)}
                    </p>

                    <div className="flex items-center justify-between">
                      {offer.vendors && (
                        <div className="flex items-center gap-2">
                          <Store className="w-4 h-4 text-gray-600" />
                          {offer.vendors.logo_url ? (
                            <img
                              src={offer.vendors.logo_url}
                              alt={offer.vendors.store_name}
                              className="w-5 h-5 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-5 h-5 bg-brand rounded-full flex items-center justify-center">
                              <span className="text-white text-[9px] font-bold">
                                {offer.vendors.store_name.charAt(0)}
                              </span>
                            </div>
                          )}
                          <span className="text-sm font-semibold text-gray-700">
                            {offer.vendors.store_name}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 text-sm font-medium text-black/70">
                        <Clock className="w-4 h-4" />
                        <span>
                          {Math.ceil(
                            (new Date(offer.end_date).getTime() - new Date().getTime()) /
                              (1000 * 60 * 60 * 24)
                          )}{' '}
                          يوم
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AllOffersPage;
