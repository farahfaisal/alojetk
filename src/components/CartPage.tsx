import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, Trash2, X, MapPin, CreditCard, Wallet, DollarSign, Clock, Truck, AlertCircle, Check, ChevronLeft, Store, Package, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { calculateDistance, calculateDeliveryFee } from '../lib/delivery';
import { getCustomerWalletBalance, checkWalletBalance } from '../lib/wallet';
import AddressSelector from './AddressSelector';
import AddressForm from './AddressForm';
import { SavedAddress, getSavedAddresses } from '../lib/storage';
import CheckoutPage from './CheckoutPage';
import BottomNav from './BottomNav';

interface CartItem {
  id: string;
  product_id: string | null;
  name: string;
  price: number;
  quantity: number;
  image?: string | null;
  vendor_id: string;
  vendor_name: string;
  addons?: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    type?: string;
  }>;
  variant_id?: string;
  variant_name?: string;
  preparation_time?: number;
  is_custom?: boolean;
  custom_details?: string;
}

interface CartPageProps {
  onClose: () => void;
  selectedCity?: string;
  onOpenAccount?: () => void;
  onOpenOrders?: () => void;
  onNavigateHome?: () => void;
}

const CartPage: React.FC<CartPageProps> = ({
  onClose,
  selectedCity,
  onOpenAccount,
  onOpenOrders,
  onNavigateHome
}) => {
  const { user, isAuthenticated } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deliveryFee, setDeliveryFee] = useState(7);
  const [totalDeliveryFee, setTotalDeliveryFee] = useState(7);
  const [selectedAddress, setSelectedAddress] = useState<SavedAddress | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [showAddressSelector, setShowAddressSelector] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'wallet'>('cash');
  const [walletBalance, setWalletBalance] = useState(0);
  const [notes, setNotes] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [vendorInfo, setVendorInfo] = useState<any>(null);
  const [vendorsInfo, setVendorsInfo] = useState<{[vendorId: string]: any}>({});
  const [estimatedTime, setEstimatedTime] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [serviceAreaVersion, setServiceAreaVersion] = useState(0);

  // Track totalDeliveryFee changes
  useEffect(() => {
    console.log('📊 CartPage - totalDeliveryFee changed to:', totalDeliveryFee);
  }, [totalDeliveryFee]);

  // Track deliveryFee changes
  useEffect(() => {
    console.log('💵 CartPage - deliveryFee changed to:', deliveryFee);
  }, [deliveryFee]);

  // Track serviceAreaVersion changes
  useEffect(() => {
    console.log('🔢 CartPage - serviceAreaVersion changed to:', serviceAreaVersion);
  }, [serviceAreaVersion]);

  // Listen for service area changes
  useEffect(() => {
    const handleServiceAreaChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      console.log('🔄 منطقة الخدمة تغيرت:', customEvent.detail?.areaName);
      setServiceAreaVersion(prev => prev + 1);
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'selectedServiceArea' || e.key === 'selectedCity') {
        console.log('🔄 منطقة الخدمة تغيرت من storage:', e.newValue);
        setServiceAreaVersion(prev => prev + 1);
      }
    };

    window.addEventListener('serviceAreaChanged', handleServiceAreaChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('serviceAreaChanged', handleServiceAreaChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Calculate estimated delivery time is now handled in the main delivery calculation
  // This useEffect is removed to avoid using default/estimated times

  // Calculate multi-vendor delivery fee
  useEffect(() => {
    const calculateMultiVendorDeliveryFee = async () => {
      const vendorCount = new Set(cartItems.map(item => item.vendor_id)).size;

      console.log('🚚 CartPage - Calculating delivery fee:', {
        vendorCount,
        deliveryFee,
        cartItemsCount: cartItems.length
      });

      if (vendorCount <= 1) {
        console.log('🚚 CartPage - Single vendor - Setting totalDeliveryFee to:', deliveryFee);
        setTotalDeliveryFee(deliveryFee);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('calculate_multi_vendor_delivery_fee', {
          base_delivery_fee: deliveryFee,
          vendor_count: vendorCount
        });

        if (error) throw error;
        console.log('🚚 CartPage - Multi-vendor delivery fee calculated:', data);
        setTotalDeliveryFee(data || deliveryFee);
      } catch (error) {
        console.error('Error calculating multi-vendor delivery fee:', error);
        // Fallback to base fee + 5 per additional vendor
        const fallbackFee = deliveryFee + ((vendorCount - 1) * 5);
        console.log('🚚 CartPage - Using fallback fee:', fallbackFee);
        setTotalDeliveryFee(fallbackFee);
      }
    };

    if (cartItems.length > 0) {
      calculateMultiVendorDeliveryFee();
    }
  }, [cartItems, deliveryFee]);

  // Load cart items from localStorage
  useEffect(() => {
    const loadCartItems = () => {
      try {
        const storedItems = localStorage.getItem('cartItems');
        if (storedItems) {
          const parsedItems = JSON.parse(storedItems);

          // Update old cart items to include type field for addons
          let hasUpdates = false;
          Object.keys(parsedItems).forEach(key => {
            const item = parsedItems[key];
            if (item.addons && Array.isArray(item.addons)) {
              item.addons = item.addons.map((addon: any) => {
                // Always recalculate type based on is_required to fix any old data
                // Only required addons are shown as components (المكونات)
                // Default and optional addons are shown as optional addons (الإضافات الاختيارية)
                const addonType = addon.is_required ? 'regular' : 'optional';
                if (addon.type !== addonType) {
                  hasUpdates = true;
                }
                return { ...addon, type: addonType };
              });
            }
          });

          // Save updated cart if there were changes
          if (hasUpdates) {
            localStorage.setItem('cartItems', JSON.stringify(parsedItems));
          }

          const itemsArray = Object.values(parsedItems) as CartItem[];
          setCartItems(itemsArray);

          // Load vendor info if items exist
          if (itemsArray.length > 0) {
            loadVendorInfo(itemsArray[0].vendor_id);
            // Load all vendors info
            loadAllVendorsInfo(itemsArray);
          }
        }
      } catch (error) {
        console.error('Error loading cart items:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCartItems();

    // Listen for storage changes
    window.addEventListener('storage', loadCartItems);
    return () => window.removeEventListener('storage', loadCartItems);
  }, []);

  // Load vendor information
  const loadVendorInfo = async (vendorId: string) => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', vendorId)
        .single();

      if (error) throw error;
      setVendorInfo(data);

      // Set preparation time from vendor data
      if (data?.estimated_delivery_time) {
        const prepTime = data.estimated_delivery_time;
        setEstimatedTime(`${prepTime}-${prepTime + 15}`);
      }
    } catch (error) {
      console.error('Error loading vendor info:', error);
    }
  };

  // Load all vendors information
  const loadAllVendorsInfo = async (items: CartItem[]) => {
    try {
      const vendorIds = [...new Set(items.map(item => item.vendor_id))];

      const { data, error } = await supabase
        .from('vendors')
        .select('id, store_name, logo_url')
        .in('id', vendorIds);

      if (error) throw error;

      const vendorsMap: {[vendorId: string]: any} = {};
      data?.forEach(vendor => {
        vendorsMap[vendor.id] = vendor;
      });

      setVendorsInfo(vendorsMap);
    } catch (error) {
      console.error('Error loading vendors info:', error);
    }
  };

  // Load user's wallet balance
  useEffect(() => {
    const loadWalletBalance = async () => {
      const customerId = user?.customer_id || user?.id;
      if (customerId) {
        try {
          const balance = await getCustomerWalletBalance(customerId);
          setWalletBalance(balance);
        } catch (error) {
          console.error('Error loading wallet balance:', error);
        }
      }
    };

    if (isAuthenticated) {
      loadWalletBalance();
    }
  }, [user, isAuthenticated]);

  // Load default address
  useEffect(() => {
    const loadDefaultAddress = async () => {
      if (!isAuthenticated) return;

      const addresses = await getSavedAddresses();
      console.log('📍 Loaded addresses:', addresses);

      const defaultAddress = addresses.find(addr => addr.isDefault === true);
      console.log('📍 Default address found:', defaultAddress);

      if (defaultAddress) {
        setSelectedAddress(defaultAddress);
      } else if (addresses.length > 0) {
        // If no default, use first address
        setSelectedAddress(addresses[0]);
      }
    };
    loadDefaultAddress();
  }, [isAuthenticated]);

  // Calculate delivery fee based on distance and service area
  useEffect(() => {
    const calculateDelivery = async () => {
      console.log('🔄 بدء حساب سعر التوصيل...');
      console.log('📍 بيانات العنوان المختار:', {
        address: selectedAddress?.address,
        serviceAreaName: selectedAddress?.serviceAreaName,
        serviceAreaId: selectedAddress?.serviceAreaId,
        coordinates: selectedAddress?.coordinates
      });

      if (!vendorInfo) {
        console.log('⚠️ لا توجد بيانات للبائع');
        return;
      }

      try {
        let fee = 7;
        let deliveryTime = null; // سيكون null إذا لم تتوفر بيانات دقيقة
        const prepTime = vendorInfo.estimated_delivery_time || 30;

        // Use service area from selected address first, then fall back to localStorage
        let areaName = selectedAddress?.serviceAreaName;

        if (!areaName) {
          const selectedServiceArea = localStorage.getItem('selectedServiceArea');
          const selectedCity = localStorage.getItem('selectedCity');
          areaName = selectedServiceArea || (selectedCity ? JSON.parse(selectedCity) : null);
          console.log('⚠️ لم يتم العثور على منطقة الخدمة في العنوان، استخدام localStorage:', areaName);
        }

        console.log('🌍 حساب سعر التوصيل للمنطقة:', areaName, '(من العنوان:', selectedAddress?.serviceAreaName, ')');

        if (areaName) {
          const { data: serviceArea, error: areaError } = await supabase
            .from('service_areas')
            .select('id, delivery_price')
            .eq('name', areaName)
            .maybeSingle();

          console.log('📍 بيانات منطقة الخدمة:', { serviceArea, areaError });

          if (serviceArea) {
            const { data: vendorServiceArea, error: vendorAreaError } = await supabase
              .from('vendor_service_areas')
              .select('custom_delivery_price')
              .eq('vendor_id', vendorInfo.id)
              .eq('service_area_id', serviceArea.id)
              .maybeSingle();

            console.log('🏪 سعر التوصيل المخصص للبائع:', { vendorServiceArea, vendorAreaError });

            if (vendorServiceArea?.custom_delivery_price) {
              fee = vendorServiceArea.custom_delivery_price;
              console.log('✅ استخدام سعر البائع المخصص:', fee);
            } else if (serviceArea.delivery_price) {
              fee = serviceArea.delivery_price;
              console.log('✅ استخدام سعر المنطقة:', fee);
            } else {
              console.log('⚠️ لا يوجد سعر مخصص، استخدام السعر الافتراضي:', fee);
            }
          } else {
            console.log('⚠️ لم يتم العثور على منطقة الخدمة');
          }
        } else {
          console.log('⚠️ لم يتم اختيار منطقة خدمة');
        }

        // حساب الوقت الحقيقي فقط إذا توفرت الإحداثيات الدقيقة
        if (selectedAddress?.coordinates && vendorInfo.latitude && vendorInfo.longitude) {
          const userLocation = selectedAddress.coordinates;
          const vendorLocation = {
            lat: vendorInfo.latitude,
            lng: vendorInfo.longitude
          };

          const distance = calculateDistance(userLocation, vendorLocation);
          deliveryTime = Math.ceil(distance * 3); // 3 دقائق لكل كيلومتر

          console.log('📏 حساب وقت التوصيل:', {
            userLocation,
            vendorLocation,
            distance: `${distance.toFixed(2)} كم`,
            deliveryTime: `${deliveryTime} دقيقة`
          });

          if (vendorInfo.delivery_type === 'distance' && vendorInfo.price_per_km) {
            fee = Math.max(fee, Math.ceil(distance * vendorInfo.price_per_km));
          } else if (vendorInfo.delivery_fee_per_km) {
            fee = Math.max(fee, vendorInfo.delivery_fee_per_km);
          }
        } else {
          console.log('⚠️ لا يمكن حساب وقت التوصيل بدقة:', {
            hasAddressCoordinates: !!selectedAddress?.coordinates,
            hasVendorLatitude: !!vendorInfo.latitude,
            hasVendorLongitude: !!vendorInfo.longitude
          });
        }

        // تحديث الوقت التقديري
        if (deliveryTime !== null) {
          const totalMinTime = prepTime + deliveryTime;
          const totalMaxTime = totalMinTime + 15;
          setEstimatedTime(`${totalMinTime}-${totalMaxTime}`);
        } else {
          // استخدام وقت التحضير من البائع
          const totalMaxTime = prepTime + 15;
          setEstimatedTime(`${prepTime}-${totalMaxTime}`);
        }

        console.log('💰 سعر التوصيل النهائي:', fee);
        setDeliveryFee(fee);
      } catch (error) {
        console.error('Error calculating delivery:', error);
        setDeliveryFee(7);
        // استخدام وقت التحضير من البائع في حالة الخطأ
        if (vendorInfo?.estimated_delivery_time) {
          const prepTime = vendorInfo.estimated_delivery_time;
          const totalMaxTime = prepTime + 15;
          setEstimatedTime(`${prepTime}-${totalMaxTime}`);
        }
      }
    };

    calculateDelivery();
  }, [selectedAddress, vendorInfo, selectedCity, serviceAreaVersion]);

  const updateCartItem = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeCartItem(itemId);
      return;
    }

    try {
      const storedItems = localStorage.getItem('cartItems');
      if (storedItems) {
        const parsedItems = JSON.parse(storedItems);
        if (parsedItems[itemId]) {
          parsedItems[itemId].quantity = quantity;
          localStorage.setItem('cartItems', JSON.stringify(parsedItems));

          // Update local state
          const itemsArray = Object.values(parsedItems) as CartItem[];
          setCartItems(itemsArray);

          // Dispatch storage event
          window.dispatchEvent(new Event('storage'));
          window.dispatchEvent(new CustomEvent('cartUpdated'));
        }
      }
    } catch (error) {
      console.error('Error updating cart item:', error);
    }
  };

  const removeCartItem = (itemId: string) => {
    try {
      const storedItems = localStorage.getItem('cartItems');
      if (storedItems) {
        const parsedItems = JSON.parse(storedItems);
        delete parsedItems[itemId];

        // If cart is empty after deletion, remove the key entirely
        if (Object.keys(parsedItems).length === 0) {
          localStorage.removeItem('cartItems');
        } else {
          localStorage.setItem('cartItems', JSON.stringify(parsedItems));
        }

        // Update local state
        const itemsArray = Object.values(parsedItems) as CartItem[];
        setCartItems(itemsArray);

        // Dispatch storage event
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('cartUpdated'));
      }
    } catch (error) {
      console.error('Error removing cart item:', error);
    }
  };

  const clearCart = () => {
    localStorage.removeItem('cartItems');
    setCartItems([]);
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('cartUpdated'));
  };

  const calculateSubtotal = () => {
    return cartItems.reduce((total, item) => {
      const itemPrice = item.price || 0;
      const itemTotal = itemPrice * item.quantity;
      const addonsTotal = (item.addons || []).reduce((sum, addon) => {
        const addonPrice = addon.price || 0;
        const addonQuantity = addon.quantity || 1;
        return sum + (addonPrice * addonQuantity);
      }, 0);

      console.log('🛒 Item:', {
        name: item.name,
        price: itemPrice,
        quantity: item.quantity,
        itemTotal,
        addonsTotal
      });

      return total + itemTotal + addonsTotal;
    }, 0);
  };

  const calculateItemsOnly = () => {
    return cartItems.reduce((total, item) => {
      const itemPrice = item.price || 0;
      const itemTotal = itemPrice * item.quantity;
      return total + itemTotal;
    }, 0);
  };

  const calculateAddonsOnly = () => {
    return cartItems.reduce((total, item) => {
      const addonsTotal = (item.addons || []).reduce((sum, addon) => {
        const addonPrice = addon.price || 0;
        const addonQuantity = addon.quantity || 1;
        return sum + (addonPrice * addonQuantity);
      }, 0);
      return total + addonsTotal;
    }, 0);
  };

  const calculateDiscount = () => {
    if (!appliedCoupon) return 0;

    const subtotal = calculateSubtotal();
    let discount = 0;

    if (appliedCoupon.type === 'percentage') {
      discount = (subtotal * appliedCoupon.value) / 100;
      if (appliedCoupon.max_discount && discount > appliedCoupon.max_discount) {
        discount = appliedCoupon.max_discount;
      }
    } else if (appliedCoupon.type === 'fixed') {
      discount = appliedCoupon.value;
    }

    return Math.min(discount, subtotal);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const discount = calculateDiscount();

    console.log('💰 Cart Calculation STEP BY STEP:', {
      'subtotal': subtotal,
      'totalDeliveryFee': totalDeliveryFee,
      'discount': discount,
      'calculation': `${subtotal} + ${totalDeliveryFee} - ${discount}`,
      'result': subtotal + totalDeliveryFee - discount
    });

    const total = subtotal + totalDeliveryFee - discount;

    console.log('💰 Cart Final Total:', total);

    return total;
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('الرجاء إدخال كود الكوبون');
      return;
    }

    setApplyingCoupon(true);
    setCouponError('');

    try {
      console.log('🎫 محاولة تطبيق الكوبون:', couponCode.trim());

      const { data: coupon, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', couponCode.trim())
        .eq('status', 'active')
        .maybeSingle();

      console.log('🎫 نتيجة البحث عن الكوبون:', { coupon, error });

      if (error) {
        console.error('🎫 خطأ في البحث عن الكوبون:', error);
        throw error;
      }

      if (!coupon) {
        console.log('🎫 الكوبون غير موجود أو غير نشط');
        setCouponError('الكوبون غير صالح أو منتهي الصلاحية');
        return;
      }

      // Check if coupon is within date range
      const now = new Date();
      const startDate = new Date(coupon.start_date);
      const endDate = new Date(coupon.end_date);

      console.log('🎫 فحص التواريخ:', {
        now: now.toISOString(),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        isAfterStart: now >= startDate,
        isBeforeEnd: now <= endDate
      });

      if (now < startDate || now > endDate) {
        console.log('🎫 الكوبون منتهي الصلاحية أو لم يبدأ بعد');
        setCouponError('الكوبون غير صالح أو منتهي الصلاحية');
        return;
      }

      // Check if coupon has reached usage limit
      if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
        console.log('🎫 تم استخدام الكوبون بالكامل:', { used_count: coupon.used_count, usage_limit: coupon.usage_limit });
        setCouponError('لقد تم استخدام هذا الكوبون بالكامل');
        return;
      }

      // Check minimum order amount
      const subtotal = calculateSubtotal();
      console.log('🎫 فحص الحد الأدنى للطلب:', {
        subtotal,
        min_order_amount: coupon.min_order_amount,
        isValid: !coupon.min_order_amount || subtotal >= coupon.min_order_amount
      });

      if (coupon.min_order_amount && subtotal < coupon.min_order_amount) {
        console.log('🎫 لم يتم الوصول إلى الحد الأدنى للطلب');
        setCouponError(`الحد الأدنى للطلب ${coupon.min_order_amount.toFixed(2)} شيكل`);
        return;
      }

      console.log('✅ تم تطبيق الكوبون بنجاح!');
      setAppliedCoupon(coupon);
      setCouponCode('');
      setCouponError('');
    } catch (error) {
      console.error('❌ خطأ في تطبيق الكوبون:', error);
      setCouponError('حدث خطأ في تطبيق الكوبون');
    } finally {
      setApplyingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  const groupItemsByVendor = () => {
    const grouped: { [vendorId: string]: CartItem[] } = {};
    cartItems.forEach(item => {
      if (!grouped[item.vendor_id]) {
        grouped[item.vendor_id] = [];
      }
      grouped[item.vendor_id].push(item);
    });
    return grouped;
  };

  const handleAddressSelect = async (address: SavedAddress) => {
    console.log('🏠 العنوان المختار:', address);
    console.log('🏠 منطقة الخدمة:', address.serviceAreaName);

    // إعادة تحميل العنوان من قاعدة البيانات للتأكد من وجود serviceAreaName
    const addresses = await getSavedAddresses();
    const updatedAddress = addresses.find(a => a.id === address.id) || address;

    console.log('🏠 العنوان المحدث:', updatedAddress);
    setSelectedAddress(updatedAddress);
    setShowAddressSelector(false);
  };

  const handleAddressSave = async (address: SavedAddress) => {
    console.log('💾 حفظ العنوان:', address);
    console.log('💾 منطقة الخدمة:', address.serviceAreaName);

    // إعادة تحميل العنوان من قاعدة البيانات للتأكد من وجود serviceAreaName
    const addresses = await getSavedAddresses();
    const updatedAddress = addresses.find(a => a.id === address.id) || address;

    console.log('💾 العنوان المحدث:', updatedAddress);
    setSelectedAddress(updatedAddress);
    setShowAddressForm(false);
  };

  const handleProceedToCheckout = () => {
    if (!isAuthenticated || !user) {
      // Show login prompt
      window.dispatchEvent(new CustomEvent('show-login-prompt'));
      return;
    }

    if (!selectedAddress) {
      setShowAddressSelector(true);
      return;
    }

    setShowCheckout(true);
  };

  const canPayWithWallet = () => {
    return paymentMethod === 'wallet' && walletBalance >= calculateTotal();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-50 z-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-t-transparent border-brand rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل السلة...</p>
        </div>
      </div>
    );
  }

  if (showCheckout) {
    return (
      <CheckoutPage
        cartItems={cartItems}
        selectedAddress={selectedAddress}
        paymentMethod={paymentMethod}
        deliveryFee={deliveryFee}
        notes={notes}
        selectedCity={selectedCity}
        appliedCoupon={appliedCoupon}
        onClose={onClose}
        onBack={() => setShowCheckout(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col" style={{
      paddingTop: 'max(env(safe-area-inset-top), 0px)'
    }}>
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto p-4 flex items-center justify-between">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-gray-700"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="font-medium">رجوع</span>
          </button>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-brand" />
            سلة التسوق ({cartItems.length})
          </h2>
          {cartItems.length > 0 && (
            <button
              onClick={clearCart}
              className="text-[#b91c1c] hover:text-[#b91c1c] text-sm"
            >
              إفراغ السلة
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{
        paddingBottom: 'calc(350px + max(env(safe-area-inset-bottom), 0px))'
      }}>
        <div className="max-w-md mx-auto p-4">
          {cartItems.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingCart className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">السلة فارغة</h3>
              <p className="text-gray-500 mb-6">لم تقم بإضافة أي منتجات بعد</p>
              <button
                onClick={onClose}
                className="bg-brand text-white px-6 py-3 rounded-lg hover:bg-brand-light transition-colors"
              >
                ابدأ التسوق
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Cart Items Grouped by Vendor */}
              {Object.entries(groupItemsByVendor()).map(([vendorId, items]) => {
                const vendorName = items[0].vendor_name;
                const vendorData = vendorsInfo[vendorId];
                const vendorLogo = vendorData?.logo_url;

                return (
                  <div key={vendorId} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    {/* Vendor Header */}
                    <div className="bg-gray-50 p-4 border-b">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-white border border-gray-200">
                          {vendorLogo ? (
                            <img
                              src={vendorLogo}
                              alt={vendorName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Store className="w-5 h-5 text-brand m-2.5" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900">{vendorName}</h3>
                          <p className="text-xs text-gray-500">{items.length} منتج</p>
                        </div>
                      </div>
                    </div>

                    {/* Vendor Items */}
                    <div className="divide-y">
                      {items.map((item) => (
                        <div key={item.id} className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                              {item.image ? (
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="w-8 h-8 text-gray-400 m-4" />
                              )}
                            </div>

                            <div className="flex-1">
                              <div>
                                <h4 className="font-bold text-gray-900">
                                  {item.name}
                                  {!item.is_custom && item.quantity > 1 && (
                                    <span className="text-gray-600 mr-1">(×{item.quantity})</span>
                                  )}
                                </h4>
                              </div>
                              {item.variant_name && (
                                <p className="text-sm text-gray-600">النوع: {item.variant_name}</p>
                              )}

                              {/* Custom Order Details */}
                              {item.is_custom && item.custom_details && (
                                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                                  <p className="text-xs text-amber-800 font-medium mb-1">تفاصيل الطلب:</p>
                                  <p className="text-xs text-amber-900">{item.custom_details}</p>
                                  <p className="text-xs text-amber-600 mt-1">سعر مبدئي: 0 شيكل (سيحدد المتجر السعر النهائي)</p>
                                </div>
                              )}

                              {/* Quantity and Price */}
                              <div className="mt-2 space-y-1">
                                {!item.is_custom ? (
                                  <>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-600">الكمية:</span>
                                        <button
                                          onClick={() => updateCartItem(item.id, item.quantity - 1)}
                                          className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center"
                                        >
                                          <Minus className="w-3 h-3" />
                                        </button>
                                        <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                                        <button
                                          onClick={() => updateCartItem(item.id, item.quantity + 1)}
                                          className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center"
                                        >
                                          <Plus className="w-3 h-3" />
                                        </button>
                                      </div>
                                      <div className="text-gray-600 text-sm font-medium">
                                        سعر المنتج: {(item.price || 0).toFixed(2)} ₪
                                      </div>
                                    </div>

                                    {/* All Addons (both regular and optional) */}
                                    {item.addons && item.addons.length > 0 && (
                                      <div className="space-y-1 pt-1 border-t border-gray-200">
                                        <p className="text-xs font-bold text-blue-700 mb-1">الإضافات:</p>
                                        {item.addons.map((addon) => (
                                          <div key={addon.id} className="flex items-center justify-between text-xs">
                                            <span className="text-blue-700">• {addon.name} (×{addon.quantity})</span>
                                            <span className="text-blue-800 font-semibold">+{(addon.price * addon.quantity).toFixed(2)} ₪</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* Total */}
                                    <div className="flex items-center justify-between pt-2 border-t-2 border-gray-300">
                                      <span className="text-sm font-bold text-gray-700">المجموع:</span>
                                      <div className="text-brand text-lg font-bold">
                                        {(() => {
                                          const basePrice = (item.price || 0) * item.quantity;
                                          const allAddonsPrice = (item.addons || []).reduce((sum, addon) => sum + ((addon.price || 0) * addon.quantity), 0);
                                          return (basePrice + allAddonsPrice).toFixed(2);
                                        })()} ₪
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-amber-700 font-medium">الكمية: 1</span>
                                    <span className="text-amber-600 text-lg font-bold">يحدد لاحقاً</span>
                                  </div>
                                )}
                              </div>

                              <div className="flex justify-end mt-2">
                                <button
                                  onClick={() => removeCartItem(item.id)}
                                  className="text-[#b91c1c] hover:text-[#b91c1c] text-sm flex items-center gap-1"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  حذف
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Order Summary */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h3 className="font-bold text-gray-900 mb-3">ملخص الطلب</h3>

                {cartItems.some(item => item.is_custom) && (
                  <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-amber-800">
                        <p className="font-medium">يحتوي طلبك على منتجات خاصة</p>
                        <p className="text-xs mt-1">سيتم تحديد السعر النهائي من قبل المتجر</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Coupon Input */}
                <div className="mb-4">
                  {!appliedCoupon ? (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                        <Tag className="w-4 h-4" />
                        كود الخصم
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) => {
                            setCouponCode(e.target.value);
                            setCouponError('');
                          }}
                          placeholder="أدخل كود الخصم"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent text-sm"
                        />
                        <button
                          onClick={applyCoupon}
                          disabled={applyingCoupon || !couponCode.trim()}
                          className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                        >
                          {applyingCoupon ? 'جاري التحقق...' : 'تطبيق'}
                        </button>
                      </div>
                      {couponError && (
                        <p className="text-xs text-[#b91c1c] mt-1">{couponError}</p>
                      )}
                    </div>
                  ) : (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-green-600" />
                          <div>
                            <p className="text-sm font-bold text-green-900">{appliedCoupon.code}</p>
                            <p className="text-xs text-green-700">
                              {appliedCoupon.type === 'percentage'
                                ? `خصم ${appliedCoupon.value}%`
                                : `خصم ${appliedCoupon.value} شيكل`}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={removeCoupon}
                          className="text-[#b91c1c] hover:text-[#b91c1c] text-sm"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {/* سعر المنتجات */}
                  <div className="flex justify-between">
                    <span className="text-gray-600">سعر المنتجات</span>
                    <span className="font-medium">{calculateItemsOnly().toFixed(2)} شيكل</span>
                  </div>

                  {/* الإضافات */}
                  {calculateAddonsOnly() > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">الإضافات والمكونات</span>
                      <span className="font-medium text-blue-600">+{calculateAddonsOnly().toFixed(2)} شيكل</span>
                    </div>
                  )}

                  {/* المجموع الفرعي */}
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-gray-700 font-semibold">المجموع الفرعي</span>
                    <span className="font-semibold">{calculateSubtotal().toFixed(2)} شيكل</span>
                  </div>

                  {/* الخصم */}
                  {appliedCoupon && calculateDiscount() > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span className="flex items-center gap-1">
                        <Tag className="w-4 h-4" />
                        الخصم
                      </span>
                      <span className="font-medium">-{calculateDiscount().toFixed(2)} شيكل</span>
                    </div>
                  )}

                  {/* التوصيل */}
                  <div className="flex justify-between">
                    <span className="text-gray-600 flex items-center gap-1">
                      <Truck className="w-4 h-4" />
                      التوصيل
                      {(() => {
                        const vendorCount = new Set(cartItems.map(item => item.vendor_id)).size;
                        if (vendorCount > 1) {
                          return <span className="text-sm font-semibold text-gray-700"> ({vendorCount} متاجر)</span>;
                        }
                        return '';
                      })()}
                    </span>
                    <span className="font-medium">{totalDeliveryFee.toFixed(2)} شيكل</span>
                  </div>

                  {/* المجموع الكلي */}
                  <div className="border-t pt-2 flex justify-between">
                    <span className="font-bold text-gray-900">المجموع الكلي</span>
                    <span className="font-bold text-brand text-lg">{calculateTotal().toFixed(2)} شيكل</span>
                  </div>
                </div>

                <div className="mt-4">
                  {estimatedTime && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4 text-green-600" />
                      <span>وقت التوصيل المتوقع: {estimatedTime} دقيقة</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Button */}
      {cartItems.length > 0 && (
        <div className="bg-white border-t p-4 sticky bottom-0" style={{
          paddingBottom: 'calc(80px + max(env(safe-area-inset-bottom), 0px))'
        }}>
          <div className="max-w-md mx-auto space-y-3">
            {/* Display Selected Address */}
            {selectedAddress && (
              <button
                onClick={() => setShowAddressSelector(true)}
                className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-right hover:border-brand transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-brand/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-brand" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-gray-900 text-sm">{selectedAddress.name}</h4>
                      {selectedAddress.isDefault && (
                        <span className="text-xs bg-brand text-white px-2 py-0.5 rounded-full font-semibold">
                          افتراضي
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-1">{selectedAddress.address}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{selectedAddress.city}</p>
                  </div>
                  <ChevronLeft className="w-5 h-5 text-gray-400 flex-shrink-0 mt-2 rotate-180" />
                </div>
              </button>
            )}

            {/* Checkout Button */}
            <button
              onClick={handleProceedToCheckout}
              disabled={paymentMethod === 'wallet' && walletBalance < calculateTotal()}
              className="w-full bg-brand text-white py-4 rounded-xl hover:bg-brand-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-bold text-lg"
            >
              <Check className="w-6 h-6" />
              إتمام الطلب • {calculateTotal().toFixed(2)} شيكل
            </button>

            {!isAuthenticated && (
              <p className="text-center text-sm text-gray-500 mt-2">
                يجب تسجيل الدخول لإتمام الطلب
              </p>
            )}
          </div>
        </div>
      )}

      {/* Address Selector Modal */}
      {showAddressSelector && (
        <div className="fixed inset-0 bg-black/50 z-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">اختر عنوان التوصيل</h3>
              <button
                onClick={() => setShowAddressSelector(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4">
              <AddressSelector
                onSelectAddress={handleAddressSelect}
                onAddNewAddress={() => {
                  setShowAddressSelector(false);
                  setShowAddressForm(true);
                }}
                selectedAddressId={selectedAddress?.id}
              />
            </div>
          </div>
        </div>
      )}

      {/* Address Form Modal */}
      {showAddressForm && (
        <AddressForm
          onSave={handleAddressSave}
          onCancel={() => setShowAddressForm(false)}
          isModal={true}
        />
      )}

      {/* Bottom Navigation */}
      <BottomNav
        onOpenCart={() => {}}
        onOpenAccount={() => {
          if (onOpenAccount) {
            onClose();
            onOpenAccount();
          }
        }}
        onOpenOrders={() => {
          if (onOpenOrders) {
            onClose();
            onOpenOrders();
          }
        }}
        viewMode="restaurants"
        onViewModeChange={(mode) => {
          if (onNavigateHome) {
            onClose();
            onNavigateHome();
          }
        }}
        cartItemsCount={cartItems.length}
        isAccountOpen={false}
        isOrdersOpen={false}
        isCartOpen={true}
      />
    </div>
  );
};

export default CartPage;