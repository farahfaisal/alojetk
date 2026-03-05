import React, { useState, useEffect } from 'react';
import { Store, AlertCircle, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode } from 'swiper/modules';
import { supabase } from '../lib/supabase';
import { useMediaQuery } from '../hooks/useMediaQuery';
import VendorsList from './VendorsList';

import 'swiper/css';
import 'swiper/css/free-mode';

interface Category {
  id: number;
  name: string;
  image_url?: string;
  products_count?: number;
  parent_id?: number;
}

interface CategoriesSliderProps {
  selectedCategory: number | null;
  onSelectCategory: (categoryId: number | null) => void;
  parentCategory?: string;
  columns?: number;
  showVendors?: boolean;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

// استخدام لوجو التطبيق كصورة احتياطية
const fallbackImage = 'https://rrhoxgfnikmtgsxwvjuv.supabase.co/storage/v1/object/public/general/WhatsApp%20Image%202025-09-23%20at%2000.16.28.jpeg';

const CategoriesSlider: React.FC<CategoriesSliderProps> = ({
  selectedCategory,
  onSelectCategory,
  parentCategory,
  columns = 3.5,
  showVendors = false
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [defaultCategories] = useState<Category[]>([
    { id: 101, name: "مطاعم", image_url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500&auto=format&fit=crop", products_count: 45 },
    { id: 102, name: "بيتزا", image_url: "https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=500&auto=format&fit=crop", products_count: 28 },
    { id: 103, name: "برجر", image_url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop", products_count: 32 },
    { id: 104, name: "مشاوي", image_url: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500&auto=format&fit=crop", products_count: 24 },
    { id: 105, name: "حلويات", image_url: "https://images.unsplash.com/photo-1587314168485-3236d6710814?w=500&auto=format&fit=crop", products_count: 18 }
  ]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const isMobile = useMediaQuery('(max-width: 640px)');
  const slidesPerView = isMobile ? 3 : columns;
  const [showCategoryVendors, setShowCategoryVendors] = useState<boolean>(false);

  const fetchCategoriesWithRetry = async (retryAttempt = 0) => {
    try {
      if (!parentCategory) {
        console.log('🔍 Using default categories since no parentCategory provided');
        setCategories(defaultCategories);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      
      console.log('🔍 Fetching categories for parent:', parentCategory);

      // First, let's check all categories to see what's available
      const { data: allCategories, error: allCategoriesError } = await supabase
        .from('categories')
        .select('*')
        .order('name');
        
      if (!allCategoriesError && allCategories) {
        console.log('📊 All available categories:', allCategories);
        
        // Check for burger category specifically
        const burgerCategories = allCategories.filter(cat => 
          cat.name.toLowerCase().includes('برجر') || 
          cat.name.toLowerCase().includes('burger')
        );
        console.log('🍔 Found burger categories:', burgerCategories);
      }

      const { data: parentData, error: parentError } = await supabase
        .from('categories')
        .select('id')
        .eq('name', parentCategory)
        .single();

      if (parentError) {
        console.error('Parent category error:', parentError);
        throw new Error(`خطأ في التصنيف الرئيسي: ${parentError.message}`);
      }
      
      console.log('📁 Parent category data:', parentData);

      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('parent_id', parentData.id)
        .order('name');

      if (error) {
        console.error('Subcategories fetch error:', error);
        throw new Error('فشل في جلب التصنيفات من قاعدة البيانات');
      }
      
      console.log('📂 Subcategories for', parentCategory, ':', data);

      setCategories(data || []);
      setRetryCount(0);
    } catch (err) {
      console.error('Categories fetch error:', err);
      if (retryAttempt < MAX_RETRIES) {
        setRetryCount(retryAttempt + 1);
        console.log(`🔄 Retrying... attempt ${retryAttempt + 1}/${MAX_RETRIES}`);
        setTimeout(() => fetchCategoriesWithRetry(retryAttempt + 1), RETRY_DELAY);
      } else {
        console.log('❌ Max retries reached, using default categories');
        setCategories(defaultCategories);
        setError("تعذر تحميل التصنيفات. تم عرض التصنيفات الافتراضية.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategoriesWithRetry();
  }, [parentCategory]);

  const handleRetry = () => {
    setRetryCount(0);
    fetchCategoriesWithRetry();
  };

  const handleCategorySelect = (categoryId: number | null) => {
    onSelectCategory(categoryId);
    setShowCategoryVendors(!!categoryId && showVendors);
  };

  if (loading) {
    return (
      <Swiper slidesPerView="auto" spaceBetween={12} freeMode modules={[FreeMode]} className="w-full">
        {[...Array(5)].map((_, index) => (
          <SwiperSlide key={index} className="w-[120px]">
            <div className="flex flex-col items-center gap-2 animate-pulse">
              <div className="w-28 h-28 bg-gray-200 rounded-full"></div>
              <div className="w-16 h-4 bg-gray-200 rounded"></div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    );
  }

  if (error) {
    return (
      <div className="bg-[#b91c1c]/10 text-[#b91c1c] p-4 rounded-xl flex items-center gap-2 mb-4">
        <AlertCircle className="w-5 h-5" />
        <div className="flex-1">{error}</div>
        <button onClick={handleRetry} className="px-3 py-1 bg-[#b91c1c]/10 rounded-lg hover:bg-[#b91c1c]/20">
          <RefreshCw className="w-4 h-4 inline-block" /> إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Swiper slidesPerView="auto" spaceBetween={12} freeMode modules={[FreeMode]} className="w-full" loop={false}>
        <SwiperSlide className="w-[120px]">
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => handleCategorySelect(null)} className="flex flex-col items-center gap-2 w-full">
            <div className={`w-28 h-28 rounded-full bg-gradient-to-br from-brand to-brand-light flex items-center justify-center ${
              !selectedCategory ? 'ring-4 ring-brand' : ''
            }`}>
              <Store className="w-14 h-14 text-white" />
            </div>
            <span className="text-sm font-medium text-gray-800">الكل</span>
          </motion.button>
        </SwiperSlide>

        {categories.map((category) => (
          <SwiperSlide key={category.id} className="w-[120px]">
            <motion.button
              whileHover={{
                scale: 1.05,
                boxShadow: "0 8px 20px rgba(194, 29, 20, 0.25)"
              }}
              whileTap={{
                scale: 0.95,
                backgroundColor: "rgba(194, 29, 20, 0.1)",
                transition: { duration: 0.1 }
              }}
              onClick={() => handleCategorySelect(category.id)}
              className="flex flex-col items-center gap-2 w-full relative"
            >
              <div className={`w-28 h-28 rounded-full overflow-hidden border-3 transition-all duration-300 ${
                selectedCategory === category.id
                  ? 'border-brand shadow-lg shadow-red-500/30 ring-4 ring-red-200'
                  : 'border-gray-300 hover:border-[#b91c1c]'
              }`}>
                <img
                  loading="lazy"
                  src={category.image_url || fallbackImage}
                  alt={category.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = fallbackImage;
                  }}
                />
                
                {/* Selected overlay */}
                {selectedCategory === category.id && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 bg-[#b91c1c]/20 flex items-center justify-center"
                  >
                    <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-lg">
                      <div className="w-3 h-3 bg-[#b91c1c] rounded-full"></div>
                    </div>
                  </motion.div>
                )}
              </div>
              
              <span className={`text-sm font-semibold transition-colors ${
                selectedCategory === category.id
                  ? 'text-brand font-bold'
                  : 'text-gray-800'
              }`}>
                {category.name}
              </span>

              {category.products_count && (
                <span className={`text-xs transition-colors ${
                  selectedCategory === category.id
                    ? 'text-[#b91c1c] font-medium'
                    : 'text-gray-500'
                }`}>
                  {category.products_count} منتج
                </span>
              )}
              
              {/* Click ripple effect */}
              <motion.div
                className="absolute inset-0 bg-[#b91c1c] rounded-2xl opacity-0 pointer-events-none"
                animate={{
                  scale: selectedCategory === category.id ? [1, 1.3, 1] : 1,
                  opacity: selectedCategory === category.id ? [0.2, 0, 0] : 0
                }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </motion.button>
          </SwiperSlide>
        ))}
      </Swiper>

      {showCategoryVendors && selectedCategory && (
        <div className="mt-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            {categories.find(c => c.id === selectedCategory)?.name || 'المتاجر المتوفرة'}
          </h2>
          <VendorsList categoryId={selectedCategory} limit={6} />
        </div>
      )}
    </div>
  );
};

export default CategoriesSlider;
