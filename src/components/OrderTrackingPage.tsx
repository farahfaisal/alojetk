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
  driver_name?: string;
  created_at: string;
  estimated_total_time?: number;
  items_data: any[];
}

const OrderTrackingPage: React.FC<OrderTrackingPageProps> = ({ orderId, onClose }) => {
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [orderHistory, setOrderHistory] = useState<OrderStatus[]>([]);
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
            {orderHistory.length > 0 ? (
              <div className="space-y-0 relative">
                {/* Timeline dots line */}
                <div className="absolute left-6 top-14 bottom-14 w-0.5 bg-gradient-to-b from-green-300 via-red-300 to-gray-200"
                     style={{
                       height: `calc(100% - ${orderHistory.length * 4}rem)`,
                       top: '3.5rem'
                     }}
                />

                {orderHistory.map((status, index) => {
                  const isCompleted = index < orderHistory.length - 1 ||
                                      ['delivered', 'completed', 'shipping', 'ready', 'processing', 'accepted'].includes(status.status);
                  const isCurrent = index === orderHistory.length - 1 &&
                                    !['delivered', 'completed', 'cancelled', 'rejected'].includes(status.status);
                  const isLastPending = index === orderHistory.length - 1 &&
                                         status.status === 'pending';

                  return (
                    <div key={status.id} className="flex items-stretch gap-0 relative mb-0">
                      {/* Timeline Circle Icon */}
                      <div className="flex flex-col items-center z-10 w-12 flex-shrink-0">
                        <div className={`
                          w-12 h-12 rounded-full flex items-center justify-center
                          ${isCompleted ? 'bg-green-500' : isCurrent ? 'bg-red-500' : 'bg-white border-2 border-gray-300'}
                          ${isLastPending ? 'bg-red-500 shadow-lg' : ''}
                        `}>
                          {isCompleted ? (
                            <Check className="w-6 h-6 text-white" />
                          ) : isCurrent ? (
                            <Check className="w-6 h-6 text-white" />
                          ) : isLastPending ? (
                            <Check className="w-6 h-6 text-white" />
                          ) : (
                            <div className={`w-3 h-3 rounded-full bg-gray-300`} />
                          )}
                        </div>
                      </div>

                      {/* Status Card */}
                      <div className={`
                        flex-1 rounded-2xl p-5 mb-2 ml-2 mr-2
                        ${isCompleted ? 'bg-gradient-to-r from-green-500 to-green-600 text-white' :
                          isCurrent ? 'bg-gradient-to-r from-red-500 to-red-600 text-white border-2 border-red-700' : 'bg-white border border-gray-200'}
                      `}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className={`font-bold text-lg mb-1 ${isCompleted || isCurrent ? 'text-white' : 'text-gray-900'}`}>
                              {getStatusText(status.status)}
                            </h4>
                            {status.note && (
                              <p className={`text-sm ${isCompleted || isCurrent ? 'text-white/90' : 'text-gray-600'}`}>
                                {status.note}
                              </p>
                            )}
                            {status.driver_name && (
                              <p className={`text-sm ${isCompleted || isCurrent ? 'text-white/90' : 'text-gray-600'}`}>
                                السائق: {status.driver_name}
                              </p>
                            )}
                          </div>
                          <div className={`text-right ${isCompleted || isCurrent ? 'text-white' : 'text-gray-900'}`}>
                            <p className="text-sm font-medium">
                              {new Date(status.created_at).toLocaleTimeString('ar', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                        {isCompleted && (
                          <div className="absolute top-5 left-5">
                            <Check className="w-7 h-7 text-green-400" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-stretch gap-0 relative">
                <div className="flex flex-col items-center z-10 w-12 flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-rose-700 flex items-center justify-center">
                    {getStatusIcon(orderDetails.status)}
                  </div>
                </div>
                <div className="flex-1 bg-gradient-to-r from-rose-700 to-rose-600 text-white rounded-2xl p-5 ml-2 mr-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-bold text-lg text-white">{getStatusText(orderDetails.status)}</h4>
                    </div>
                    <div className="text-white">
                      <p className="text-sm font-medium">
                        {new Date(orderDetails.created_at).toLocaleTimeString('ar', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
              {orderDetails.items_data?.map((item: any, index: number) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Package className="w-6 h-6 text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{item.name}</h4>
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
                  <div className="text-right">
                    <p className="font-bold text-brand">{item.price.toFixed(2)} شيكل</p>
                  </div>
                </div>
              ))}
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