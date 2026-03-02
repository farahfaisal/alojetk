import React, { useState, useEffect } from 'react';
import { X, Search, Filter, ChevronDown, Star, MapPin, Clock, ShoppingBag, AlertCircle, ChevronLeft, Truck, Timer, CheckCircle, Edit3, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/free-mode';
import { supabase } from '../lib/supabase';
import StoreStatus from './StoreStatus';
import SingleProductPage from './SingleProductPage';
import CustomOrderModal from './CustomOrderModal';
import { calculateDistance, calculateDeliveryFee } from '../lib/delivery';
import { getSavedAddresses } from '../lib/storage';
import { checkVendorWorkingStatus, getStatusText, getTodayHours, convertWorkingHoursToArray, formatTime } from '../lib/store-hours';

interface StorePageProps {
  vendor: any;
  categoryId: number | string | null;
  onClose: () => void;
}

const StorePage: React.FC<StorePageProps> = ({ vendor, categoryId, onClose }) => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [showHoursModal, setShowHoursModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [newVendorData, setNewVendorData] = useState<any>(null);
  const [isVendorAvailable, setIsVendorAvailable] = useState(true);
  const [vendorStatusMessage, setVendorStatusMessage] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedCategoryType, setSelectedCategoryType] = useState<'regular' | 'custom' | null>(null);
  const [storeCategories, setStoreCategories] = useState<{id: string, name: string, type: 'regular' | 'custom'}[]>([]);
  const [showFilters, setShowFilters] = useState(true);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [deliveryInfo, setDeliveryInfo] = useState({
    fee: 0,
    time: '',
    minOrder: 0,
    freeDeliveryMin: null as number | null,
    isAccurate: false
  });
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [showCustomOrderModal, setShowCustomOrderModal] = useState(false);
  const [userAddress, setUserAddress] = useState<{address: string, city: string, latitude?: number, longitude?: number} | null>(null);

  // Don't auto-filter by category - show all products initially
  // useEffect(() => {
  //   if (categoryId !== null && categoryId !== undefined) {
  //     console.log('Setting initial category from props:', categoryId);
  //     setSelectedCategoryId(categoryId);
  //   }
  // }, [categoryId]);

  // Prevent body scrolling when store page is open
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('store-page-opened'));
    return () => {
      window.dispatchEvent(new CustomEvent('store-page-closed'));
    };
  }, []);

  // Get user address from saved addresses
  useEffect(() => {
    const fetchUserAddress = async () => {
      const addresses = await getSavedAddresses();
      const defaultAddress = addresses.find(addr => addr.isDefault) || addresses[0];

      if (defaultAddress) {
        console.log('📍 StorePage - تحميل العنوان الافتراضي:', defaultAddress);
        setUserAddress({
          address: defaultAddress.address,
          city: defaultAddress.city,
          latitude: defaultAddress.coordinates?.lat,
          longitude: defaultAddress.coordinates?.lng
        });
      } else {
        console.warn('⚠️ StorePage - لا يوجد عنوان محفوظ');
      }
    };

    fetchUserAddress();
  }, []);

  // Get user location from saved address
  useEffect(() => {
    if (userAddress?.latitude && userAddress?.longitude) {
      setUserLocation({
        lat: userAddress.latitude,
        lng: userAddress.longitude
      });
    } else {
      setUserLocation(null);
      console.warn('⚠️ لا يوجد موقع دقيق للعنوان المحفوظ');
    }
  }, [userAddress]);

  // Calculate delivery info
  useEffect(() => {
    const fetchDeliveryInfo = async () => {
      if (!vendor) return;

      let deliveryFee = 7;
      let estimatedTime = '';

      try {
        const selectedServiceArea = localStorage.getItem('selectedServiceArea');
        const selectedCity = localStorage.getItem('selectedCity');
        const areaName = selectedServiceArea || (selectedCity ? JSON.parse(selectedCity) : null);

        if (areaName) {
          const { data: serviceArea } = await supabase
            .from('service_areas')
            .select('id, delivery_price')
            .eq('name', areaName)
            .maybeSingle();

          if (serviceArea) {
            const { data: vendorServiceArea } = await supabase
              .from('vendor_service_areas')
              .select('custom_delivery_price')
              .eq('vendor_id', vendor.id)
              .eq('service_area_id', serviceArea.id)
              .maybeSingle();

            if (vendorServiceArea?.custom_delivery_price) {
              deliveryFee = vendorServiceArea.custom_delivery_price;
            } else if (serviceArea.delivery_price) {
              deliveryFee = serviceArea.delivery_price;
            }
          }
        }

        // استخدام وقت التحضير الثابت من البائع
        const prepTime = vendor.estimated_delivery_time || 30;

        // حساب الوقت الحقيقي إذا توفرت الإحداثيات الدقيقة
        if (userLocation && vendor.latitude && vendor.longitude) {
          const vendorLocation = {
            lat: vendor.latitude,
            lng: vendor.longitude
          };

          const distance = calculateDistance(userLocation, vendorLocation);
          const deliveryTime = Math.ceil(distance * 3); // 3 دقائق لكل كيلومتر

          console.log('📏 StorePage - حساب وقت التوصيل:', {
            userLocation,
            vendorLocation,
            distance: `${distance.toFixed(2)} كم`,
            prepTime: `${prepTime} دقيقة`,
            deliveryTime: `${deliveryTime} دقيقة`
          });

          const totalMinTime = prepTime + deliveryTime;
          const totalMaxTime = totalMinTime + 15;
          estimatedTime = `${totalMinTime}-${totalMaxTime}`;

          if (vendor.delivery_type === 'distance' && vendor.price_per_km) {
            deliveryFee = Math.max(deliveryFee, Math.ceil(distance * vendor.price_per_km));
          } else if (vendor.delivery_type === 'fixed' && vendor.delivery_fee_per_km) {
            deliveryFee = Math.max(deliveryFee, vendor.delivery_fee_per_km);
          } else if (vendor.delivery_zones && Array.isArray(vendor.delivery_zones)) {
            const zone = vendor.delivery_zones.find((z: any) => z.distance_km >= distance);
            if (zone) {
              deliveryFee = Math.max(deliveryFee, zone.cost);
            }
          }
        } else {
          // استخدام وقت التحضير الثابت من البائع
          const totalMaxTime = prepTime + 15;
          estimatedTime = `${prepTime}-${totalMaxTime}`;

          console.warn('⚠️ StorePage - لا يمكن حساب وقت التوصيل بدقة!', {
            hasUserLocation: !!userLocation,
            hasVendorLatitude: !!vendor.latitude,
            hasVendorLongitude: !!vendor.longitude,
            userLocation,
            vendorLatitude: vendor.latitude,
            vendorLongitude: vendor.longitude,
            vendorId: vendor.id,
            vendorName: vendor.store_name,
            usingEstimatedTime: estimatedTime
          });
        }
      } catch (error) {
        console.error('Error fetching delivery info:', error);
      }

      setDeliveryInfo({
        fee: deliveryFee,
        time: estimatedTime,
        minOrder: vendor.min_order_amount || 0,
        freeDeliveryMin: vendor.free_delivery_min || null,
        isAccurate: !!(userLocation && vendor.latitude && vendor.longitude)
      });
    };

    fetchDeliveryInfo();
  }, [vendor, userLocation]);

  // Listen for vendor page open events
  useEffect(() => {
    const handleOpenVendorPage = (event: CustomEvent) => {
      if (event.detail?.vendor) {
        const newVendor = event.detail.vendor;
        if (newVendor && newVendor.id) {
          setNewVendorData(newVendor);
        }
      }
    };
    
    window.addEventListener('open-vendor-page', handleOpenVendorPage as EventListener);
    
    return () => {
      window.removeEventListener('open-vendor-page', handleOpenVendorPage as EventListener);
    };
  }, [onClose]);
  
  // Handle new vendor data if set
  useEffect(() => {
    if (newVendorData) {
      onClose();
      window.dispatchEvent(new CustomEvent('open-new-vendor', { 
        detail: { vendor: newVendorData }
      }));
      setNewVendorData(null);
    }
  }, [newVendorData, onClose]);

  // Refresh vendor data from database to ensure up-to-date working hours
  useEffect(() => {
    const refreshVendorData = async () => {
      if (vendor?.id) {
        try {
          const { data: freshVendor, error } = await supabase
            .from('vendors')
            .select('working_hours, vacation_mode, status')
            .eq('id', vendor.id)
            .single();

          if (!error && freshVendor) {
            // Update vendor data with fresh values
            vendor.working_hours = freshVendor.working_hours;
            vendor.vacation_mode = freshVendor.vacation_mode;
            vendor.status = freshVendor.status;
          }
        } catch (error) {
          console.error('Error refreshing vendor data:', error);
        }
      }
    };

    refreshVendorData();
  }, [vendor?.id]);

  // Check vendor status including working hours
  useEffect(() => {
    if (vendor) {
      console.log('🔍 StorePage - فحص حالة المتجر:', {
        vendorId: vendor.id,
        storeName: vendor.store_name,
        working_hours: vendor.working_hours,
        vacation_mode: vendor.vacation_mode,
        status: vendor.status
      });

      const workingStatus = checkVendorWorkingStatus({
        working_hours: vendor.working_hours,
        vacation_mode: vendor.vacation_mode,
        status: vendor.status
      });

      console.log('✅ StorePage - نتيجة الفحص:', {
        is_open: workingStatus.is_open,
        reason: workingStatus.reason,
        today_hours: workingStatus.today_hours
      });

      setIsVendorAvailable(workingStatus.is_open);

      if (!workingStatus.is_open) {
        let message = 'المتجر مغلق حالياً';

        switch (workingStatus.reason) {
          case 'vacation':
            message = 'المتجر في إجازة';
            break;
          case 'closed_today':
            message = 'المتجر مغلق اليوم';
            break;
          case 'outside_hours':
            if (workingStatus.today_hours) {
              message = `المتجر مغلق حالياً، ساعات العمل: ${formatTime(workingStatus.today_hours.open)} - ${formatTime(workingStatus.today_hours.close)}`;
            } else {
              message = 'المتجر مغلق حالياً';
            }
            break;
          case 'suspended':
            message = 'المتجر معلق حالياً، لا يمكن الطلب منه في الوقت الحالي';
            break;
        }

        setVendorStatusMessage(message);
      } else {
        setVendorStatusMessage('');
      }
    }

    // Check status every minute
    const interval = setInterval(() => {
      if (vendor) {
        const workingStatus = checkVendorWorkingStatus({
          working_hours: vendor.working_hours,
          vacation_mode: vendor.vacation_mode,
          status: vendor.status
        });
        setIsVendorAvailable(workingStatus.is_open);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [vendor]);

  // Fetch store categories (both regular and custom)
  useEffect(() => {
    const fetchStoreCategories = async () => {
      try {
        if (!vendor.id) return;

        // Fetch products with both category types
        const { data, error } = await supabase
          .from('products')
          .select(`
            category:category_id(id, name),
            custom_category:custom_category_id(id, name)
          `)
          .eq('vendor_id', vendor.id)
          .eq('status', 'active');

        if (error) throw error;

        if (data) {
          const allCategories = new Map();

          // Add regular categories
          data
            .filter(item => item.category)
            .forEach(item => {
              allCategories.set(`regular_${item.category.id}`, {
                id: item.category.id,
                name: item.category.name,
                type: 'regular'
              });
            });

          // Add custom categories
          data
            .filter(item => item.custom_category)
            .forEach(item => {
              allCategories.set(`custom_${item.custom_category.id}`, {
                id: item.custom_category.id,
                name: item.custom_category.name,
                type: 'custom'
              });
            });

          setStoreCategories(Array.from(allCategories.values()));
        }
      } catch (err) {
        console.error('Error fetching store categories:', err);
      }
    };

    fetchStoreCategories();
  }, [vendor.id]);

  // Fetch all products initially
  useEffect(() => {
    const fetchAllProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('Fetching all products for vendor:', {
          vendorId: vendor.id,
          supabaseUrl: supabase.supabaseUrl
        });

        let query = supabase
          .from('products')
          .select(`
            *,
            vendor:vendor_id (
              id,
              store_name,
              logo_url,
              banner_url
            ),
            category:category_id (
              id,
              name,
              type
            ),
            custom_category:custom_category_id (
              id,
              name,
              description,
              color
            ),
            addons:product_addons (
              id,
              name,
              price,
              is_required,
              is_default,
              type
            )
          `)
          .eq('status', 'active')
          .eq('vendor_id', vendor.id);

        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('طلب البيانات استغرق وقتاً طويلاً')), 10000)
        );

        const { data, error: fetchError } = await Promise.race([
          query,
          timeoutPromise
        ]) as any;

        if (fetchError) {
          console.error('Supabase query error:', fetchError);
          throw fetchError;
        }

        if (!data) {
          console.warn('No products found for vendor:', vendor.id);
          setProducts([]);
          setCategories([]);
          setAllProducts([]);
          return;
        }

        console.log('Successfully fetched products:', {
          count: data.length,
          vendorId: vendor.id,
          initialCategoryId: categoryId
        });

        // Merge addons_data and variants_data with data from tables
        const productsWithAddons = data.map(product => {
          let mergedAddons = product.addons || [];
          let mergedVariants = product.variants || [];

          // If product has addons_data, use it only if there are no table addons
          if (product.addons_data && Array.isArray(product.addons_data)) {
            // Only use addons_data if table addons are empty
            if (mergedAddons.length === 0) {
              const addonsFromData = product.addons_data.map((addon: any, index: number) => ({
                id: addon.id || `addon-${product.id}-${index}`,
                name: addon.name,
                price: parseFloat(addon.price) || 0,
                is_required: addon.is_required || false,
                is_default: addon.is_default || false,
                type: addon.type || 'optional',
                image_url: addon.image_url || null
              }));
              mergedAddons = addonsFromData;
            }
          }

          // If product has variants_data, use it
          if (product.variants_data && Array.isArray(product.variants_data) && product.variants_data.length > 0) {
            mergedVariants = product.variants_data;
          }

          return {
            ...product,
            addons: mergedAddons,
            variants: mergedVariants
          };
        });

        setAllProducts(productsWithAddons);
        // Show all products initially (no category filter)
        filterAndGroupProducts(productsWithAddons, null, null, searchQuery);
      } catch (err) {
        console.error('Error in fetchAllProducts:', err);
        
        if (err instanceof TypeError && err.message === 'Failed to fetch') {
          setError('لا يمكن الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت الخاص بك.');
          return;
        }

        if (err instanceof Error && err.message.includes('timeout')) {
          setError('الخادم يستغرق وقتاً طويلاً للرد. يرجى المحاولة مرة أخرى.');
          return;
        }

        if (err instanceof Error && err.message.includes('supabase')) {
          setError('حدث خطأ في قاعدة البيانات. يرجى المحاولة مرة أخرى.');
          return;
        }

        setError(err instanceof Error ? err.message : 'حدث خطأ في جلب المنتجات');
      } finally {
        setLoading(false);
      }
    };

    fetchAllProducts();
  }, [vendor.id, searchQuery]);

  // Filter and group products when filters change
  useEffect(() => {
    if (allProducts.length > 0) {
      filterAndGroupProducts(allProducts, selectedCategoryId, selectedCategoryType, searchQuery);
    }
  }, [selectedCategoryId, selectedCategoryType, searchQuery, allProducts]);

  // Function to filter and group products
  const filterAndGroupProducts = (
    allProds: any[],
    categoryId: string | null,
    categoryType: 'regular' | 'custom' | null,
    query: string
  ) => {
    let filteredProducts = [...allProds];

    // Filter by category (regular or custom)
    if (categoryId && categoryType) {
      filteredProducts = filteredProducts.filter(product => {
        if (categoryType === 'regular') {
          return product.category?.id === categoryId;
        } else if (categoryType === 'custom') {
          return product.custom_category?.id === categoryId;
        }
        return false;
      });
    }

    // Filter by search query
    if (query) {
      filteredProducts = filteredProducts.filter(product =>
        product.name.toLowerCase().includes(query.toLowerCase())
      );
    }

    setProducts(filteredProducts);

    // Group products by category (regular or custom)
    const groupedProducts = filteredProducts.reduce((acc: { [key: string]: any }, product: any) => {
      // Check both regular and custom categories for grouping
      const categoriesToGroup = [];

      // Add regular category if exists
      if (product.category?.id && product.category?.name) {
        categoriesToGroup.push({
          id: product.category.id,
          name: product.category.name,
          type: 'regular'
        });
      }

      // Add custom category if exists
      if (product.custom_category?.id && product.custom_category?.name) {
        categoriesToGroup.push({
          id: product.custom_category.id,
          name: product.custom_category.name,
          type: 'custom'
        });
      }

      // Add product to all its categories
      categoriesToGroup.forEach(cat => {
        const key = `${cat.type}_${cat.id}`;
        if (!acc[key]) {
          acc[key] = {
            id: cat.id,
            name: cat.name,
            type: cat.type,
            products: []
          };
        }
        // Avoid duplicates
        if (!acc[key].products.find((p: any) => p.id === product.id)) {
          acc[key].products.push(product);
        }
      });

      return acc;
    }, {});

    setCategories(Object.values(groupedProducts));
  };

  const handleAddToCart = (productId: number, quantity: number, addons?: any[]) => {
    try {
      const product = products.find(p => p.id === productId);
      if (!product) return;

      if (!isVendorAvailable) {
        return;
      }

      // Check if there's a variant in the addons
      const variantInfo = addons?.find(addon => addon.isVariant);
      const regularAddons = addons?.filter(addon => !addon.isVariant) || [];

      // Determine base product price (use discount price if available)
      const baseProductPrice = product.discount_price && product.discount_price > 0
        ? product.discount_price
        : product.price;

      // Use variant price if available, otherwise use product base price
      // If variant exists and product has discount, apply same discount percentage to variant
      let finalPrice = baseProductPrice;
      if (variantInfo) {
        const variantPrice = variantInfo.variant_price;
        if (product.discount_price && product.discount_price > 0 && product.price > 0) {
          // Apply the same discount percentage to variant price
          const discountPercentage = (product.price - product.discount_price) / product.price;
          finalPrice = variantPrice * (1 - discountPercentage);
        } else {
          finalPrice = variantPrice;
        }
      }

      const finalName = variantInfo ? `${product.name} - ${variantInfo.variant_name}` : product.name;
      const cartItemId = variantInfo ? `${productId}_${variantInfo.variant_id}` : productId;

      const cartItems = localStorage.getItem('cartItems');
      let cart = cartItems ? JSON.parse(cartItems) : {};

      if (cart[cartItemId]) {
        cart[cartItemId].quantity += quantity;
        if (regularAddons && regularAddons.length > 0) {
          cart[cartItemId].addons = regularAddons.map(addon => ({
            id: addon.id,
            name: addon.name,
            price: addon.price,
            quantity: addon.quantity || 1,
            is_required: addon.is_required || false,
            is_default: addon.is_default || false,
            type: addon.type || (addon.is_required ? 'regular' : 'optional')
          }));
        }
      } else {
        const mappedAddons = regularAddons.map(addon => ({
          id: addon.id,
          name: addon.name,
          price: addon.price,
          quantity: addon.quantity || 1,
          is_required: addon.is_required || false,
          is_default: addon.is_default || false,
          type: addon.type || (addon.is_required ? 'regular' : 'optional')
        }));

        cart[cartItemId] = {
          id: cartItemId,
          product_id: product.id,
          name: finalName,
          price: finalPrice,
          quantity: quantity,
          image: product.image_url,
          vendor_id: vendor.id,
          vendor_name: vendor.store_name,
          variant_id: variantInfo?.variant_id,
          variant_name: variantInfo?.variant_name,
          addons: mappedAddons,
          preparation_time: product.preparation_time
        };
      }

      localStorage.setItem('cartItems', JSON.stringify(cart));
      setSelectedProduct(null);

      window.dispatchEvent(new Event('storage'));

      window.dispatchEvent(new CustomEvent('cart-item-added', {
        detail: { productName: finalName }
      }));
    } catch (error) {
      console.error('Error adding item to cart:', error);
    }
  };

  const handleCategoryClick = (catId: string | null, catType: 'regular' | 'custom' | null = null) => {
    setSelectedCategoryId(catId);
    setSelectedCategoryType(catType);
  };

  const handleShareStore = async () => {
    const shareText = `🍽️ أفضل الوجبات من الو جيتك\n\n${vendor.store_name}\n${vendor.description || 'متجر رائع يقدم أشهى المأكولات'}\n\n📍 ${vendor.address || ''}\n⭐ ${vendor.rating || 'جديد'}\n\nاطلب الآن!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${vendor.store_name} - الو جيتك`,
          text: shareText,
          url: window.location.href
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Error sharing:', error);
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareText}\n\n${window.location.href}`);
        alert('تم نسخ رابط المتجر إلى الحافظة!');
      } catch (error) {
        console.error('Error copying to clipboard:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-50 z-[99999] flex flex-col">
        <div className="animate-pulse p-4 space-y-8">
          <div className="h-48 bg-gray-200 rounded-xl"></div>
          <div className="space-y-4">
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-gray-50 z-[99999] flex items-center justify-center p-4">
        <div className="bg-red-50 text-red-800 p-6 rounded-xl flex flex-col items-center gap-4 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12" />
          <div>
            <h3 className="text-xl font-bold mb-2">حدث خطأ</h3>
            <p className="text-red-800/80">{error}</p>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-red-800 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div 
        className="fixed inset-0 bg-gray-50 z-[99999] overflow-y-auto" 
        data-store-page="true"
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'auto',
          touchAction: 'pan-y',
          height: '100dvh',
          minHeight: '100dvh',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0
        }}
      >
        <div className="min-h-full pb-32 scrollbar-hide modal-page-ios scrollable-content" style={{
          paddingBottom: 'calc(8rem + max(env(safe-area-inset-bottom), 34px))',
          minHeight: 'calc(100vh - env(safe-area-inset-top))',
          WebkitOverflowScrolling: 'touch',
          overflowY: 'auto',
          height: 'auto'
        }}>
          {/* Header with Back Button */}
          <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm" style={{
            top: 'max(env(safe-area-inset-top), 0px)'
          }}>
            <div className="flex items-center justify-between p-4">
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors text-gray-700 shadow-sm"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="font-medium">رجوع</span>
              </motion.button>
              
            
            </div>
          </div>

          {/* === HERO المطابق للتصميم === */}
          <div className="relative" style={{ marginTop: 'calc(72px + max(env(safe-area-inset-top), 0px))' }}>
            {/* بانر الصورة */}
            <div className="relative h-56 overflow-hidden">
              <img
                src={vendor.banner || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200"}
                alt={vendor.store_name}
                className="w-full h-full object-cover"
              />
            </div>

            {/* شريط رفيع أحمر تحت البانر (كما في الصورة) */}
            <div className="h-2 w-full bg-red-700" />

            {/* الطبقة الأمامية: شعار + شارات الوقت/السعر + حالة المتجر */}
            <div className="relative -mt-12 px-4">
              <div className="relative bg-transparent">

                {/* شارة الوقت في اليمين العلوي من الخط الأحمر */}
            <div className="absolute -top-10 right-4">
  <div className="w-20 h-20 rounded-full bg-white shadow-xl border-4 border-white flex flex-col items-center justify-center">
    <div className="w-full h-full rounded-full bg-gray-100 text-gray-800 flex flex-col items-center justify-center px-1">
      <div className="flex items-center gap-1">
        <span className="text-2xl font-extrabold">{deliveryInfo.fee}</span>
        <span className="text-[10px] font-medium">₪</span>
      </div>
      <span className="text-[9px] mt-[-2px] font-semibold text-gray-700 whitespace-nowrap">
        سعر التوصيل
      </span>
    </div>
  </div>
</div>

                {/* شارة "مفتوح" يسار تحت البانر */}
                <div className="absolute -top-6 left-4">
                  <span className={`px-4 py-1 rounded-full text-sm font-semibold shadow
                    ${isVendorAvailable ? 'bg-lime-500 text-white' : 'bg-red-700 text-white'}`}>
                    {isVendorAvailable ? 'مفتوح' : 'مغلق'}
                  </span>
                </div>

                {/* بطاقة معلومات رمادية فاتحة (الحاوية الرئيسية) */}
                <div className="relative bg-gray-100 rounded-2xl px-4 pb-6 pt-16 border border-gray-200">

                  {/* دائرة الشعار في المنتصف فوق البطاقة */}
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full bg-white border-4 border-red-700 shadow-xl overflow-hidden flex items-center justify-center">
                    <img
                      src={vendor.logo || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500"}
                      alt={vendor.store_name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* الدائرة الكبيرة (يسار) لعدد الدقائق */}
                 {/* الدائرة الكبيرة (يسار) لوقت التوصيل */}
<div className="absolute -top-10 left-4 flex flex-col items-center">
  <div className="w-20 h-20 rounded-full bg-white shadow-xl border-4 border-white flex items-center justify-center">
    {deliveryInfo.time ? (
      <div className="w-full h-full rounded-full bg-[#B50F2B] text-white flex items-center justify-center gap-1">
        <span className="text-2xl font-extrabold">
          {Number(deliveryInfo.time.split('-')[0])}
        </span>
        <span className="text-[10px] font-medium">دقيقة</span>
      </div>
    ) : (
      <div className="w-full h-full rounded-full bg-amber-500 text-white flex items-center justify-center">
        <AlertCircle className="w-8 h-8" />
      </div>
    )}
  </div>

  {/* النص تحت الدائرة */}
  <span className="text-[11px] font-semibold text-gray-700 mt-1">
    {deliveryInfo.time ? 'وقت التوصيل' : 'حدد موقعك'}
  </span>
</div>

                  {/* الدائرة الكبيرة (يمين) لسعر التوصيل */}
                {/* الدائرة الكبيرة (يمين) لسعر التوصيل */}
<div className="absolute -top-10 right-4 flex flex-col items-center">
  <div className="w-20 h-20 rounded-full bg-white shadow-xl border-4 border-white flex flex-col items-center justify-center">
    <div className="w-full h-full rounded-full bg-gray-100 text-gray-800 flex items-center justify-center gap-1">
      <span className="text-2xl font-extrabold">{deliveryInfo.fee}</span>
      <span className="text-[10px] font-medium">₪</span>
    </div>
  </div>
  <span className="text-[11px] font-semibold text-gray-700 mt-1">
    سعر التوصيل
  </span>
</div>


                  {/* اسم المتجر + العنوان */}
                  <div className="text-center mt-2">
                    <div className="flex items-center justify-center gap-3 mb-1">
                      <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                        {vendor.store_name}
                      </h1>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={handleShareStore}
                        className="w-10 h-10 bg-gradient-to-br from-[#B91C1C] to-[#991B1B] rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow"
                        aria-label="مشاركة المتجر"
                      >
                        <Share2 className="w-5 h-5 text-white" />
                      </motion.button>
                    </div>
                    <div className="mt-1 flex items-center justify-center gap-1 text-gray-600 text-sm">
                      <MapPin className="w-4 h-4 text-sky-600" />
                      <span>{vendor.address || 'الموقع غير محدد'}</span>
                    </div>
                  </div>

                  {/* شارة الميزات (توصيل – تغليف – طعام) */}
                  <div className="mt-4 flex items-center justify-center">
                    <div className="rounded-2xl bg-white shadow-sm border border-gray-200 px-4 py-2 flex items-center gap-6">
                      <div className="relative flex items-center">
                        <Truck className="w-5 h-5 text-gray-700" />
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-600 text-white rounded-full text-[10px] flex items-center justify-center">✓</span>
                      </div>
                      <div className="relative flex items-center">
                        <ShoppingBag className="w-5 h-5 text-gray-700" />
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-600 text-white rounded-full text-[10px] flex items-center justify-center">✓</span>
                      </div>
                      <div className="relative flex items-center">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded text-gray-700">🍽️</span>
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-600 text-white rounded-full text-[10px] flex items-center justify-center">✓</span>
                      </div>
                    </div>
                  </div>

                  {/* حالة المتجر وأوقات العمل */}
                  <div className="mt-4 bg-white rounded-xl shadow-sm border border-gray-200 px-4 py-3">
                    <button
                      onClick={() => setShowHoursModal(true)}
                      className="w-full flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-red-800" />
                        {isVendorAvailable ? (
                          <span className="font-semibold text-lime-600">مفتوح</span>
                        ) : (
                          <span className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold">مغلق</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const storeHours = convertWorkingHoursToArray(vendor.working_hours);
                          const todayHours = getTodayHours(storeHours);
                          if (todayHours && todayHours.enabled) {
                            return (
                              <span className="text-sm text-gray-600">
                                {`${formatTime(todayHours.open)} - ${formatTime(todayHours.close)}`}
                              </span>
                            );
                          }
                          return (
                            <span className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                              مغلق اليوم
                            </span>
                          );
                        })()}
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      </div>
                    </button>
                  </div>

                </div>
              </div>
            </div>

            {/* مسافة صغيرة قبل الأقسام التالية */}
            <div className="h-2 w-full bg-gray-100" />
          </div>

          {/* === نهاية الـ HERO ومعلومات المتجر === */}

          {/* Vendor Status Warning */}
          {!isVendorAvailable && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mx-4 mt-2">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-700 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-red-700 font-medium">المتجر غير متاح حالياً</p>
                  <p className="text-red-800 text-sm mt-1">{vendorStatusMessage}</p>
                </div>
              </div>
            </div>
          )}

          {/* Categories Filter */}
          <div className="bg-white shadow-sm mt-2 mx-4 rounded-xl">
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-red-800" />
                  <span className="font-medium text-gray-900">الأصناف</span>
                </div>
                <motion.button
                  animate={{ rotate: showFilters ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setShowFilters(!showFilters)}
                  className="text-gray-500"
                >
                  <ChevronDown className="w-5 h-5" />
                </motion.button>
              </div>
              
              {showFilters && (
                <div className="overflow-x-auto pb-2">
                  <div className="flex gap-2 min-w-max">
                    <button
                      onClick={() => handleCategoryClick(null, null)}
                      className={`px-4 py-2 rounded-full text-sm font-medium ${
                        selectedCategoryId === null
                          ? 'bg-red-800 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      } transition-colors whitespace-nowrap`}
                    >
                      الكل
                    </button>

                    {storeCategories.map(category => (
                      <button
                        key={`${category.type}_${category.id}`}
                        onClick={() => handleCategoryClick(category.id, category.type)}
                        className={`px-4 py-2 rounded-full text-sm font-medium ${
                          selectedCategoryId === category.id && selectedCategoryType === category.type
                            ? 'bg-red-800 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        } transition-colors whitespace-nowrap`}
                      >
                        {category.name}
                        {category.type === 'custom' && (
                          <span className="mr-1 text-xs opacity-75">★</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Products */}
          <div className="w-full px-4 pt-2 pb-32">
            {categories.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">لا توجد منتجات</h3>
                <p className="text-gray-500">لا توجد منتجات متاحة حالياً</p>
              </div>
            ) : selectedCategoryId !== null ? (
              <div className="space-y-3">
                {/* Show all products from selected category in a grid */}
                {(() => {
                  const selectedCategory = categories.find(c => c.id === selectedCategoryId);
                  if (!selectedCategory) return null;

                  return (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-xl font-bold text-gray-900">{selectedCategory.name}</h2>
                        <button
                          onClick={() => handleCategoryClick(null, null)}
                          className="text-brand hover:text-brand-light text-sm font-medium"
                        >
                          رجوع
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {selectedCategory.products.map((product: any) => (
                          <motion.div
                            key={product.id}
                            whileHover={{ scale: 1.02 }}
                            className="bg-white rounded-lg overflow-hidden border border-gray-200 transition-all cursor-pointer"
                            onClick={() => setSelectedProduct(product)}
                          >
                            {/* Product Image */}
                            <div className="relative h-40 overflow-hidden">
                              <img
                                src={product.image_url || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500"}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />

                              {/* Price Badge */}
                              <div className="absolute bottom-2 right-2 bg-brand text-white px-2 py-1 rounded-full text-sm font-bold">
                                {product.variants_data && product.variants_data.length > 0 ? (
                                  (() => {
                                    const prices = product.variants_data.map((v: any) => v.price);
                                    const minPrice = Math.min(...prices);
                                    const maxPrice = Math.max(...prices);
                                    return minPrice === maxPrice
                                      ? `₪${minPrice}`
                                      : `₪${minPrice} - ₪${maxPrice}`;
                                  })()
                                ) : (
                                  `₪${product.price}`
                                )}
                              </div>

                              {!isVendorAvailable && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                  <div className="bg-white/90 px-3 py-1 rounded-lg text-red-800 text-sm font-medium">
                                    غير متاح
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Product Info */}
                            <div className="p-3">
                              <h3 className="font-bold text-gray-900 mb-1 line-clamp-1 text-sm">{product.name}</h3>
                              {product.description && (
                                <p className="text-xs text-gray-600 mb-2 line-clamp-2">{product.description}</p>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Discounted Products Slider */}
                {(() => {
                  const discountedProducts = allProducts.filter(p =>
                    p.discount_price && p.discount_price > 0 && p.status === 'active'
                  );

                  if (discountedProducts.length === 0) return null;

                  return (
                    <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl p-4 border border-red-200">
                      {/* Category Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-red-600">
                            <ShoppingBag className="w-5 h-5 text-white" />
                          </div>
                          <h2 className="text-lg font-bold text-gray-900">خصومات خاصة</h2>
                        </div>
                      </div>

                      {/* Products Carousel */}
                      <Swiper
                        slidesPerView={1.8}
                        spaceBetween={16}
                        freeMode={true}
                        modules={[FreeMode]}
                        className="w-full"
                        loop={false}
                      >
                        {discountedProducts.map((product: any) => (
                          <SwiperSlide key={product.id}>
                            <motion.div
                              whileHover={{ scale: 1.02 }}
                              className="bg-white rounded-lg overflow-hidden border border-red-200 transition-all cursor-pointer h-full shadow-sm"
                              onClick={() => setSelectedProduct(product)}
                            >
                              {/* Product Image */}
                              <div className="relative h-40 overflow-hidden">
                                <img
                                  src={product.image_url || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500"}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                />

                                {/* Discount Badge */}
                                <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg">
                                  {Math.round(((product.price - product.discount_price) / product.price) * 100)}% خصم
                                </div>

                                {/* Price Badge */}
                                <div className="absolute bottom-2 right-2 flex flex-col items-end gap-1">
                                  <div className="bg-gray-800/80 text-white px-2 py-0.5 rounded-full text-xs line-through">
                                    ₪{product.price}
                                  </div>
                                  <div className="bg-red-600 text-white px-2 py-1 rounded-full text-sm font-bold">
                                    ₪{product.discount_price}
                                  </div>
                                </div>

                                {!isVendorAvailable && (
                                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                    <div className="bg-white/90 px-3 py-1 rounded-lg text-red-800 text-sm font-medium">
                                      غير متاح
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Product Info */}
                              <div className="p-4">
                                <h3 className="font-bold text-gray-900 mb-1 line-clamp-1 text-base">{product.name}</h3>
                                {product.description && (
                                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</p>
                                )}
                              </div>
                            </motion.div>
                          </SwiperSlide>
                        ))}
                      </Swiper>
                    </div>
                  );
                })()}

                {categories.map((category) => (
                  <div key={category.id} className="bg-white rounded-xl p-4 border border-gray-100">
                    {/* Category Header */}
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-lg font-bold text-gray-900">{category.name}</h2>
                      <button
                        onClick={() => {
                          // Open category page with all products
                          setSelectedCategoryId(category.id);
                        }}
                        className="text-brand hover:text-brand-light text-sm font-medium flex items-center gap-1"
                      >
                        عرض الكل
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Products Carousel */}
                    <Swiper
                      slidesPerView={1.8}
                      spaceBetween={16}
                      freeMode={true}
                      modules={[FreeMode]}
                      className="w-full"
                      loop={false}
                    >
                      {category.products.map((product: any) => (
                        <SwiperSlide key={product.id}>
                          <motion.div
                            whileHover={{ scale: 1.02 }}
                            className="bg-white rounded-lg overflow-hidden border border-gray-200 transition-all cursor-pointer h-full"
                            onClick={() => setSelectedProduct(product)}
                          >
                            {/* Product Image */}
                            <div className="relative h-40 overflow-hidden">
                              <img
                                src={product.image_url || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500"}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />

                              {/* Price Badge */}
                              <div className="absolute bottom-2 right-2 bg-brand text-white px-2 py-1 rounded-full text-sm font-bold">
                                {product.variants_data && product.variants_data.length > 0 ? (
                                  (() => {
                                    const prices = product.variants_data.map((v: any) => v.price);
                                    const minPrice = Math.min(...prices);
                                    const maxPrice = Math.max(...prices);
                                    return minPrice === maxPrice
                                      ? `₪${minPrice}`
                                      : `₪${minPrice} - ₪${maxPrice}`;
                                  })()
                                ) : (
                                  `₪${product.price}`
                                )}
                              </div>

                              {!isVendorAvailable && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                  <div className="bg-white/90 px-3 py-1 rounded-lg text-red-800 text-sm font-medium">
                                    غير متاح
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Product Info */}
                            <div className="p-4">
                              <h3 className="font-bold text-gray-900 mb-1 line-clamp-1 text-base">{product.name}</h3>
                              {product.description && (
                                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</p>
                              )}
                            </div>
                          </motion.div>
                        </SwiperSlide>
                      ))}
                    </Swiper>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Product Modal */}
        <AnimatePresence>
          {selectedProduct && (
            <SingleProductPage
              product={{
                ...selectedProduct,
                vendor: {
                  ...selectedProduct.vendor,
                  ...vendor,
                  working_hours: vendor.working_hours,
                  vacation_mode: vendor.vacation_mode,
                  status: vendor.status
                }
              }}
              onClose={() => setSelectedProduct(null)}
              onAddToCart={handleAddToCart}
            />
          )}
        </AnimatePresence>

        {/* Hours Modal */}
        <AnimatePresence>
          {showHoursModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-xl shadow-xl w-full max-w-md"
              >
                <div className="p-4 border-b flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">ساعات العمل</h2>
                  <button
                    onClick={() => setShowHoursModal(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <div className="p-4">
                  <StoreStatus vendorId={vendor.id} />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Custom Order Button - Hidden */}
        {/* <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
          onClick={() => setShowCustomOrderModal(true)}
          className="fixed bottom-24 left-4 z-[9997] bg-gradient-to-r from-yellow-500 to-orange-500 text-white p-4 rounded-full shadow-2xl hover:shadow-3xl transition-all hover:scale-110 active:scale-95 flex items-center gap-2"
          style={{
            bottom: 'calc(6rem + max(env(safe-area-inset-bottom), 0px))'
          }}
          title="طلب مخصص"
        >
          <Edit3 className="w-6 h-6" />
          <span className="font-bold text-sm">طلب خاص</span>
        </motion.button> */}

        {/* Custom Order Modal */}
        <AnimatePresence>
          {showCustomOrderModal && (
            <CustomOrderModal
              vendorId={vendor.id}
              vendorName={vendor.name}
              onClose={() => setShowCustomOrderModal(false)}
              userAddress={userAddress || undefined}
            />
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export default StorePage;