import React, { useState, useEffect } from 'react';
import { Package, Clock, Truck, Check, MapPin, Phone, Star, ChevronLeft, RefreshCw, Store, User, Headphones } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import RatingModal from './RatingModal';

interface OrderTrackingPageProps {
  orderId: string;
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
}

interface VendorInfo {
  id: string;
  name: string;
  logo_url: string;
}

interface ProductImage {
  [productId: string]: string;
}

const OrderTrackingPage: React.FC<OrderTrackingPageProps> = ({ orderId, onClose }) => {
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [orderHistory, setOrderHistory] = useState<OrderStatus[]>([]);
  const [productImages, setProductImages] = useState<ProductImage>({});
  const [vendorInfo, setVendorInfo] = useState<VendorInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingType, setRatingType] = useState<'driver' | 'store'>('store');

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
          .select('id, name, logo_url')
          .eq('id', data.vendor_id)
          .maybeSingle();

        if (!vendorError && vendor) {
          setVendorInfo(vendor);
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
    <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col">
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
        <div className="max-w-md mx-auto p-4 space-y-6">
          {/* Order Header */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            {/* Vendor Logo and Name */}
            {vendorInfo && (
              <div className="flex items-center justify-center gap-3 mb-4 pb-4 border-b">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-brand shadow-md">
                  {vendorInfo.logo_url ? (
                    <img
                      src={vendorInfo.logo_url}
                      alt={vendorInfo.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-brand flex items-center justify-center">
                      <Store className="w-8 h-8 text-white" />
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">المتجر</p>
                  <p className="text-lg font-bold text-gray-900">{vendorInfo.name}</p>
                </div>
              </div>
            )}

            <div className="text-center mb-4">
              <h3 className="text-2xl font-bold text-gray-900">
                طلب رقم {orderDetails.order_number || orderDetails.id.slice(-6)}
              </h3>
              <div className={`inline-block px-4 py-2 rounded-full text-sm font-bold mt-2 ${getStatusColor(orderDetails.status)}`}>
                {getStatusText(orderDetails.status)}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-brand">{orderDetails.total.toFixed(2)}</div>
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

          {/* Order Items */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Package className="w-5 h-5 text-brand" />
              تفاصيل الطلب
            </h3>
            <div className="space-y-3">
              {orderDetails.items_data?.map((item: any, index: number) => {
                // Check for image in multiple possible locations
                const productImage = item.image || item.image_url || (item.product_id ? productImages[item.product_id] : null);

                return (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {productImage ? (
                        <img
                          src={productImage}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-lg text-gray-900 truncate">{item.name}</h4>
                      {item.variant_name && (
                        <p className="text-sm text-gray-600">النوع: {item.variant_name}</p>
                      )}
                      <p className="text-sm text-gray-600">الكمية: {item.quantity}</p>
                      {item.addons && item.addons.length > 0 && (
                        <div className="text-xs text-gray-500">
                          الإضافات: {item.addons.map((addon: any) => addon.name).join(', ')}
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-brand">{item.price.toFixed(2)} شيكل</p>
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