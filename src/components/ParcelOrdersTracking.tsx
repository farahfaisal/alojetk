import React, { useState, useEffect } from 'react';
import { X, Package, MapPin, Phone, User, Clock, CheckCircle, XCircle, Loader2, AlertCircle, Calendar, Banknote, Wallet, Navigation, Truck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ParcelOrdersTrackingProps {
  onClose: () => void;
}

interface ParcelOrder {
  id: string;
  order_number: string;
  sender_name: string;
  sender_phone: string;
  sender_address: string;
  sender_city?: string;
  receiver_name: string;
  receiver_phone: string;
  receiver_address: string;
  receiver_city?: string;
  parcel_type?: string;
  description?: string;
  notes?: string;
  status: string;
  delivery_fee: number;
  distance?: number;
  payment_method: 'cash' | 'wallet';
  created_at: string;
  updated_at: string;
  accepted_at?: string;
  picked_up_at?: string;
  delivered_at?: string;
  cancelled_at?: string;
}

const statusConfig: Record<string, any> = {
  pending: {
    label: 'قيد الانتظار',
    color: 'bg-yellow-500',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-700',
    icon: Clock
  },
  accepted: {
    label: 'تم القبول',
    color: 'bg-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
    icon: CheckCircle
  },
  picked_up: {
    label: 'تم الاستلام',
    color: 'bg-purple-500',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-700',
    icon: Navigation
  },
  in_transit: {
    label: 'جاري التوصيل',
    color: 'bg-indigo-500',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    textColor: 'text-indigo-700',
    icon: Truck
  },
  delivered: {
    label: 'تم التسليم',
    color: 'bg-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-700',
    icon: CheckCircle
  },
  cancelled: {
    label: 'ملغي',
    color: 'bg-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-700',
    icon: XCircle
  }
};

const ParcelOrdersTracking: React.FC<ParcelOrdersTrackingProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<ParcelOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<ParcelOrder | null>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    fetchOrders();

    const channel = supabase
      .channel('parcel_orders_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'parcel_orders',
          filter: `sender_phone=eq.${user?.phone}`
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      document.body.style.overflow = '';
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchOrders = async () => {
    if (!user) {
      console.log('❌ No user found');
      return;
    }

    try {
      setLoading(true);
      const customerId = user.customer_id || user.id;
      console.log('🔍 Fetching parcel orders for customer_id:', customerId);

      const { data, error } = await supabase
        .from('parcel_orders')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      console.log('📦 Parcel orders response:', { data, error, count: data?.length });

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error('❌ Error fetching parcel orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-PS', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('هل أنت متأكد من إلغاء هذا الطلب؟')) return;

    try {
      const { error } = await supabase
        .from('parcel_orders')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .eq('customer_id', user?.customer_id || user?.id)
        .eq('status', 'pending');

      if (error) throw error;

      fetchOrders();
      setSelectedOrder(null);
      alert('تم إلغاء الطلب بنجاح');
    } catch (err: any) {
      console.error('Error cancelling order:', err);
      alert('حدث خطأ أثناء إلغاء الطلب');
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/10 z-[9998] backdrop-blur-lg"
        onClick={onClose}
      />

      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed inset-0 z-40 bg-gray-50 overflow-hidden"
        style={{
          paddingTop: 'max(env(safe-area-inset-top), 0px)',
          paddingBottom: 'calc(62px + env(safe-area-inset-bottom))'
        }}
      >
        <div className="h-full flex flex-col">
          <div className="bg-gradient-to-r from-brand to-red-600 text-white px-4 py-4 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <Package className="w-6 h-6" />
              <h2 className="text-xl font-bold">طلبات الطرود</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-brand" />
              </div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <Package className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg font-medium">لا توجد طلبات حتى الآن</p>
                <p className="text-sm mt-2">اطلب الآن لتبدأ توصيل طردك</p>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => {
                  const config = statusConfig[order.status] || statusConfig.pending;
                  const StatusIcon = config.icon;

                  return (
                    <motion.div
                      key={order.id}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => setSelectedOrder(order)}
                      className={`${config.bgColor} ${config.borderColor} border-2 rounded-xl p-4 shadow-md hover:shadow-lg transition-all cursor-pointer`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className={`${config.color} text-white px-3 py-1 rounded-full flex items-center gap-2 text-sm font-bold`}>
                          <StatusIcon className="w-4 h-4" />
                          {config.label}
                        </div>
                        <div className="text-xs text-gray-600">
                          #{order.order_number}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                          </div>
                          <div className="flex-1">
                            <p className="text-xs text-gray-600 mb-1">من: {order.sender_name}</p>
                            <p className="font-medium text-gray-800 text-sm">{order.sender_address}</p>
                          </div>
                        </div>

                        <div className="mr-3 border-r-2 border-dashed border-gray-300 h-4"></div>

                        <div className="flex items-start gap-2">
                          <div className="w-6 h-6 rounded-full bg-red-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <MapPin className="w-4 h-4 text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs text-gray-600 mb-1">إلى: {order.receiver_name}</p>
                            <p className="font-medium text-gray-800 text-sm">{order.receiver_address}</p>
                          </div>
                        </div>
                      </div>

                      {order.parcel_type && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Package className="w-4 h-4" />
                            <span>{order.parcel_type}</span>
                          </div>
                        </div>
                      )}

                      <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {order.payment_method === 'cash' ? (
                            <Banknote className="w-5 h-5 text-green-600" />
                          ) : (
                            <Wallet className="w-5 h-5 text-blue-600" />
                          )}
                          <span className="text-sm text-gray-600">
                            {order.payment_method === 'cash' ? 'كاش' : 'محفظة'}
                          </span>
                        </div>
                        <div className="text-lg font-bold text-brand">
                          {order.delivery_fee} ₪
                        </div>
                      </div>

                      <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                        <Calendar className="w-3 h-3" />
                        {new Date(order.created_at).toLocaleDateString('ar-PS')}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {selectedOrder && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-[10000] backdrop-blur-sm"
              onClick={() => setSelectedOrder(null)}
            />

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[10001] bg-white rounded-2xl shadow-2xl max-h-[80vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-gradient-to-r from-brand to-red-600 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
                <h3 className="text-lg font-bold">تفاصيل الطلب #{selectedOrder.order_number}</h3>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className={`${statusConfig[selectedOrder.status]?.bgColor || statusConfig.pending.bgColor} ${statusConfig[selectedOrder.status]?.borderColor || statusConfig.pending.borderColor} border-2 rounded-xl p-4`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">الحالة</span>
                    <div className={`${statusConfig[selectedOrder.status]?.color || statusConfig.pending.color} text-white px-4 py-2 rounded-full flex items-center gap-2 font-bold`}>
                      {React.createElement(statusConfig[selectedOrder.status]?.icon || Clock, { className: 'w-5 h-5' })}
                      {statusConfig[selectedOrder.status]?.label || 'قيد الانتظار'}
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <h4 className="font-bold text-gray-800 mb-3">معلومات المرسل</h4>
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-gray-500" />
                    <span className="text-gray-700">{selectedOrder.sender_name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-gray-500" />
                    <span className="text-gray-700 dir-ltr text-right">{selectedOrder.sender_phone}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-gray-500 mt-1" />
                    <div>
                      <p className="text-gray-700">{selectedOrder.sender_address}</p>
                      {selectedOrder.sender_city && (
                        <p className="text-sm text-gray-500 mt-1">{selectedOrder.sender_city}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <h4 className="font-bold text-gray-800 mb-3">معلومات المستلم</h4>
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-gray-500" />
                    <span className="text-gray-700">{selectedOrder.receiver_name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-gray-500" />
                    <span className="text-gray-700 dir-ltr text-right">{selectedOrder.receiver_phone}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-gray-500 mt-1" />
                    <div>
                      <p className="text-gray-700">{selectedOrder.receiver_address}</p>
                      {selectedOrder.receiver_city && (
                        <p className="text-sm text-gray-500 mt-1">{selectedOrder.receiver_city}</p>
                      )}
                    </div>
                  </div>
                </div>

                {(selectedOrder.parcel_type || selectedOrder.description) && (
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                    <h4 className="font-bold text-gray-800">معلومات الطرد</h4>
                    {selectedOrder.parcel_type && (
                      <div className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-gray-500" />
                        <span className="text-gray-700">{selectedOrder.parcel_type}</span>
                      </div>
                    )}
                    {selectedOrder.description && (
                      <p className="text-sm text-gray-600">{selectedOrder.description}</p>
                    )}
                  </div>
                )}

                {selectedOrder.notes && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-yellow-800 mb-1">ملاحظات</p>
                        <p className="text-sm text-yellow-700">{selectedOrder.notes}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <h4 className="font-bold text-gray-800">التكلفة والدفع</h4>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">طريقة الدفع</span>
                    <div className="flex items-center gap-2">
                      {selectedOrder.payment_method === 'cash' ? (
                        <>
                          <Banknote className="w-5 h-5 text-green-600" />
                          <span className="font-medium">كاش</span>
                        </>
                      ) : (
                        <>
                          <Wallet className="w-5 h-5 text-blue-600" />
                          <span className="font-medium">محفظة</span>
                        </>
                      )}
                    </div>
                  </div>

                  {selectedOrder.distance && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">المسافة</span>
                      <span className="font-medium text-gray-800">{selectedOrder.distance} كم</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                    <span className="font-medium text-gray-800">تكلفة التوصيل</span>
                    <span className="text-xl font-bold text-brand">{selectedOrder.delivery_fee} ₪</span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">تاريخ الطلب</span>
                    <span className="text-gray-800">{formatDate(selectedOrder.created_at)}</span>
                  </div>
                  {selectedOrder.accepted_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">تاريخ القبول</span>
                      <span className="text-gray-800">{formatDate(selectedOrder.accepted_at)}</span>
                    </div>
                  )}
                  {selectedOrder.picked_up_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">تاريخ الاستلام</span>
                      <span className="text-gray-800">{formatDate(selectedOrder.picked_up_at)}</span>
                    </div>
                  )}
                  {selectedOrder.delivered_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">تاريخ التسليم</span>
                      <span className="text-gray-800">{formatDate(selectedOrder.delivered_at)}</span>
                    </div>
                  )}
                </div>

                {selectedOrder.status === 'pending' && (
                  <button
                    onClick={() => handleCancelOrder(selectedOrder.id)}
                    className="w-full bg-red-700 hover:bg-red-800 text-white py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-5 h-5" />
                    إلغاء الطلب
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default ParcelOrdersTracking;
