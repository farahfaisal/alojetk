import React, { useState, useEffect } from 'react';
import { Search, AlertCircle, Store, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import VendorsList from '../components/VendorsList';
import FeaturedVendors from '../components/FeaturedVendors';
import FeaturedSlider from '../components/FeaturedSlider';
import VendorsWithOffers from '../components/VendorsWithOffers';
import CategoriesSlider from '../components/CategoriesSlider';
import AllVendorsPage from '../components/AllVendorsPage';
import CategoryVendorsPage from '../components/CategoryVendorsPage';
import StorePage from '../components/StorePage';
import DeliveryOffersCarousel from '../components/DeliveryOffersCarousel';
import AllOffersPage from '../components/AllOffersPage';
import { supabase } from '../lib/supabase';
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode } from 'swiper/modules';
import { ChevronLeft, Star } from 'lucide-react';

import 'swiper/css';
import 'swiper/css/free-mode';

interface SupermarketProps {
  selectedCity: string;
  onOpenSearch?: () => void;
}

interface ProductCategory {
  id: number;
  name: string;
  image_url?: string;
  parent_id?: number;
}

interface Vendor {
  id: string;
  store_name: string;
  logo_url?: string;
  banner_url?: string;
  rating?: number;
  rating_count?: number;
  status: string;
  featured_until?: string;
  featured_order?: number;
}

