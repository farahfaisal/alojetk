import React, { useState, useEffect } from 'react';
import {
  Check, MapPin, CreditCard, Truck, Clock, Package, AlertCircle,
  Loader2, ChevronLeft, ChevronRight, MessageSquare, Info, User, DollarSign, Wallet, Gift, Zap
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { payFromWallet, getCustomerWalletBalance } from '../lib/wallet';
import { getCustomerPoints } from '../lib/points';
import { SavedAddress, getSavedAddresses, saveAddress } from '../lib/storage';
import AddressForm from './AddressForm';
import { X } from 'lucide-react';
import { createOrder } from '../lib/ordersEdgeFunctionApi';

interface CartItem {
  id: string;
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  vendor_id: string;
  vendor_name: string;
  addons?: Array<{ id: string; name: string; price: number; quantity: number }>;
  variant_id?: string;
  variant_name?: string;
  preparation_time?: number;
}

interface CheckoutPageProps {
  cartItems: CartItem[];
  selectedAddress: SavedAddress | null;
  paymentMethod: 'cash' | 'wallet';
  deliveryFee: number;
  notes: string;
  selectedCity?: string;
  appliedCoupon?: any;
  onClose: () => void;
  onBack: () => void;
}

const CheckoutPage: React.FC<CheckoutPageProps> = ({
  cartItems,
  selectedAddress,
  paymentMethod,
  deliveryFee,
  notes,
  selectedCity,
  appliedCoupon: initialAppliedCoupon,
  onClose,
  onBack
}) => {
  const { user } = useAuth();

  const [currentAddress, setCurrentAddress] = useState<SavedAddress | null>(selectedAddress);
  const [orderNotes, setOrderNotes] = useState(notes || '');
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);

  const [courierMode, setCourierMode] = useState<'pickup' | 'delivery'>('delivery');
  const [deliveryType, setDeliveryType] = useState<'now' | 'scheduled'>('now');
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [scheduledTime, setScheduledTime] = useState<string>('');
  const [coupon, setCoupon] = useState<string>('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(initialAppliedCoupon || null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>([paymentMethod]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(false);
  const [usePoints, setUsePoints] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [totalDeliveryFee, setTotalDeliveryFee] = useState(deliveryFee);

  // Log initial props
  useEffect(() => {
    console.log('📦 CheckoutPage mounted with props:', {
      deliveryFee,
      cartItemsCount: cartItems.length,
      paymentMethod
    });
  }, []);

  // Log when totalDeliveryFee changes
  useEffect(() => {
    console.log('📊 totalDeliveryFee changed to:', totalDeliveryFee);
  }, [totalDeliveryFee]);

  // Log when deliveryFee prop changes
  useEffect(() => {
    console.log('📊 deliveryFee prop changed to:', deliveryFee);
  }, [deliveryFee]);

  const BRAND = '#C8102E';

  // Calculate multi-vendor delivery fee
  useEffect(() => {
    const calculateMultiVendorDeliveryFee = async () => {
      console.log('🚚 Calculating delivery fee...', {
        courierMode,
        deliveryFee,
        cartItemsCount: cartItems.length
      });

      // If pickup mode, no delivery fee
      if (courierMode === 'pickup') {
        console.log('🚚 Pickup mode - Setting delivery fee to 0');
        setTotalDeliveryFee(0);
        return;
      }

      const vendorCount = new Set(cartItems.map(item => item.vendor_id)).size;
      console.log('🚚 Vendor count:', vendorCount);

      if (vendorCount <= 1) {
        console.log('🚚 Single vendor - Setting delivery fee to:', deliveryFee);
        setTotalDeliveryFee(deliveryFee);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('calculate_multi_vendor_delivery_fee', {
          base_delivery_fee: deliveryFee,
          vendor_count: vendorCount
        });

        if (error) throw error;
        console.log('🚚 Multi-vendor delivery fee from DB:', data);
        setTotalDeliveryFee(data || deliveryFee);
      } catch (error) {
        console.error('Error calculating multi-vendor delivery fee:', error);
        // Fallback to base fee + 5 per additional vendor
        const fallbackFee = deliveryFee + ((vendorCount - 1) * 5);
        console.log('🚚 Using fallback fee:', fallbackFee);
        setTotalDeliveryFee(fallbackFee);
      }
    };

    calculateMultiVendorDeliveryFee();
  }, [cartItems, deliveryFee, courierMode]);

  useEffect(() => {
    const loadBalances = async () => {
      const customerId = (user as any)?.customer_id || user?.id;
      if (customerId) {
        const wallet = await getCustomerWalletBalance(customerId);
        setWalletBalance(wallet);
        const points = await getCustomerPoints(customerId);
        setPointsBalance(points);
      }
    };
    loadBalances();

    const loadUserDataAndAddresses = async () => {
      if (!currentAddress) {
        const addresses = getSavedAddresses();
        const defaultAddr = addresses.find(addr => addr.isDefault) || addresses[0];

        if (defaultAddr) {
          setCurrentAddress(defaultAddr);
        } else {
          const customerId = (user as any)?.customer_id || user?.id;
          if (customerId) {
            try {
              const { data: customerData, error } = await supabase
                .from('customers')
                .select('name, phone, address, city')
                .eq('id', customerId)
                .maybeSingle();

              if (!error && customerData) {
                const autoAddress: SavedAddress = {
                  id: 'auto-generated',
                  name: customerData.name || '',
                  phone: customerData.phone || '',
                  address: customerData.address || '',
                  city: customerData.city || selectedCity || '',
                  isDefault: false,
                  detailedAddress: '',
                  coordinates: undefined
                };
                setCurrentAddress(autoAddress);
              }
            } catch (err) {
              console.error('Error loading customer data:', err);
            }
          }
        }
      }
    };

    loadUserDataAndAddresses();
  }, [user, currentAddress, selectedCity]);

  const calculateSubtotal = () =>
    cartItems.reduce((total, item) => {
      const itemPrice = item.price || 0;
      const addonsTotal = (item.addons || []).reduce((s, a) => s + (a.price || 0) * a.quantity, 0);
      return total + itemPrice * item.quantity + addonsTotal;
    }, 0);

  const calculateCouponDiscount = () => {
    if (!appliedCoupon) {
      console.log('🎫 No coupon applied');
      return 0;
    }

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

    const finalDiscount = Math.min(discount, subtotal);
    console.log('🎫 Coupon Discount Calculation:', {
      code: appliedCoupon.code,
      type: appliedCoupon.type,
      value: appliedCoupon.value,
      subtotal,
      rawDiscount: discount,
      finalDiscount
    });

    return finalDiscount;
  };

  const calculatePointsDiscount = () => {
    if (!usePoints) return 0;
    return pointsBalance * 0.1;
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const couponDiscount = calculateCouponDiscount();
    const pointsDiscount = calculatePointsDiscount();

    console.log('💰 Checkout Total Calculation DETAILED:', {
      subtotal,
      totalDeliveryFee,
      courierMode,
      couponDiscount,
      pointsDiscount,
      calculation: `${subtotal} + ${totalDeliveryFee} - ${couponDiscount} - ${pointsDiscount}`,
      result: subtotal + totalDeliveryFee - couponDiscount - pointsDiscount
    });

    const total = Math.max(0, subtotal + totalDeliveryFee - couponDiscount - pointsDiscount);
    console.log('💰 Final total after Math.max:', total);

    return total;
  };

  const handleApplyCoupon = async () => {
    console.log('🎟️ Applying coupon:', coupon);

    if (!coupon.trim()) {
      setCouponError('يرجى إدخال رمز الكوبون');
      return;
    }

    setCouponLoading(true);
    setCouponError(null);

    try {
      const couponCode = coupon.trim();
      console.log('🎟️ Searching for coupon code:', couponCode);

      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', couponCode)
        .eq('status', 'active')
        .maybeSingle();

      console.log('🎟️ Coupon query result:', { data, error });

      if (error) {
        console.error('🎟️ Coupon query error:', error);
        throw error;
      }

      if (!data) {
        console.log('🎟️ No coupon found with code:', couponCode);
        setCouponError('الكوبون غير صالح');
        setCouponLoading(false);
        return;
      }

      console.log('🎟️ Coupon found:', data);

      const now = new Date();
      const startDate = new Date(data.start_date + 'T00:00:00');
      const endDate = new Date(data.end_date + 'T23:59:59');

      console.log('🎟️ Coupon date validation:', {
        now: now.toISOString(),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        isValid: now >= startDate && now <= endDate
      });

      if (now < startDate || now > endDate) {
        setCouponError('انتهت صلاحية الكوبون');
        setCouponLoading(false);
        return;
      }

      if (data.usage_limit && data.used_count >= data.usage_limit) {
        setCouponError('تم استخدام الكوبون بالكامل');
        setCouponLoading(false);
        return;
      }

      const subtotal = calculateSubtotal();
      console.log('🎟️ Checking minimum order amount:', {
        subtotal,
        minOrderAmount: data.min_order_amount,
        isValid: !data.min_order_amount || subtotal >= data.min_order_amount
      });

      if (data.min_order_amount && subtotal < data.min_order_amount) {
        setCouponError(`الحد الأدنى للطلب ₪${data.min_order_amount}`);
        setCouponLoading(false);
        return;
      }

      console.log('✅ Coupon applied successfully:', data);
      setAppliedCoupon(data);
      setCouponError(null);
    } catch (err: any) {
      console.error('❌ Error applying coupon:', err);
      setCouponError('حدث خطأ أثناء تطبيق الكوبون');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCoupon('');
    setCouponError(null);
  };

  const handlePlaceOrder = async () => {
    const customerId = (user as any)?.customer_id || user?.id;
    if (!customerId) {
      setError('يجب تسجيل الدخول لإتمام الطلب');
      return;
    }

    if (!selectedPaymentMethods.includes('cash') && !selectedPaymentMethods.includes('card') && !useWallet) {
      setError('يرجى اختيار طريقة دفع واحدة على الأقل (نقدي أو بطاقة أو محفظة)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const selectedServiceArea = localStorage.getItem('selectedServiceArea');
      const selectedServiceAreaId = localStorage.getItem('selectedServiceAreaId');
      const storedCity = localStorage.getItem('selectedCity');
      let serviceAreaName = selectedServiceArea || (storedCity ? JSON.parse(storedCity) : null);
      let serviceAreaId = selectedServiceAreaId || null;

      // تنظيف اسم المنطقة من المسافات الزائدة
      if (serviceAreaName) {
        serviceAreaName = serviceAreaName.trim();
      }

      console.log('📍 Service area for order:', {
        selectedServiceArea,
        selectedServiceAreaId,
        storedCity,
        serviceAreaName,
        serviceAreaId,
        propSelectedCity: selectedCity,
        addressCity: currentAddress?.city
      });

      // إذا لم يكن لدينا معرف المنطقة، نحاول جلبه من قاعدة البيانات
      if (!serviceAreaId && serviceAreaName) {
        const { data: areaData } = await supabase
          .from('service_areas')
          .select('id')
          .eq('name', serviceAreaName)
          .maybeSingle();

        if (areaData) {
          serviceAreaId = areaData.id;
          localStorage.setItem('selectedServiceAreaId', serviceAreaId);
          console.log('✅ تم جلب معرف المنطقة من قاعدة البيانات:', serviceAreaId);
        }
      }

      // التحقق من وجود منطقة الخدمة
      if (!serviceAreaName) {
        console.warn('⚠️ لم يتم تحديد منطقة الخدمة! سيتم استخدام المنطقة الافتراضية.');
      }
      if (courierMode === 'delivery' && deliveryType === 'scheduled') {
        if (!scheduledDate || !scheduledTime) {
          setError('يرجى اختيار تاريخ ووقت التوصيل');
          setLoading(false);
          return;
        }
      }

      const scheduledDeliveryTime =
        courierMode === 'delivery' && deliveryType === 'scheduled'
          ? `${scheduledDate}T${scheduledTime}:00`
          : null;

      const couponDiscount = calculateCouponDiscount();
      const pointsDiscount = calculatePointsDiscount();

      console.log('💰 Order Creation - Discounts:', {
        appliedCoupon: appliedCoupon ? appliedCoupon.code : 'none',
        couponType: appliedCoupon?.type,
        couponValue: appliedCoupon?.value,
        couponDiscount,
        pointsDiscount
      });

      const primaryPaymentMethod = selectedPaymentMethods.find(m => m === 'cash' || m === 'card') || 'cash';
      const paymentMethodsUsed = [];
      if (selectedPaymentMethods.includes('cash') || selectedPaymentMethods.includes('card')) {
        paymentMethodsUsed.push(selectedPaymentMethods.find(m => m === 'cash' || m === 'card'));
      }
      if (useWallet) paymentMethodsUsed.push('wallet');
      if (usePoints) paymentMethodsUsed.push('points');

      // Group cart items by vendor
      const itemsByVendor: { [vendorId: string]: typeof cartItems } = {};
      cartItems.forEach(item => {
        if (!itemsByVendor[item.vendor_id]) {
          itemsByVendor[item.vendor_id] = [];
        }
        itemsByVendor[item.vendor_id].push(item);
      });

      const createdOrders: any[] = [];
      const vendorIds = Object.keys(itemsByVendor);
      const vendorCount = vendorIds.length;
      const isMultiVendor = vendorCount > 1;

      // Generate a unique order group ID for multi-vendor orders
      const orderGroupId = isMultiVendor ? crypto.randomUUID() : null;

      // Calculate total subtotal to distribute discounts proportionally
      const totalSubtotal = calculateSubtotal();

      // Get additional vendor fee from settings
      let additionalVendorFee = 5;
      try {
        const { data: settings } = await supabase
          .from('multi_vendor_delivery_settings')
          .select('additional_vendor_fee')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (settings) {
          additionalVendorFee = settings.additional_vendor_fee;
        }
      } catch (error) {
        console.error('Error loading multi-vendor settings:', error);
      }

      // Create separate order for each vendor
      for (let i = 0; i < vendorIds.length; i++) {
        const vendorId = vendorIds[i];
        const vendorItems = itemsByVendor[vendorId];

        const vendorSubtotal = vendorItems.reduce((total, item) => {
          const itemTotal = item.price * item.quantity;
          const addonsTotal = (item.addons || []).reduce((sum, addon) =>
            sum + (addon.price * addon.quantity), 0);
          return total + itemTotal + addonsTotal;
        }, 0);

        // First vendor gets full delivery fee, additional vendors get additional fee
        let vendorDeliveryFee = 0;
        if (courierMode === 'delivery') {
          if (i === 0) {
            vendorDeliveryFee = deliveryFee;
          } else {
            vendorDeliveryFee = additionalVendorFee;
          }
        }

        // Distribute discounts proportionally based on vendor subtotal
        const vendorPointsDiscount = totalSubtotal > 0
          ? (vendorSubtotal / totalSubtotal) * pointsDiscount
          : 0;

        const vendorCouponDiscount = totalSubtotal > 0
          ? (vendorSubtotal / totalSubtotal) * couponDiscount
          : 0;

        const vendorTotal = Math.max(0, vendorSubtotal + vendorDeliveryFee - vendorPointsDiscount - vendorCouponDiscount);

        console.log(`💰 Vendor ${i + 1} Calculation:`, {
          vendorName: vendorItems[0].vendor_name,
          vendorSubtotal,
          vendorDeliveryFee,
          vendorCouponDiscount,
          vendorPointsDiscount,
          vendorTotal,
          calculation: `${vendorSubtotal} + ${vendorDeliveryFee} - ${vendorCouponDiscount} - ${vendorPointsDiscount} = ${vendorTotal}`
        });

        const orderData: any = {
          customer_id: customerId,
          vendor_id: vendorId,
          status: 'pending',
          total: vendorTotal,
          subtotal: vendorSubtotal,
          delivery_fee: vendorDeliveryFee,
          points_discount: vendorPointsDiscount,
          coupon_discount: vendorCouponDiscount,
          payment_method: primaryPaymentMethod,
          notes: orderNotes || null,
          address: currentAddress?.address || '',
          city: serviceAreaName || selectedCity || '',
          service_area_id: serviceAreaId || null,
          customer_name: currentAddress?.name || '',
          customer_phone: user?.phone || currentAddress?.phone || '',
          vendor_name: vendorItems[0].vendor_name,
          geocoded_latitude: currentAddress?.coordinates?.lat || null,
          geocoded_longitude: currentAddress?.coordinates?.lng || null,
          scheduled_delivery_time: scheduledDeliveryTime,
          delivery_method: courierMode,
          is_multi_vendor: isMultiVendor,
          order_group_id: orderGroupId,
          total_vendors: vendorCount,
          vendor_order_index: i + 1,
          items_data: vendorItems.map((item) => {
            console.log(`📝 Preparing item for order:`, {
              name: item.name,
              addons_count: item.addons?.length || 0,
              addons: item.addons
            });
            return {
              id: item.id,
              product_id: item.product_id,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              variant_id: item.variant_id,
              variant_name: item.variant_name,
              addons: item.addons || [],
            };
          })
        };

        console.log(`📦 Creating order ${i + 1}/${vendorCount} for vendor ${vendorItems[0].vendor_name}`, {
          isMultiVendor,
          orderGroupId,
          vendorOrderIndex: i + 1,
          totalVendors: vendorCount,
          serviceAreaName,
          selectedCity,
          addressCity: currentAddress?.city,
          finalCity: orderData.city,
          orderData_is_multi_vendor: orderData.is_multi_vendor,
          orderData_order_group_id: orderData.order_group_id
        });

        // استخدام Edge Function لإنشاء الطلب
        const { data: order, error: orderError } = await createOrder({
          customer_id: customerId,
          vendor_id: vendorId,
          customer_name: orderData.customer_name,
          customer_phone: orderData.customer_phone,
          address: orderData.address,
          city: orderData.city,
          service_area_id: serviceAreaId || null,
          items: vendorItems.map(item => ({
            product_id: item.product_id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            variant_id: item.variant_id,
            variant_name: item.variant_name,
            addons: item.addons || [],
            vendor_id: item.vendor_id || vendorId,
            vendor_name: item.vendor_name || vendorItems[0].vendor_name,
            is_custom: (item as any).is_custom || false,
            custom_details: (item as any).custom_details || '',
            preparation_time: item.preparation_time || null,
          })),
          delivery_fee: vendorDeliveryFee,
          subtotal: vendorSubtotal,
          total: vendorTotal,
          payment_method: primaryPaymentMethod,
          notes: orderData.notes,
          geocoded_latitude: orderData.geocoded_latitude,
          geocoded_longitude: orderData.geocoded_longitude,
          scheduled_delivery_time: scheduledDeliveryTime,
          delivery_method: courierMode,
          is_multi_vendor: isMultiVendor,
          order_group_id: orderGroupId,
          total_vendors: vendorCount,
          vendor_order_index: i + 1,
          points_discount: vendorPointsDiscount,
          coupon_discount: vendorCouponDiscount,
          vendor_name: vendorItems[0].vendor_name,
        });

        if (orderError) {
          console.error('❌ Error creating order:', orderError);
          throw orderError;
        }

        console.log(`✅ Order created successfully:`, order);
        createdOrders.push(order);
      }

      // Use the first order for remaining operations
      const order = createdOrders[0];

      if (appliedCoupon) {
        const couponDiscount = calculateCouponDiscount();

        const { error: orderCouponError } = await supabase
          .from('order_coupons')
          .insert({
            order_id: (order as any).id,
            coupon_id: appliedCoupon.id,
            discount_amount: couponDiscount
          });

        if (orderCouponError) {
          console.error('Error saving order coupon:', orderCouponError);
        }

        const { error: couponUpdateError } = await supabase
          .from('coupons')
          .update({ used_count: (appliedCoupon.used_count || 0) + 1 })
          .eq('id', appliedCoupon.id);

        if (couponUpdateError) {
          console.error('Error updating coupon usage:', couponUpdateError);
        }
      }

      if (usePoints && pointsBalance > 0) {
        const pointsUsed = pointsBalance;
        const { data: pointsAccount } = await supabase
          .from('points_accounts')
          .select('id')
          .eq('customer_id', customerId)
          .maybeSingle();

        if (pointsAccount) {
          await supabase.rpc('spend_points', {
            p_account_id: pointsAccount.id,
            p_points: pointsUsed,
            p_description: `استخدام نقاط في الطلب ${(order as any).order_number || (order as any).id}`
          });
        }
      }

      if (useWallet && walletBalance > 0) {
        const walletAmount = Math.min(walletBalance, calculateTotal());
        const paymentResult = await payFromWallet(
          customerId,
          (order as any).id,
          walletAmount,
          `دفع جزئي من المحفظة للطلب رقم ${(order as any).order_number || (order as any).id}`
        );
        if (!paymentResult.success) throw new Error(paymentResult.message);
      }

      localStorage.removeItem('cartItems');
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('cartUpdated'));

      setOrderId((order as any).id);
      setSuccess(true);

      // Show success message with vendor count
      const totalOrders = createdOrders.length;
      if (totalOrders > 1) {
        console.log(`✅ تم إنشاء ${totalOrders} طلبات بنجاح من متاجر مختلفة`);
      }

      // Close checkout after showing success message
      setTimeout(() => onClose(), 2500);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'حدث خطأ أثناء إنشاء الطلب');
    } finally {
      setLoading(false);
    }
  };

  const handleAddressSave = async (addressData: SavedAddress) => {
    try {
      await saveAddress(addressData);
      setCurrentAddress(addressData);
      setShowAddressForm(false);
    } catch (error) {
      console.error('Error saving address:', error);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-gray-50 z-50 flex items-center justify-center p-4" dir="rtl">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full"
        >
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
               style={{ backgroundColor: `${BRAND}1A` }}>
            <Check className="w-10 h-10" style={{ color: BRAND }} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-right">تم إنشاء الطلب بنجاح!</h2>
          <p className="text-gray-600 mb-4 text-right">سيتم تحضير طلبك وتوصيله في أقرب وقت ممكن</p>
          <p className="text-sm text-gray-500 text-center mb-6">جاري الانتقال للصفحة الرئيسية...</p>
          <div className="space-y-3">
            <button
              onClick={() => {
                onClose();
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('open-orders'));
                }, 200);
              }}
              className="w-full py-3 rounded-xl text-white"
              style={{ backgroundColor: BRAND }}
            >
              عرض طلباتي الآن
            </button>
            <button
              onClick={onClose}
              className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl hover:bg-gray-200 transition-colors"
            >
              العودة للرئيسية
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col" dir="rtl" style={{
      paddingTop: 'max(env(safe-area-inset-top), 0px)'
    }}>
      <div className="sticky top-0 z-10 bg-white shadow-sm">
        <div className="max-w-2xl mx-auto p-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-6 h-6" style={{ color: BRAND }} />
          </button>
          <h2 className="text-lg font-bold text-gray-900">العودة لسلة المشتريات</h2>
          <div className="w-10" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-32" style={{
        paddingBottom: 'calc(8rem + max(env(safe-area-inset-bottom), 8px))'
      }}>
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

          {error && (
            <div className="rounded-xl p-3 flex items-start gap-2 text-sm bg-red-50 text-red-900">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-3 text-right">طريقة التوصيل</h3>
            <div className="space-y-3">
              <button
                onClick={() => setCourierMode('pickup')}
                className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                  courierMode === 'pickup' ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">🚶</span>
                </div>
                <div className="flex-1 text-right">
                  <p className="text-base font-bold text-gray-900">إستلام (بدون توصيل)</p>
                </div>
              </button>

              <button
                onClick={() => setCourierMode('delivery')}
                className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                  courierMode === 'delivery' ? 'bg-brand border-brand' : 'border-gray-200 bg-gray-50'
                }`}
                style={courierMode === 'delivery' ? {
                  backgroundColor: BRAND,
                  borderColor: BRAND
                } : {}}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                  courierMode === 'delivery' ? 'bg-white/20' : 'bg-gray-100'
                }`}>
                  <svg viewBox="0 0 24 24" fill="currentColor" className={`w-6 h-6 ${
                    courierMode === 'delivery' ? 'text-white' : 'text-gray-600'
                  }`}>
                    <path d="M12.72 11.47C12.88 10.66 13 9.82 13 9c0-2.76-2.24-5-5-5S3 6.24 3 9c0 2.85 2.92 7.21 5 9.88 2.11-2.69 5-7 5-9.88 0-.78-.07-1.53-.2-2.24l3.58-3.58c.78-.78 2.05-.78 2.83 0l.41.41c.78.78.78 2.05 0 2.83l-6.9 6.9zM8 11c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/><path d="M20 14.5c-1.93 0-3.5 1.57-3.5 3.5s1.57 3.5 3.5 3.5 3.5-1.57 3.5-3.5-1.57-3.5-3.5-3.5zm0 5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM7 18c-1.38 0-2.5 1.12-2.5 2.5S5.62 23 7 23s2.5-1.12 2.5-2.5S8.38 18 7 18zm0 3.5c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/><path d="M11 20h4.68c.3-.87.88-1.62 1.66-2.12l-1.89-1.89C14.19 17.24 12.67 18 11 18v2z"/>
                  </svg>
                </div>
                <div className="flex-1 text-right">
                  <p className={`text-base font-bold ${
                    courierMode === 'delivery' ? 'text-white' : 'text-gray-900'
                  }`}>توصيل ألو جيتك</p>
                  <p className={`text-sm ${
                    courierMode === 'delivery' ? 'text-white/80' : 'text-gray-500'
                  }`}>(36 دقيقة)</p>
                </div>
              </button>
            </div>
          </div>

          {courierMode === 'delivery' && (
            <div>
              <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4 mb-3">
                <button
                  onClick={() => setDeliveryType(deliveryType === 'now' ? 'scheduled' : 'now')}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 ${
                    deliveryType === 'scheduled' ? 'bg-gray-400' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                      deliveryType === 'scheduled' ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-red-600" />
                  <span className="text-base font-semibold text-gray-900">الاستلام لوقت لاحق</span>
                </div>
              </div>

              {deliveryType === 'scheduled' && (
                <div className="mt-3 space-y-3 p-4 bg-gray-50 rounded-xl">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 text-right">
                      التاريخ
                    </label>
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 text-right">
                      الوقت
                    </label>
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-right"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 flex-row-reverse">
                <span className="text-base font-bold text-gray-900">عنوان التوصيل</span>
                <MapPin className="w-5 h-5 text-gray-600" />
              </div>
              <button
                onClick={() => setShowAddressForm(true)}
                className="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{ color: BRAND, backgroundColor: `${BRAND}15` }}
              >
                تغيير العنوان
              </button>
            </div>

            {/* Service Area Display */}
            <div className="mb-3 bg-white rounded-lg p-3 border border-gray-200">
              <div className="flex items-center gap-2 flex-row-reverse">
                <span className="text-sm font-medium text-gray-600">منطقة الخدمة:</span>
                <MapPin className="w-4 h-4 text-gray-600" />
              </div>
              <p className="text-base font-bold text-right text-gray-900 mt-1">
                {(() => {
                  const selectedServiceArea = localStorage.getItem('selectedServiceArea');
                  const storedCity = localStorage.getItem('selectedCity');
                  let serviceAreaName = selectedServiceArea || (storedCity ? JSON.parse(storedCity) : null);

                  // تنظيف اسم المنطقة من المسافات الزائدة
                  if (serviceAreaName) {
                    serviceAreaName = serviceAreaName.trim();
                  }

                  console.log('📍 عرض منطقة الخدمة في CheckoutPage:', {
                    selectedServiceArea,
                    storedCity,
                    serviceAreaName,
                    selectedCityProp: selectedCity
                  });

                  return serviceAreaName || selectedCity || 'لم يتم تحديد المنطقة';
                })()}
              </p>
            </div>

            {currentAddress ? (
              <div className="w-full bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="text-right">
                  <p className="font-bold text-gray-900 text-base mb-1">{currentAddress.name}</p>
                  <p className="text-sm text-gray-600 mb-1">{currentAddress.phone}</p>
                  <p className="text-sm text-gray-700 mb-1">{currentAddress.address}</p>
                  {currentAddress.detailedAddress && (
                    <p className="text-sm text-gray-600">{currentAddress.detailedAddress}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="w-full p-4 border-2 border-gray-200 rounded-lg bg-yellow-50">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  <p className="font-bold text-gray-900 text-sm">معلومات التوصيل غير متوفرة</p>
                </div>
                <p className="text-sm text-gray-600">
                  يرجى تحديث معلوماتك من صفحة الحساب أولاً
                </p>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowNotesModal(true)}
            className="w-full bg-white rounded-lg p-4 border border-gray-200 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex-1 text-right">
              <p className={`text-base ${orderNotes ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                {orderNotes || 'ملاحظة للطلب (اختياري)'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-gray-600" />
            </div>
          </button>

          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-3 text-right">طريقة الدفع</h3>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setSelectedPaymentMethods(prev => {
                    const hasCard = prev.includes('card');
                    const filtered = prev.filter(m => m !== 'cash' && m !== 'card');
                    if (hasCard) return [...filtered, 'cash'];
                    return [...filtered, 'cash'];
                  });
                }}
                className={`w-full rounded-lg p-4 flex items-center justify-between transition-all ${
                  selectedPaymentMethods.includes('cash') ? 'bg-green-50 border-2 border-green-500' : 'bg-white border-2 border-gray-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center ${
                    selectedPaymentMethods.includes('cash') ? 'bg-green-500 border-green-500' : 'border-gray-300'
                  }`}>
                    {selectedPaymentMethods.includes('cash') && <Check className="w-4 h-4 text-white" />}
                  </div>
                </div>
                <div className="flex-1 text-right mr-3">
                  <p className="font-bold text-gray-900 text-base">نقدي</p>
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  selectedPaymentMethods.includes('cash') ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  <DollarSign className={`w-5 h-5 ${selectedPaymentMethods.includes('cash') ? 'text-green-600' : 'text-gray-600'}`} />
                </div>
              </button>

              <button
                disabled
                className="w-full rounded-lg p-4 flex items-center justify-between transition-all bg-gray-50 border-2 border-gray-200 opacity-60 cursor-not-allowed"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg border-2 flex items-center justify-center border-gray-300">
                  </div>
                </div>
                <div className="flex-1 text-right mr-3">
                  <p className="font-bold text-gray-900 text-base">بطاقة <span className="text-sm font-normal text-gray-500">(قريباً)</span></p>
                </div>
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100">
                  <CreditCard className="w-5 h-5 text-gray-600" />
                </div>
              </button>
            </div>
          </div>

          <button
            onClick={() => setUseWallet(!useWallet)}
            className={`w-full rounded-lg p-4 flex items-center justify-between transition-all ${
              useWallet ? 'bg-blue-50 border-2 border-blue-500' : 'bg-white border-2 border-gray-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center`}
                   style={{
                     backgroundColor: useWallet ? BRAND : 'transparent',
                     borderColor: useWallet ? BRAND : '#D1D5DB'
                   }}>
                {useWallet && <Check className="w-4 h-4 text-white" />}
              </div>
            </div>
            <div className="flex-1 text-right mr-3">
              <p className="font-bold text-gray-900 text-base">محفظة الو جيتك</p>
              <p className="text-sm" style={{ color: BRAND }}>₪{walletBalance.toFixed(2)}</p>
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${BRAND}20` }}>
              <Wallet className="w-5 h-5" style={{ color: BRAND }} />
            </div>
          </button>

          <button
            onClick={() => setUsePoints(!usePoints)}
            className={`w-full rounded-lg p-4 flex items-center justify-between transition-all ${
              usePoints ? 'bg-yellow-50 border-2 border-yellow-500' : 'bg-white border-2 border-gray-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center ${
                usePoints ? 'bg-yellow-500 border-yellow-500' : 'border-gray-300'
              }`}>
                {usePoints && <Check className="w-4 h-4 text-white" />}
              </div>
            </div>
            <div className="flex-1 text-right mr-3">
              <p className="font-bold text-gray-900 text-base">استبدال {pointsBalance} نقطة</p>
              <p className="text-sm text-gray-600">احصل على خصم ₪{(pointsBalance * 0.1).toFixed(2)}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
              <Gift className="w-5 h-5 text-yellow-600" />
            </div>
          </button>

          <div>
            <div className="flex items-center justify-start gap-2 mb-3">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" style={{ color: BRAND }}>
                <path d="M21 6h-2c0-1.1-.9-2-2-2H7c-1.1 0-2 .9-2 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 14H3V8h2v2h2V8h10v2h2V8h2v12z" fill="currentColor"/>
              </svg>
              <span className="text-base font-bold text-gray-900">هل لديك كوبون خصم؟</span>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200 space-y-3">
              <div className="flex items-center gap-3 flex-row-reverse">
                <input
                  type="text"
                  placeholder="ادخل رقم الكوبون"
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  disabled={appliedCoupon !== null}
                  className="flex-1 text-right text-gray-900 bg-gray-50 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 disabled:opacity-50 border border-gray-200"
                  style={{ focusRing: BRAND }}
                  dir="rtl"
                />
                {!appliedCoupon ? (
                  <button
                    onClick={handleApplyCoupon}
                    disabled={couponLoading || !coupon.trim()}
                    className="px-6 py-3 rounded-lg text-white text-sm font-bold disabled:opacity-50 transition-colors whitespace-nowrap"
                    style={{ backgroundColor: BRAND }}
                  >
                    {couponLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'تطبيق'
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleRemoveCoupon}
                    className="px-6 py-3 rounded-lg bg-red-100 text-red-600 text-sm font-bold whitespace-nowrap"
                  >
                    إزالة
                  </button>
                )}
              </div>

              {couponError && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg flex-row-reverse">
                  <span className="text-right flex-1">{couponError}</span>
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                </div>
              )}

              {appliedCoupon && (
                <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 p-3 rounded-lg flex-row-reverse">
                  <span className="font-medium text-right flex-1">تم تطبيق الكوبون - خصم ₪{calculateCouponDiscount().toFixed(2)}</span>
                  <Check className="w-4 h-4 flex-shrink-0" />
                </div>
              )}
            </div>
          </div>

          <div className="h-32"></div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg" style={{
        paddingBottom: 'max(env(safe-area-inset-bottom), 16px)'
      }}>
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-900 font-medium">₪{calculateSubtotal().toFixed(2)}</span>
              <span className="text-gray-600">المجموع الفرعي</span>
            </div>
            {courierMode === 'delivery' && (
              <div className="flex justify-between items-center">
                <span className="text-gray-900 font-medium">₪{totalDeliveryFee.toFixed(2)}</span>
                <span className="text-gray-600">
                  توصيل
                  {(() => {
                    const vendorCount = new Set(cartItems.map(item => item.vendor_id)).size;
                    if (vendorCount > 1) {
                      return ` (${vendorCount} متاجر)`;
                    }
                    return '';
                  })()}
                </span>
              </div>
            )}

            {appliedCoupon && calculateCouponDiscount() > 0 && (
              <div className="flex justify-between items-center text-green-600">
                <span className="font-medium">-₪{calculateCouponDiscount().toFixed(2)}</span>
                <span>خصم الكوبون ({appliedCoupon.code})</span>
              </div>
            )}

            {usePoints && calculatePointsDiscount() > 0 && (
              <div className="flex justify-between items-center text-yellow-600">
                <span className="font-medium">-₪{calculatePointsDiscount().toFixed(2)}</span>
                <span>خصم النقاط ({pointsBalance} نقطة)</span>
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
              <span className="font-bold text-lg" style={{ color: BRAND }}>₪{calculateTotal().toFixed(2)}</span>
              <span className="text-gray-900 font-bold">المجموع الكلي</span>
            </div>
          </div>

          <button
            onClick={handlePlaceOrder}
            disabled={loading}
            className="w-full py-4 rounded-xl font-bold text-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ backgroundColor: BRAND }}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                جاري المعالجة...
              </>
            ) : (
              'إنهاء'
            )}
          </button>
        </div>
      </div>

      {/* Notes Modal */}
      {showNotesModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-4 border-b flex items-center justify-between">
              <button
                onClick={() => setShowNotesModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="w-6 h-6" />
              </button>
              <h3 className="text-xl font-bold text-gray-900">ملاحظات الطلب</h3>
            </div>
            <div className="p-4">
              <textarea
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="أضف أي ملاحظات خاصة للطلب..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand resize-none text-right"
                rows={5}
                dir="rtl"
              />
              <button
                onClick={() => setShowNotesModal(false)}
                className="w-full mt-4 py-3 rounded-xl text-white font-bold"
                style={{ backgroundColor: BRAND }}
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Address Form Modal */}
      {showAddressForm && (
        <AddressForm
          onSave={handleAddressSave}
          onCancel={() => setShowAddressForm(false)}
        />
      )}
    </div>
  );
};

export default CheckoutPage;
