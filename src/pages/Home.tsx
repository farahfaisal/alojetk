import React, { useState, useEffect } from 'react';
import { Home as HomeIcon, User, Store, Package, Bike, Circle, Menu, MapPin, Search, Clock, Headphones, ShoppingCart, Check, ChevronLeft, Star, Gift, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode } from 'swiper/modules';
import CategoriesSlider from '../components/CategoriesSlider';
import FeaturedVendors from '../components/FeaturedVendors';
import FeaturedSlider from '../components/FeaturedSlider';
import VendorsWithOffers from '../components/VendorsWithOffers';
import AllVendorsPage from '../components/AllVendorsPage';
import CategoryVendorsPage from '../components/CategoryVendorsPage';
import StorePage from '../components/StorePage';
import DeliveryOffersCarousel from '../components/DeliveryOffersCarousel';
import AllOffersPage from '../components/AllOffersPage';
import { supabase } from '../lib/supabase';

import 'swiper/css';
import 'swiper/css/free-mode';

interface HomeProps {
  selectedCategory: number | null;
  onCategorySelect: (categoryId: number | null) => void;
  selectedCity: string;
  viewMode: 'restaurants' | 'supermarket' | 'all';
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
  city?: string;
  type?: string;
}

const Home: React.FC<HomeProps> = ({
  selectedCategory,
  onCategorySelect,
  selectedCity,
  viewMode,
  onOpenSearch
}) => {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [showAllVendors, setShowAllVendors] = useState(false);
  const [showCategoryVendors, setShowCategoryVendors] = useState(false);
  const [selectedCategoryForVendors, setSelectedCategoryForVendors] = useState<{ id: number; name: string } | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vendorsByCategory, setVendorsByCategory] = useState<{
    category: ProductCategory;
    vendors: Vendor[];
  }[]>([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [showAllOffers, setShowAllOffers] = useState(false);

  // Fetch all main categories from database
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setCategoriesLoading(true);
        setError(null);
        
        console.log('🔍 Fetching categories for viewMode:', viewMode);
        
        let data, error;
        
        if (viewMode === 'restaurants') {
          // For restaurants, get subcategories that have parent "مطاعم"
          const { data: parentData, error: parentError } = await supabase
            .from('categories')
            .select('id')
            .eq('name', 'مطاعم')
            .single();
            
          if (parentError) {
            console.error('Error finding parent category "مطاعم":', parentError);
            // Fallback to main categories
            const fallbackResult = await supabase
              .from('categories')
              .select('*')
              .is('parent_id', null)
              .eq('type', 'restaurant')
              .order('name');
            data = fallbackResult.data;
            error = fallbackResult.error;
          } else {
            // Get subcategories with parent "مطاعم"
            const result = await supabase
              .from('categories')
              .select('*')
              .eq('parent_id', parentData.id)
              .order('name');
            data = result.data;
            error = result.error;
            
            console.log('📂 Found subcategories for مطاعم:', data);
          }
        } else if (viewMode === 'supermarket') {
          // For supermarket, get subcategories that have parent "ماركت"
          const { data: parentData, error: parentError } = await supabase
            .from('categories')
            .select('id')
            .eq('name', 'ماركت')
            .single();
            
          if (parentError) {
            console.error('Error finding parent category "ماركت":', parentError);
            // Fallback to main categories
            const fallbackResult = await supabase
              .from('categories')
              .select('*')
              .is('parent_id', null)
              .eq('type', 'supermarket')
              .order('name');
            data = fallbackResult.data;
            error = fallbackResult.error;
          } else {
            // Get subcategories with parent "ماركت"
            const result = await supabase
              .from('categories')
              .select('*')
              .eq('parent_id', parentData.id)
              .order('name');
            data = result.data;
            error = result.error;
          }
        } else {
          // For 'all' mode, get main categories
          const result = await supabase
            .from('categories')
            .select('*')
            .is('parent_id', null)
            .order('name');
          data = result.data;
          error = result.error;
        }

        if (error) {
          console.error('Error fetching categories:', error);
          setError('حدث خطأ في جلب التصنيفات');
          return;
        }

        console.log('📊 All categories fetched:', data);
        
        // Use the fetched data directly since we already filtered by parent
        const filteredCategories = data || [];
        console.log('🎯 Final categories for', viewMode, ':', filteredCategories);
        
        // Check specifically for burger category
        const burgerCategory = filteredCategories.find(cat => 
          cat.name.toLowerCase().includes('برجر') || 
          cat.name.toLowerCase().includes('burger')
        );
        
        if (burgerCategory) {
          console.log('🍔 Burger category found:', burgerCategory);
        } else {
          console.warn('⚠️ Burger category not found in database');
        }

        setCategories(filteredCategories);
      } catch (err: any) {
        console.error('Error fetching categories:', err);
        setError('حدث خطأ في جلب التصنيفات');
      } finally {
        setCategoriesLoading(false);
      }
    };

    fetchCategories();
  }, [viewMode]); // Re-fetch when viewMode changes

  // Fetch vendors by category for restaurants view
  useEffect(() => {
    if (viewMode === 'restaurants' && categories.length > 0) {
      const fetchVendorsByCategory = async () => {
        try {
          setVendorsLoading(true);
          const all: { category: ProductCategory; vendors: Vendor[] }[] = [];

          for (const category of categories) {
            // Step 1: Get all subcategories for this category
            const { data: subcategoriesData } = await supabase
              .from('categories')
              .select('id')
              .eq('parent_id', category.id);

            // Build array of category IDs (main category + all subcategories)
            const categoryIds = [category.id];
            if (subcategoriesData && subcategoriesData.length > 0) {
              categoryIds.push(...subcategoriesData.map(cat => cat.id));
            }

            // Step 2: Get products in this category and its subcategories
            const { data: productsData } = await supabase
              .from('products')
              .select('vendor_id')
              .in('category_id', categoryIds)
              .eq('status', 'active')
              .limit(10000);

            if (!productsData || productsData.length === 0) continue;

            // Get unique vendor IDs
            const vendorIds = [...new Set(productsData.map(p => p.vendor_id))];

            // Fetch vendors with type "مطاعم"
            const { data: vendorsData } = await supabase
              .from('vendors')
              .select('*')
              .eq('type', 'مطاعم')
              .in('id', vendorIds)
              .order('rating', { ascending: false })
              .limit(1000);

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
          setVendorsLoading(false);
        }
      };

      fetchVendorsByCategory();
    }
  }, [categories, viewMode]);
  const handleViewCategoryVendors = (categoryId: number, categoryName: string) => {
    setSelectedCategoryForVendors({ id: categoryId, name: categoryName });
    setShowCategoryVendors(true);
  };

  const handleCategoryClick = (categoryId: number) => {
    // Find the category name
    const categoryName = categories.find(c => c.id === categoryId)?.name || 'التصنيف';

    // Open category vendors page directly without filtering
    setSelectedCategoryForVendors({ id: categoryId, name: categoryName });
    setShowCategoryVendors(true);

    // Do NOT update selectedCategory to avoid filtering on main page
    // onCategorySelect(categoryId);
  };

  // Function to get fallback image based on category name
  const getCategoryFallbackImage = (categoryName: string) => {
    // استخدام لوجو التطبيق كصورة احتياطية للتصنيفات
    return 'https://rrhoxgfnikmtgsxwvjuv.supabase.co/storage/v1/object/public/general/WhatsApp%20Image%202025-09-23%20at%2000.16.28.jpeg';
  };

  if (showAllVendors) {
    return (
      <AllVendorsPage
        onClose={() => setShowAllVendors(false)}
        selectedCity={selectedCity}
        viewMode={viewMode}
        onViewModeChange={() => { }}
        onOpenCart={() => { }}
        onOpenAccount={() => { }}
        onOpenOrders={() => { }}
      />
    );
  }

  if (showCategoryVendors && selectedCategoryForVendors) {
    return (
      <CategoryVendorsPage
        onClose={() => setShowCategoryVendors(false)}
        selectedCity={selectedCity}
        viewMode={viewMode}
        onViewModeChange={() => { }}
        onOpenCart={() => { }}
        onOpenAccount={() => { }}
        onOpenOrders={() => { }}
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

      {/* Hero Banner Section */}
      <div className="-mx-4">
        <FeaturedSlider position="home" type="restaurant" />
      </div>

      {/* Categories Horizontal Scroll - 6 visible per view */}
      <div className="bg-white py-6 overflow-hidden">
        {categoriesLoading ? (
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
        ) : categories.length > 0 ? (
          <div className="px-4">
            <Swiper
              slidesPerView={5.5}
              spaceBetween={12}
              freeMode={true}
              modules={[FreeMode]}
              className="w-full"
              style={{ overflow: 'visible' }}
            >
              {categories.map((category, index) => (
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
                    <div className={`w-full aspect-square rounded-lg overflow-hidden border border-gray-200 transition-all relative bg-red-800 ${
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

      {/* Featured Vendors Section */}
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

        <FeaturedVendors onVendorClick={setSelectedVendor} type="restaurant" />
      </div>

      {/* Vendors with Special Offers Section */}
      <VendorsWithOffers onVendorClick={setSelectedVendor} type="restaurant" selectedCity={selectedCity} />

      {/* Category-Specific Restaurants Carousels - Only for restaurants view */}
      {viewMode === 'restaurants' && (
        <div className="space-y-8">
          {vendorsLoading ? (
            <div className="px-4 space-y-6">
              {[...Array(3)].map((_, index) => (
                <div key={index} className="space-y-4">
                  <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
                  <div className="flex gap-4 overflow-hidden">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="w-48 h-64 bg-gray-200 rounded-xl animate-pulse flex-shrink-0"></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            vendorsByCategory.map(({ category, vendors }) => (
              <div key={category.id} className="px-4">
                <div className="bg-white rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
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
                      مطاعم {category.name}
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
                    <SwiperSlide key={vendor.id}>
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
                          {(vendor.city || vendor.address) && (
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
                                    : 'bg-gray-500/90 text-white'
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
                  </Swiper>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Store Page Modal */}
      {selectedVendor && (
        <StorePage
          vendor={{
            id: selectedVendor.id,
            store_name: selectedVendor.store_name,
            banner: selectedVendor.banner_url,
            logo: selectedVendor.logo_url,
            rating: selectedVendor.rating,
            status: { is_open: selectedVendor.status === 'active' }
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

export default Home;