const Supermarket: React.FC<SupermarketProps> = ({ selectedCity, onOpenSearch }) => {
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [showAllVendors, setShowAllVendors] = useState(false);
  const [showCategoryVendors, setShowCategoryVendors] = useState(false);
  const [selectedCategoryForVendors, setSelectedCategoryForVendors] = useState<{ id: number; name: string } | null>(null);
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
  const [availableVendors, setAvailableVendors] = useState<Vendor[]>([]);
  const [vendorsByCategory, setVendorsByCategory] = useState<{
    category: ProductCategory;
    vendors: Vendor[];
  }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [showAllOffers, setShowAllOffers] = useState(false);

  // Fetch product categories (subcategories of "ماركت")
  useEffect(() => {
    const fetchProductCategories = async () => {
      try {
        setLoading(true);
        // First get the parent category ID for "ماركت"
        const { data: parentData, error: parentError } = await supabase
          .from('categories')
          .select('id')
          .eq('name', 'ماركت')
          .single();

        if (parentError) {
          console.error('Error fetching parent category:', parentError);
          return;
        }

        if (!parentData) {
          console.warn('Parent category "ماركت" not found');
          return;
        }

        // Then get all subcategories with this parent_id
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .eq('parent_id', parentData.id)
          .order('name');

        if (error) {
          console.error('Error fetching product categories:', error);
          return;
        }

        setProductCategories(data || []);
      } catch (err) {
        console.error('Error fetching product categories:', err);
        setError('حدث خطأ في جلب التصنيفات');
      } finally {
        setLoading(false);
      }
    };

    fetchProductCategories();
  }, []);

  // Fetch available vendors with type "ماركت"
  useEffect(() => {
    const fetchAvailableVendors = async () => {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('vendors')
          .select('*')
          .eq('type', 'ماركت')
          .eq('status', 'active')
          .order('rating', { ascending: false })
          .limit(12);
          
        if (error) throw error;
        setAvailableVendors(data || []);
      } catch (err) {
        console.error('Error fetching available vendors:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAvailableVendors();
  }, []);

  // Fetch vendors by product category
  useEffect(() => {
    if (productCategories.length === 0) return;
    
    const fetchVendorsByCategory = async () => {
      try {
        setLoading(true);
        const all: { category: ProductCategory; vendors: Vendor[] }[] = [];
        
        for (const category of productCategories) {
          // Get products in this category
          const { data: productsData } = await supabase
            .from('products')
            .select('vendor_id')
            .eq('category_id', category.id);
            
          if (!productsData || productsData.length === 0) continue;
          
          // Get unique vendor IDs
          const vendorIds = [...new Set(productsData.map(p => p.vendor_id))];
          
          // Fetch vendors with type "ماركت"
          const { data: vendorsData } = await supabase
            .from('vendors')
            .select('*')
            .eq('type', 'ماركت')
            .in('id', vendorIds)
            .order('rating', { ascending: false })
            .limit(10);
            
          if (vendorsData && vendorsData.length > 0) {
            all.push({
              category: category,
              vendors: vendorsData
            });
          }
        }
        
        setVendorsByCategory(all);
      } catch (err) {
        console.error('Error fetching vendors by category:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchVendorsByCategory();
  }, [productCategories]);

  const handleViewCategoryVendors = (categoryId: number, categoryName: string) => {
    setSelectedCategoryForVendors({ id: categoryId, name: categoryName });
    setShowCategoryVendors(true);
  };

  const handleCategoryClick = (categoryId: number | null) => {
    if (categoryId) {
      // Find the category name
      const category = productCategories.find(c => c.id === categoryId);
      const categoryName = category?.name || 'التصنيف';

      // Open category vendors page
      setSelectedCategoryForVendors({ id: categoryId, name: categoryName });
      setShowCategoryVendors(true);
    }
    // Update selected category
    setSelectedCategory(categoryId);
  };

  // Function to get fallback image based on category name
  const getCategoryFallbackImage = (categoryName: string) => {
    return 'https://rrhoxgfnikmtgsxwvjuv.supabase.co/storage/v1/object/public/general/WhatsApp%20Image%202025-09-23%20at%2000.16.28.jpeg';
  };

  // Render vendor card with consistent styling
  const renderVendorCard = (vendor: Vendor) => (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => setSelectedVendor(vendor)}
      className="bg-white rounded-lg overflow-hidden border border-gray-200 transition-all cursor-pointer w-full flex flex-col"
      style={{ height: '230px' }}
    >
      {/* Logo Section - Centered - Fixed Height */}
      <div className="flex flex-col items-center pt-4 pb-1 bg-white" style={{ height: '100px' }}>
        <div className="w-20 h-20 rounded-full overflow-hidden bg-white border-2 border-gray-100">
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
            <div className="w-full h-full bg-gradient-to-br from-red-700 to-red-800 flex items-center justify-center text-white font-bold text-xl">
              {vendor.store_name.charAt(0)}
            </div>
          )}
        </div>
      </div>

      {/* Store Info - Fixed Height */}
      <div className="px-3 pb-3 bg-white flex-1 flex flex-col">
        {/* Store Name - Fixed Height */}
        <h3 className="font-bold text-gray-900 text-base text-center line-clamp-2 leading-tight mb-1" style={{ height: '38px' }}>
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
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${
              vendor.status === 'active' ? 'bg-green-500' :
              vendor.status === 'busy' ? 'bg-yellow-500' : 'bg-gray-400'
            }`}></div>
            <span className={`font-medium text-[11px] ${
              vendor.status === 'active' ? 'text-green-600' :
              vendor.status === 'busy' ? 'text-yellow-600' : 'text-gray-500'
            }`}>
              {vendor.status === 'active' ? 'مفتوح الآن' :
               vendor.status === 'busy' ? 'مشغول' : 'مغلق'}
            </span>
          </div>
        </div>
      </div>
    </motion.button>
  );

  if (showAllVendors) {
    return (
      <AllVendorsPage
        onClose={() => setShowAllVendors(false)}
        selectedCity={selectedCity}
        viewMode="supermarket"
        onViewModeChange={() => {}}
        onOpenCart={() => {}}
        onOpenAccount={() => {}}
        onOpenOrders={() => {}}
      />
    );
  }

  if (showCategoryVendors && selectedCategoryForVendors) {
    return (
      <CategoryVendorsPage
        onClose={() => setShowCategoryVendors(false)}
        selectedCity={selectedCity}
        viewMode="supermarket"
        onViewModeChange={() => {}}
        onOpenCart={() => {}}
        onOpenAccount={() => {}}
        onOpenOrders={() => {}}
        categoryId={selectedCategoryForVendors.id}
        categoryName={selectedCategoryForVendors.name}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden relative" style={{
      paddingTop: '0px',
      paddingBottom: 'calc(80px + max(env(safe-area-inset-bottom), 8px))'
    }}>
      {/* Header - Icons Only */}
      <div
        className="fixed top-0 left-0 right-0 z-50"
        style={{
          paddingTop: 'calc(max(env(safe-area-inset-top), 0px) + 8px)',
        }}
      >
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          {/* Search Icon - Right Side */}
          <motion.button
            onClick={() => {
              if (onOpenSearch) onOpenSearch();
            }}
            className="w-12 h-12 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center hover:bg-white transition-all shadow-lg"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Search className="w-5 h-5 text-[#c21d14]" />
          </motion.button>

          {/* Location Button with City Name - Left Side */}
          <motion.button
            onClick={() => {
              const event = new CustomEvent('openCitySelector');
              window.dispatchEvent(event);
            }}
            className="flex items-center gap-2 px-4 h-12 rounded-full bg-white/90 backdrop-blur-md hover:bg-white transition-all shadow-lg"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <MapPin className="w-5 h-5 text-[#c21d14]" />
            <div className="flex flex-col items-start min-w-0">
              <span className="text-xs text-gray-500 leading-none">التوصيل إلى</span>
              <span className="text-sm font-bold text-gray-900 leading-tight truncate max-w-[120px]">
                {selectedCity || 'اختر المنطقة'}
              </span>
            </div>
          </motion.button>
        </div>
      </div>

      {/* Featured Slider - Pass 'market' as position */}
      <div className="-mx-4">
        <FeaturedSlider position="market" type="supermarket" />
      </div>

      {/* Categories Horizontal Scroll - 6 visible per view */}
      <div className="bg-white py-6 overflow-hidden">
        {loading ? (
          <div className="px-4">
            <Swiper
              slidesPerView={5.5}
              spaceBetween={12}
              freeMode={true}
              modules={[FreeMode]}
              className="w-full"
            >
              {[...Array(12)].map((_, index) => (
                <SwiperSlide key={index}>
                  <div className="flex flex-col items-center gap-2 animate-pulse">
                    <div className="w-full aspect-square bg-gray-200 rounded-2xl"></div>
                    <div className="h-3 bg-gray-200 rounded w-3/4 mx-auto"></div>
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        ) : productCategories.length > 0 ? (
          <div className="px-4">
            <Swiper
              slidesPerView={5.5}
              spaceBetween={12}
              freeMode={true}
              modules={[FreeMode]}
              className="w-full"
              style={{ overflow: 'visible' }}
            >
              {productCategories.map((category, index) => (
                <SwiperSlide key={`cat-${category.id}`}>
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05, duration: 0.3 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleCategoryClick(category.id)}
                    className={`flex flex-col items-center gap-2 w-full ${
                      selectedCategory === category.id ? 'opacity-100' : 'opacity-90'
                    }`}
                  >
                    {/* Category Image */}
                    <div className={`w-full aspect-square rounded-lg overflow-hidden border border-gray-200 transition-all relative bg-gray-500 ${
                      selectedCategory === category.id
                        ? 'ring-2 ring-brand ring-offset-2'
                        : ''
                    }`}>
                      <img
                        src={category.image_url || getCategoryFallbackImage(category.name)}
                        alt={category.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = getCategoryFallbackImage(category.name);
                        }}
                      />

                      {/* Selected indicator */}
                      {selectedCategory === category.id && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute top-1 right-1 w-4 h-4 bg-brand rounded-full flex items-center justify-center shadow-lg"
                        >
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        </motion.div>
                      )}

                      {/* Gradient overlay */}
                      <div className={`absolute inset-0 transition-all duration-300 ${
                        selectedCategory === category.id
                          ? 'bg-brand/20'
                          : 'bg-black/10 hover:bg-black/5'
                      }`}></div>
                    </div>

                    {/* Category Name */}
                    <span className={`text-[10px] font-bold text-center leading-tight line-clamp-2 ${
                      selectedCategory === category.id
                        ? 'text-brand'
                        : 'text-gray-900'
                    }`}>
                      {category.name}
                    </span>
                  </motion.button>
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        ) : null}
      </div>

      {/* عروض التوصيل */}
      <DeliveryOffersCarousel
        onOfferClick={(offer) => {
          if (offer.vendor_id) {
            // Find vendor and open store page
            supabase
              .from('vendors')
              .select('*')
              .eq('id', offer.vendor_id)
              .single()
              .then(({ data, error }) => {
                if (data && !error) {
                  setSelectedVendor(data);
                }
              });
          }
        }}
        onViewAll={() => setShowAllOffers(true)}
      />

      {/* Vendors with Special Offers Section */}
      <VendorsWithOffers onVendorClick={setSelectedVendor} type="supermarket" selectedCity={selectedCity} />

      {!selectedCategory && (
        <>
          {/* Featured Vendors */}
          <div className="px-4 py-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">تسوق مع الـو جيتك</h2>
              <button
                onClick={() => setShowAllVendors(true)}
                className="text-brand hover:text-brand-light transition-colors text-sm font-medium flex items-center"
              >
                عرض الكل<ChevronLeft className="w-4 h-4 mr-1" />
              </button>
            </div>

            <FeaturedVendors onVendorClick={setSelectedVendor} type="supermarket" />
          </div>

          {/* Available Vendors */}
          {availableVendors.length > 0 && (
            <div className="w-full px-4 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">المتاجر المتوفرة</h2>
                <button
                  onClick={() => setShowAllVendors(true)}
                  className="text-brand hover:text-brand-light transition-colors text-sm font-medium flex items-center"
                >
                  عرض الكل <ChevronLeft className="w-4 h-4 mr-1" />
                </button>
              </div>
              <Swiper
                slidesPerView={2.2}
                spaceBetween={16}
                freeMode={true}
                modules={[FreeMode]}
                className="w-full"
                loop={false}
              >
                {availableVendors.map(vendor => (
                  <SwiperSlide key={vendor.id}>{renderVendorCard(vendor)}</SwiperSlide>
                ))}
              </Swiper>
            </div>
          )}
          
          {/* Category-Specific Vendors Carousels */}
          {vendorsByCategory.map(({ category, vendors }) => (
            <div key={category.id} className="w-full px-4 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-brand/20">
                    <img
                      src={category.image_url || getCategoryFallbackImage(category.name)}
                      alt={category.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = getCategoryFallbackImage(category.name);
                      }}
                    />
                  </div>
                  متاجر {category.name}
                </h2>
                <button
                  onClick={() => handleViewCategoryVendors(category.id, category.name)}
                  className="text-brand hover:text-brand-light transition-colors text-sm font-medium flex items-center bg-brand/10 px-3 py-1.5 rounded-full"
                >
                  عرض الكل ({vendors.length})
                  <ChevronLeft className="w-4 h-4 mr-1" />
                </button>
              </div>
              <Swiper
                slidesPerView={2.2}
                spaceBetween={16}
                freeMode={true}
                modules={[FreeMode]}
                className="w-full"
                loop={false}
              >
                {vendors.map(vendor => (
                  <SwiperSlide key={vendor.id}>{renderVendorCard(vendor)}</SwiperSlide>
                ))}
              </Swiper>
            </div>
          ))}
        </>
      )}
      
      {/* Category-Specific Vendors */}
      {selectedCategory && (
        <div className="w-full px-4 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              {productCategories.find(c => c.id === selectedCategory)?.name || 'متاجر التصنيف'}
            </h2>
            <button
              onClick={() => handleViewCategoryVendors(
                selectedCategory,
                productCategories.find(c => c.id === selectedCategory)?.name || 'متاجر التصنيف'
              )}
              className="text-accent hover:text-accent-light text-sm font-medium flex items-center"
            >
              عرض الكل <ChevronLeft className="w-4 h-4 mr-1" />
            </button>
          </div>
          <VendorsList 
            type="supermarket"
            categoryId={selectedCategory}
            limit={10}
            includeInactive={false}
          />
        </div>
      )}
      
      {/* Vendor Page Modal */}
      {selectedVendor && (
        <StorePage
          vendor={{
            id: selectedVendor.id,
            store_name: selectedVendor.store_name,
            banner: selectedVendor.banner_url,
            logo: selectedVendor.logo_url,
            rating: selectedVendor.rating,
            status: {
              is_open: selectedVendor.status === 'active'
            }
          }}
          categoryId={null}
          onClose={() => setSelectedVendor(null)}
        />
      )}

      {/* All Offers Page */}
      {showAllOffers && (
        <AllOffersPage
          onClose={() => setShowAllOffers(false)}
          onOfferClick={(offer) => {
            if (offer.vendor_id) {
              supabase
                .from('vendors')
                .select('*')
                .eq('id', offer.vendor_id)
                .single()
                .then(({ data, error }) => {
                  if (data && !error) {
                    setSelectedVendor(data);
                  }
                });
            }
          }}
        />
      )}
    </div>
  );
};

export default Supermarket;