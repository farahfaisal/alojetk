import React, { useState, useEffect } from 'react';
import { Package, Clock, Truck, Check, MapPin, Phone, Star, ChevronLeft, RefreshCw, Store, User, Headphones } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import RatingModal from './RatingModal';

interface OrderTrackingPageProps {
  orderId: string;
  orderGroupId?: string;
  onClose: () => void;
}

interface OrderStatus {
  id: string;
  status: string;
  note?: string;
  created_at: string;
  created_by?: string;
  driver_name?: string;
}

interface OrderDetails {
  id: string;
  order_number: string;
  status: string;
  total: number;
  subtotal: number;
  delivery_fee: number;
  payment_method: string;
  notes?: string;
  address: string;
  customer_name: string;
  customer_phone: string;
  vendor_name: string;
  vendor_id?: string;
  driver_name?: string;
  created_at: string;
  estimated_total_time?: number;
  items_data: any[];
  is_multi_vendor?: boolean;
  order_group_id?: string;
}

interface VendorInfo {
  id: string;
  name: string;
  logo_url: string;
}

interface ProductImage {
  [productId: string]: string;
}

const OrderTrackingPage: React.FC<OrderTrackingPageProps> = ({ orderId, orderGroupId, onClose }) => {
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [subOrders, setSubOrders] = useState<OrderDetails[]>([]);
  const [orderHistory, setOrderHistory] = useState<OrderStatus[]>([]);
  const [productImages, setProductImages] = useState<ProductImage>({});
  const [vendorInfo, setVendorInfo] = useState<VendorInfo | null>(null);
  const [vendorsInfo, setVendorsInfo] = useState<{ [vendorId: string]: VendorInfo }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingType, setRatingType] = useState<'driver' | 'store'>('store');
  const [isMultiVendor, setIsMultiVendor] = useState(false);

  useEffect(() => {
    fetchOrderDetails();
    
    // Set up real-time subscription for order updates
    const subscription = supabase
      .channel('order-updates')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders',
          filter: `id=eq.${orderId}`
        }, 
        () => {
          fetchOrderDetails();
        }
      )
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_status_history',
          filter: `order_id=eq.${orderId}`
        },
        () => {
          fetchOrderHistory();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);

      console.log('🔍 OrderTrackingPage props:', {
        orderId,
        orderGroupId,
        hasGroupId: !!orderGroupId
      });

      // Check if this is a multi-vendor order
      if (orderGroupId) {
        console.log('🔍 This is a multi-vendor order, fetching group:', orderGroupId);
        setIsMultiVendor(true);

        // Fetch all orders in this group
        const { data: groupOrders, error: groupError } = await supabase
          .from('orders')
          .select('*')
          .eq('order_group_id', orderGroupId)
          .order('created_at', { ascending: true });

        if (groupError) throw groupError;

        console.log('📦 Multi-vendor orders fetched:', groupOrders?.length || 0);
        groupOrders?.forEach((order, index) => {
          console.log(`Order ${index + 1}:`, {
            vendor: order.vendor_name,
            items_count: order.items_data?.length || 0,
            items_data: order.items_data
          });
        });

        if (groupOrders && groupOrders.length > 0) {
          setSubOrders(groupOrders);
          setOrderDetails(groupOrders[0]); // Set first order as main

          // Fetch all product images for all orders
          const allProductIds = groupOrders.flatMap((order: any) =>
            (order.items_data || [])
              .map((item: any) => item.product_id)
              .filter(Boolean)
          );

          if (allProductIds.length > 0) {
            const { data: products, error: productsError } = await supabase
              .from('products')
              .select('id, image_url')
              .in('id', allProductIds);

            if (!productsError && products) {
              const imagesMap: ProductImage = {};
              products.forEach((product: any) => {
                imagesMap[product.id] = product.image_url;
              });
              setProductImages(imagesMap);
            }
          }

          // Fetch all vendor info (logos) for all orders
          const allVendorIds = groupOrders
            .map((order: any) => order.vendor_id)
            .filter(Boolean);

          if (allVendorIds.length > 0) {
            const { data: vendors, error: vendorsError } = await supabase
              .from('vendors')
              .select('id, store_name, logo_url')
              .in('id', allVendorIds);

            if (!vendorsError && vendors) {
              const vendorsMap: { [vendorId: string]: VendorInfo } = {};
              vendors.forEach((vendor: any) => {
                vendorsMap[vendor.id] = {
                  id: vendor.id,
                  name: vendor.store_name,
                  logo_url: vendor.logo_url
                };
              });
              setVendorsInfo(vendorsMap);
            }
          }
        }
      } else {
        // Single vendor order
        console.log('🔍 This is a single vendor order:', orderId);
        setIsMultiVendor(false);

        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();

        if (error) throw error;
        setOrderDetails(data);

        // Fetch vendor info including logo
        if (data?.vendor_id) {
          const { data: vendor, error: vendorError } = await supabase
            .from('vendors')
            .select('id, store_name, logo_url')
            .eq('id', data.vendor_id)
            .maybeSingle();

          if (!vendorError && vendor) {
            // Map store_name to name for consistency
            setVendorInfo({
              id: vendor.id,
              name: vendor.store_name,
              logo_url: vendor.logo_url
            });
          }
        }

        // Fetch product images
        if (data?.items_data && data.items_data.length > 0) {
          const productIds = data.items_data
            .map((item: any) => item.product_id)
            .filter(Boolean);

          if (productIds.length > 0) {
            const { data: products, error: productsError } = await supabase
              .from('products')
              .select('id, image_url')
              .in('id', productIds);

            if (!productsError && products) {
              const imagesMap: ProductImage = {};
              products.forEach((product: any) => {
                imagesMap[product.id] = product.image_url;
              });
              setProductImages(imagesMap);
            }
          }
        }
      }

      // Also fetch order history
      await fetchOrderHistory();
    } catch (err) {
      console.error('Error fetching order details:', err);
      setError('حدث خطأ في جلب تفاصيل الطلب');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('order_status_history')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setOrderHistory(data || []);
    } catch (err) {
      console.error('Error fetching order history:', err);
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'pending': 'في انتظار الموافقة',
      'accepted': 'تم قبول الطلب',
      'processing': 'جاري التحضير',
      'ready': 'جاهز للتوصيل',
      'shipping': 'في الطريق',
      'delivered': 'تم التوصيل',
      'completed': 'مكتمل',
      'cancelled': 'ملغي',
      'rejected': 'مرفوض'
    };
    return statusMap[status] || status;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'accepted':
      case 'processing':
        return <Package className="w-5 h-5 text-blue-500" />;
      case 'ready':
      case 'shipping':
        return <Truck className="w-5 h-5 text-orange-500" />;
      case 'delivered':
      case 'completed':
        return <Check className="w-5 h-5 text-green-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'accepted':
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'ready':
      case 'shipping':
        return 'bg-orange-100 text-orange-800';
      case 'delivered':
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const canRate = () => {
    return orderDetails?.status === 'delivered' || orderDetails?.status === 'completed';
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-50 z-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-brand animate-spin mx-auto mb-4" />
          <p className="text-gray-600">جاري تحميل تفاصيل الطلب...</p>
        </div>
      </div>
    );
  }

  if (error || !orderDetails) {
    return (
      <div className="fixed inset-0 bg-gray-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl p-8 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-red-800" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">خطأ في تحميل الطلب</h2>
          <p className="text-gray-600 mb-6">{error || 'لم يتم العثور على الطلب'}</p>
          <button
            onClick={onClose}
            className="bg-brand text-white px-6 py-3 rounded-lg hover:bg-brand-light transition-colors"
          >
            العودة
          </button>
        </div>
      </div>
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
          <h2 className="text-xl font-bold text-gray-900">تتبع الطلب</h2>
          <button
            onClick={fetchOrderDetails}
            className="text-brand hover:text-brand-light"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto p-4 space-y-4">
          {/* Vendor Info Card - Top Section */}
          {!isMultiVendor && (orderDetails.vendor_name || orderDetails.vendor_id) && (
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-brand shadow-md flex-shrink-0">
                  {vendorInfo?.logo_url ? (
                    <img
                      src={vendorInfo.logo_url}
                      alt={orderDetails.vendor_name || vendorInfo?.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center">
                      <Store className="w-10 h-10 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 text-right">
                  <p className="text-xs text-gray-500 mb-1">الطلب من</p>
                  <p className="text-xl font-bold text-gray-900">
                    {orderDetails.vendor_name || vendorInfo?.name || 'متجر'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Multi-vendor Info Card */}
          {isMultiVendor && subOrders.length > 0 && (
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-brand shadow-md flex-shrink-0">
                  <div className="w-full h-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center">
                    <Store className="w-10 h-10 text-white" />
                  </div>
                </div>
                <div className="flex-1 text-right">
                  <p className="text-xs text-gray-500 mb-1">طلب متعدد المتاجر</p>
                  <p className="text-xl font-bold text-gray-900">{subOrders.length} متاجر</p>
                </div>
              </div>
            </div>
          )}

          {/* Order Header */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="text-center mb-4">
              <h3 className="text-2xl font-bold text-gray-900">
                طلب رقم {orderDetails.order_number || orderDetails.id.slice(-6)}
              </h3>
              {isMultiVendor && subOrders.length > 0 ? (
                <div className="mt-2">
                  <p className="text-sm text-gray-500 mb-2">حالة المتاجر:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {subOrders.map((subOrder) => (
                      <div key={subOrder.id} className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(subOrder.status)}`}>
                        {subOrder.vendor_name}: {getStatusText(subOrder.status)}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className={`inline-block px-4 py-2 rounded-full text-sm font-bold mt-2 ${getStatusColor(orderDetails.status)}`}>
                  {getStatusText(orderDetails.status)}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-brand">
                  {isMultiVendor && subOrders.length > 0
                    ? subOrders.reduce((sum, order) => sum + order.total, 0).toFixed(2)
                    : orderDetails.total.toFixed(2)
                  }
                </div>
                <div className="text-sm text-gray-600">المجموع الكلي</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {orderDetails.estimated_total_time || 30}-{(orderDetails.estimated_total_time || 30) + 15}
                </div>
                <div className="text-sm text-gray-600">دقيقة</div>
              </div>
            </div>
          </div>

          {/* Rating Section - Shows after order is completed */}
          {canRate() && (
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-4 text-center text-lg flex items-center justify-center gap-2">
                <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
                قيم تجربتك
              </h3>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setRatingType('store');
                    setShowRatingModal(true);
                  }}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-white py-4 rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all font-bold text-lg shadow-lg flex items-center justify-center gap-2"
                >
                  <Store className="w-5 h-5" />
                  تقييم المتجر
                </button>
                {orderDetails.driver_name && (
                  <button
                    onClick={() => {
                      setRatingType('driver');
                      setShowRatingModal(true);
                    }}
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-4 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all font-bold text-lg shadow-lg flex items-center justify-center gap-2"
                  >
                    <User className="w-5 h-5" />
                    تقييم السائق
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Order Status Timeline */}
          <div className="relative">
            {(() => {
              // Define 4 main stages
              const stages = [
                { key: 'pending', label: 'في انتظار الموافقة', icon: Clock },
                { key: 'processing', label: 'قيد التحضير', icon: Package },
                { key: 'shipping', label: 'في الطريق', icon: Truck },
                { key: 'delivered', label: 'تم التوصيل', icon: Check }
              ];

              // Determine current stage index based on order status
              const getCurrentStageIndex = () => {
                // For multi-vendor orders, use the least advanced status
                if (isMultiVendor && subOrders.length > 0) {
                  const statuses = subOrders.map(o => o.status);

                  // If any order is cancelled or rejected, return -1
                  if (statuses.some(s => ['cancelled', 'rejected'].includes(s))) return -1;

                  // If all orders are delivered/completed, return 3
                  if (statuses.every(s => ['delivered', 'completed'].includes(s))) return 3;

                  // If any order is pending, return 0
                  if (statuses.some(s => s === 'pending')) return 0;

                  // If any order is shipping, but not all, return 1 (still processing)
                  if (statuses.some(s => ['shipping', 'out_for_delivery', 'picked_up'].includes(s))) {
                    // If all are shipping or delivered, return 2
                    if (statuses.every(s => ['shipping', 'out_for_delivery', 'picked_up', 'delivered', 'completed'].includes(s))) {
                      return 2;
                    }
                    return 1; // Some still processing
                  }

                  // All are in processing/accepted/ready state
                  if (statuses.every(s => ['processing', 'accepted', 'preparing', 'ready'].includes(s))) return 1;

                  return 0;
                }

                // Single vendor order
                const status = orderDetails?.status || 'pending';
                if (['cancelled', 'rejected'].includes(status)) return -1;
                if (['delivered', 'completed'].includes(status)) return 3;
                if (['shipping', 'out_for_delivery', 'picked_up'].includes(status)) return 2;
                if (['processing', 'accepted', 'preparing', 'ready'].includes(status)) return 1;
                return 0; // pending
              };

              const currentStageIndex = getCurrentStageIndex();

              return (
                <div className="space-y-0 relative">
                  {/* Timeline dots line */}
                  <div className="absolute left-6 top-14 bottom-14 w-0.5 bg-gradient-to-b from-green-300 via-amber-300 to-gray-200"
                       style={{
                         height: `calc(100% - 16rem)`,
                         top: '3.5rem'
                       }}
                  />

                  {stages.map((stage, index) => {
                    const isCompleted = currentStageIndex > index;
                    const isCurrent = currentStageIndex === index;
                    const isPending = currentStageIndex < index;
                    const Icon = stage.icon;

                    return (
                      <div key={stage.key} className="flex items-stretch gap-0 relative mb-0">
                        {/* Timeline Circle Icon */}
                        <div className="flex flex-col items-center z-10 w-12 flex-shrink-0">
                          <div className={`
                            w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300
                            ${isCompleted ? 'bg-green-500 shadow-md' :
                              isCurrent ? 'bg-amber-500 shadow-lg shadow-amber-500/50' :
                              'bg-white border-2 border-gray-300'}
                          `}>
                            {isCompleted ? (
                              <Check className="w-6 h-6 text-white" />
                            ) : isCurrent ? (
                              <Icon className="w-6 h-6 text-white animate-pulse" />
                            ) : (
                              <Icon className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                        </div>

                        {/* Status Card */}
                        <div className={`
                          flex-1 rounded-2xl p-5 mb-2 ml-2 mr-2 transition-all duration-300
                          ${isCompleted ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md' :
                            isCurrent ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white border-2 border-amber-700 shadow-xl shadow-amber-500/30 animate-pulse' :
                            'bg-white border border-gray-200 text-gray-400'}
                        `}>
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h4 className={`font-bold text-lg mb-1 ${isCompleted || isCurrent ? 'text-white' : 'text-gray-400'}`}>
                                {stage.label}
                              </h4>
                              {isCurrent && orderDetails?.driver_name && index === 2 && (
                                <p className="text-sm text-white/90">
                                  السائق: {orderDetails.driver_name}
                                </p>
                              )}
                              {/* Show vendor count for multi-vendor orders */}
                              {isMultiVendor && subOrders.length > 0 && (isCompleted || isCurrent) && (
                                <p className="text-xs text-white/80 mt-1">
                                  {(() => {
                                    const statusGroups = [
                                      { statuses: ['pending'], label: 'في الانتظار' },
                                      { statuses: ['processing', 'accepted', 'preparing', 'ready'], label: 'قيد التحضير' },
                                      { statuses: ['shipping', 'out_for_delivery', 'picked_up'], label: 'في الطريق' },
                                      { statuses: ['delivered', 'completed'], label: 'تم التوصيل' }
                                    ];
                                    const currentGroup = statusGroups[index];
                                    const count = subOrders.filter(o => currentGroup.statuses.includes(o.status)).length;
                                    if (count > 0) {
                                      return `${count} من ${subOrders.length} متجر`;
                                    }
                                    return '';
                                  })()}
                                </p>
                              )}
                            </div>
                            {(isCompleted || isCurrent) && (
                              <div className="text-white">
                                <p className="text-sm font-medium">
                                  {(() => {
                                    const relevantHistory = orderHistory.find(h => {
                                      if (index === 0) return ['pending'].includes(h.status);
                                      if (index === 1) return ['processing', 'accepted', 'preparing', 'ready'].includes(h.status);
                                      if (index === 2) return ['shipping', 'out_for_delivery', 'picked_up'].includes(h.status);
                                      if (index === 3) return ['delivered', 'completed'].includes(h.status);
                                      return false;
                                    });

                                    if (relevantHistory) {
                                      return new Date(relevantHistory.created_at).toLocaleTimeString('ar', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      });
                                    }
                                    return '';
                                  })()}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Delivery Info */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-brand" />
              معلومات التوصيل
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">{orderDetails.customer_name}</p>
                  <p className="text-sm text-gray-600">{orderDetails.address}</p>
                  <p className="text-sm text-gray-600">{orderDetails.customer_phone}</p>
                </div>
              </div>
              
              {orderDetails.driver_name && (
                <div className="flex items-center gap-3 bg-blue-50 p-3 rounded-lg">
                  <User className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900">السائق: {orderDetails.driver_name}</p>
                    <p className="text-sm text-blue-700">تم تعيين السائق لطلبك</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Multi-Vendor Orders or Single Order Items */}
          {isMultiVendor && subOrders.length > 0 ? (
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-xl p-4">
                <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                  <Store className="w-5 h-5" />
                  طلب متعدد المتاجر
                </h3>
                <p className="text-sm text-blue-700">
                  هذا الطلب يحتوي على منتجات من {subOrders.length} متاجر مختلفة
                </p>
              </div>

              {subOrders.map((subOrder, orderIndex) => {
                const currentVendor = subOrder.vendor_id ? vendorsInfo[subOrder.vendor_id] : null;
                return (
                  <div key={subOrder.id} className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3 pb-3 border-b">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-brand shadow-sm flex-shrink-0">
                          {currentVendor?.logo_url ? (
                            <img
                              src={currentVendor.logo_url}
                              alt={subOrder.vendor_name || currentVendor.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center">
                              <Store className="w-7 h-7 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <h3 className="font-bold text-gray-900">{subOrder.vendor_name}</h3>
                          <p className="text-xs text-gray-500">طلب رقم {subOrder.order_number}</p>
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        subOrder.status === 'delivered' ? 'bg-green-100 text-green-800' :
                        subOrder.status === 'shipping' ? 'bg-orange-100 text-orange-800' :
                        subOrder.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {getStatusText(subOrder.status)}
                      </div>
                    </div>

                  <div className="divide-y">
                    {subOrder.items_data?.map((item: any, index: number) => {
                      const productImage = item.image || item.image_url || (item.product_id ? productImages[item.product_id] : null);
                      const itemPrice = item.price || 0;
                      const itemTotal = itemPrice * item.quantity;
                      const addonsTotal = (item.addons || []).reduce((sum: number, addon: any) => {
                        return sum + ((addon.price || 0) * (addon.quantity || 1));
                      }, 0);

                      return (
                        <div key={index} className="p-3">
                          <div className="flex items-start gap-3">
                            <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                              {productImage ? (
                                <img
                                  src={productImage}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="w-6 h-6 text-gray-400 m-4" />
                              )}
                            </div>

                            <div className="flex-1">
                              <h4 className="font-bold text-gray-900 text-sm">
                                {item.name}
                                {item.quantity > 1 && (
                                  <span className="text-gray-600 mr-1">(×{item.quantity})</span>
                                )}
                              </h4>
                              {item.variant_name && (
                                <p className="text-xs text-gray-600">النوع: {item.variant_name}</p>
                              )}
                              {item.is_custom && item.custom_details && (
                                <div className="mt-1 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                                  <p className="text-xs text-amber-800 font-medium mb-1">تفاصيل الطلب:</p>
                                  <p className="text-xs text-amber-900">{item.custom_details}</p>
                                </div>
                              )}

                              {/* Price */}
                              <div className="mt-2">
                                {!item.is_custom ? (
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">السعر</span>
                                    <span className="text-brand font-bold">
                                      {itemTotal.toFixed(2)} ₪
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-amber-600 font-bold text-sm">يحدد لاحقاً</span>
                                )}

                                {/* Addons - Components (regular type) */}
                                {item.addons && item.addons.filter((a: any) => a.type === 'regular').length > 0 && (
                                  <div className="mt-2 pt-2 border-t border-gray-200">
                                    <p className="text-xs font-bold text-emerald-700 mb-1.5">المكونات:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {item.addons.filter((a: any) => a.type === 'regular').map((addon: any, addonIndex: number) => (
                                        <span key={addonIndex} className="text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                                          {addon.name}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Addons - Optional Type */}
                                {item.addons && item.addons.filter((a: any) => a.type !== 'regular').length > 0 && (
                                  <div className="mt-2 pt-2 border-t border-gray-200">
                                    <div className="mb-1">
                                      <span className="text-xs font-bold text-blue-700">الإضافات الاختيارية:</span>
                                    </div>
                                    <div className="space-y-1 bg-blue-50 p-2 rounded-lg">
                                      {item.addons.filter((a: any) => a.type !== 'regular').map((addon: any, addonIndex: number) => (
                                        <div key={addonIndex} className="flex items-center justify-between">
                                          <span className="text-xs text-blue-900 font-medium">
                                            • {addon.name} <span className="text-blue-700">(×{addon.quantity})</span>
                                          </span>
                                          <span className="text-xs text-blue-900 font-bold">
                                            +{((addon.price || 0) * (addon.quantity || 1)).toFixed(2)} ₪
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Total with Addons */}
                                {!item.is_custom && item.addons && item.addons.length > 0 && (
                                  <div className="flex items-center justify-between pt-2 mt-2 border-t-2 border-brand/20">
                                    <span className="text-sm font-bold text-gray-900">المجموع:</span>
                                    <span className="text-brand text-base font-bold">
                                      {(itemTotal + addonsTotal).toFixed(2)} ₪
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t mt-3 pt-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">المجموع الفرعي</span>
                      <span className="font-medium">{subOrder.subtotal.toFixed(2)} ₪</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-600">رسوم التوصيل</span>
                      <span className="font-medium">{subOrder.delivery_fee.toFixed(2)} ₪</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 mt-2">
                      <span className="font-bold text-gray-900">المجموع</span>
                      <span className="font-bold text-brand">{subOrder.total.toFixed(2)} ₪</span>
                    </div>
                  </div>
                </div>
                );
              })}

              {/* Total for all sub-orders */}
              <div className="bg-gradient-to-r from-brand to-red-700 rounded-xl p-4 text-white shadow-lg">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-white/90">
                    <span className="text-sm">المجموع الفرعي</span>
                    <span className="font-medium">
                      {subOrders.reduce((sum, order) => sum + Number(order.subtotal), 0).toFixed(2)} ₪
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-white/90">
                    <span className="text-sm">رسوم التوصيل ({subOrders.length} متاجر)</span>
                    <span className="font-medium">
                      {subOrders.reduce((sum, order) => sum + Number(order.delivery_fee), 0).toFixed(2)} ₪
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-white/30">
                    <span className="text-lg font-bold">المجموع الإجمالي</span>
                    <span className="text-2xl font-bold">
                      {subOrders.reduce((sum, order) => sum + Number(order.total), 0).toFixed(2)} ₪
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Single Vendor Order */
            <div className="bg-white rounded-xl p-4 shadow-sm">
              {/* Vendor Info Section */}
              {(orderDetails.vendor_name || orderDetails.vendor_id) && (
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200">
                  <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-brand shadow-sm flex-shrink-0">
                    {vendorInfo?.logo_url ? (
                      <img
                        src={vendorInfo.logo_url}
                        alt={orderDetails.vendor_name || vendorInfo?.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center">
                        <Store className="w-7 h-7 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">
                      {orderDetails.vendor_name || vendorInfo?.name || 'متجر'}
                    </p>
                    <p className="text-xs text-gray-500">المتجر</p>
                  </div>
                </div>
              )}

              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Package className="w-5 h-5 text-brand" />
                تفاصيل الطلب
              </h3>
              <div className="divide-y">
                {orderDetails.items_data?.map((item: any, index: number) => {
                // Check for image in multiple possible locations
                const productImage = item.image || item.image_url || (item.product_id ? productImages[item.product_id] : null);

                console.log(`🛍️ Displaying item ${index + 1}:`, {
                  name: item.name,
                  addons_count: item.addons?.length || 0,
                  addons: item.addons
                });

                // Calculate base price and addons total
                const itemPrice = item.price || 0;
                const itemTotal = itemPrice * item.quantity;
                const addonsTotal = (item.addons || []).reduce((sum: number, addon: any) => {
                  return sum + ((addon.price || 0) * (addon.quantity || 1));
                }, 0);

                return (
                  <div key={index} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                        {productImage ? (
                          <img
                            src={productImage}
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
                            {item.quantity > 1 && (
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
                          </div>
                        )}

                        {/* Quantity and Price */}
                        <div className="mt-2 space-y-2">
                          {!item.is_custom ? (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">الكمية: {item.quantity}</span>
                              <div className="text-brand text-lg font-bold">
                                {itemTotal.toFixed(2)} ₪
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-amber-700 font-medium">الكمية: 1</span>
                              <span className="text-amber-600 text-lg font-bold">يحدد لاحقاً</span>
                            </div>
                          )}

                          {/* Addons - Components (regular type) */}
                          {item.addons && item.addons.filter((a: any) => a.type === 'regular').length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <p className="text-xs font-bold text-emerald-700 mb-1.5">المكونات:</p>
                              <div className="flex flex-wrap gap-1.5">
                                {item.addons.filter((a: any) => a.type === 'regular').map((addon: any, addonIndex: number) => (
                                  <span key={addonIndex} className="text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                                    {addon.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Addons - Optional Type */}
                          {item.addons && item.addons.filter((a: any) => a.type !== 'regular').length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <div className="mb-2">
                                <span className="text-sm font-bold text-blue-700">الإضافات الاختيارية:</span>
                              </div>
                              <div className="space-y-2 bg-blue-50 p-3 rounded-lg">
                                {item.addons.filter((a: any) => a.type !== 'regular').map((addon: any, addonIndex: number) => (
                                  <div key={addonIndex} className="flex items-center justify-between">
                                    <span className="text-sm text-blue-900 font-medium">
                                      • {addon.name} <span className="text-blue-700">(×{addon.quantity})</span>
                                    </span>
                                    <span className="text-blue-900 font-bold">
                                      +{((addon.price || 0) * (addon.quantity || 1)).toFixed(2)} ₪
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Total with Addons */}
                          {!item.is_custom && item.addons && item.addons.length > 0 && (
                            <div className="flex items-center justify-between pt-3 mt-2 border-t-2 border-brand/20">
                              <span className="text-base font-bold text-gray-900">المجموع الكلي:</span>
                              <span className="text-brand text-xl font-bold">
                                {(itemTotal + addonsTotal).toFixed(2)} ₪
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="border-t mt-4 pt-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">المجموع الفرعي</span>
                <span className="font-medium">{orderDetails.subtotal.toFixed(2)} شيكل</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">رسوم التوصيل</span>
                <span className="font-medium">{orderDetails.delivery_fee.toFixed(2)} شيكل</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-bold text-gray-900">المجموع الكلي</span>
                <span className="font-bold text-brand text-lg">{orderDetails.total.toFixed(2)} شيكل</span>
              </div>
            </div>
            </div>
          )}

          {/* Order Notes */}
          {orderDetails.notes && (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-2">ملاحظات الطلب</h3>
              <p className="text-gray-600 bg-gray-50 p-3 rounded-lg">{orderDetails.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Rating Modal */}
      <RatingModal
        isOpen={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        orderId={orderId}
        type={ratingType}
        name={ratingType === 'store' ? orderDetails.vendor_name : orderDetails.driver_name || 'السائق'}
        entityId={ratingType === 'store' ? orderDetails.vendor_id : undefined}
      />
    </div>
  );
};

export default OrderTrackingPage;