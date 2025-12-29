import React, { useState, useEffect } from 'react';
import { Package, Clock, Truck, Check, ChevronLeft, RefreshCw, Search, Filter, ChevronDown, Star, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import OrderTrackingPage from './OrderTrackingPage';
import CaptainRequestsTracking from './CaptainRequestsTracking';

interface OrdersPageProps {
  onClose: () => void;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  total: number;
  vendor_name: string;
  created_at: string;
  items_data: any[];
  address: string;
  payment_method: string;
  is_multi_vendor?: boolean;
  order_group_id?: string;
  vendor_order_index?: number;
  total_vendors?: number;
  type: 'order';
}

interface CaptainRequest {
  id: string;
  status: string;
  estimated_fare: number;
  final_fare?: number;
  pickup_address: string;
  destination_address: string;
  created_at: string;
  payment_method: string;
  type: 'captain_request';
}

interface OrderGroup {
  order_group_id: string;
  orders: Order[];
  total: number;
  created_at: string;
  status: string;
  order_number: string;
  type: 'group';
}

const OrdersPage: React.FC<OrdersPageProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [captainRequests, setCaptainRequests] = useState<CaptainRequest[]>([]);
  const [groupedOrders, setGroupedOrders] = useState<(Order | OrderGroup | CaptainRequest)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [selectedCaptainRequest, setSelectedCaptainRequest] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, [user, statusFilter, searchQuery]);

  const groupOrdersByGroupId = (ordersList: Order[], captainRequestsList: CaptainRequest[]): (Order | OrderGroup | CaptainRequest)[] => {
    const grouped: { [key: string]: Order[] } = {};
    const single: Order[] = [];

    ordersList.forEach(order => {
      if (order.is_multi_vendor && order.order_group_id) {
        if (!grouped[order.order_group_id]) {
          grouped[order.order_group_id] = [];
        }
        grouped[order.order_group_id].push(order);
      } else {
        single.push(order);
      }
    });

    const result: (Order | OrderGroup | CaptainRequest)[] = [];

    // Add grouped orders
    Object.entries(grouped).forEach(([groupId, groupOrders]) => {
      // Sort by vendor_order_index
      groupOrders.sort((a, b) => (a.vendor_order_index || 0) - (b.vendor_order_index || 0));

      const group: OrderGroup = {
        order_group_id: groupId,
        orders: groupOrders,
        total: groupOrders.reduce((sum, order) => sum + order.total, 0),
        created_at: groupOrders[0].created_at,
        status: groupOrders[0].status,
        order_number: groupOrders[0].order_number,
        type: 'group'
      };
      result.push(group);
    });

    // Add single orders
    single.forEach(order => result.push(order));

    // Add captain requests
    captainRequestsList.forEach(request => result.push(request));

    // Sort by created_at
    result.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });

    return result;
  };

  const fetchOrders = async () => {
    const customerId = user?.customer_id || user?.id;

    if (!customerId) {
      setError('يجب تسجيل الدخول لعرض الطلبات');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch regular orders
      let ordersQuery = supabase
        .from('orders')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      // Apply status filter
      if (statusFilter !== 'all') {
        ordersQuery = ordersQuery.eq('status', statusFilter);
      }

      // Apply search filter
      if (searchQuery.trim()) {
        ordersQuery = ordersQuery.or(`order_number.ilike.%${searchQuery}%,vendor_name.ilike.%${searchQuery}%`);
      }

      // Fetch captain requests
      let captainQuery = supabase
        .from('captain_requests')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      // Apply status filter
      if (statusFilter !== 'all') {
        captainQuery = captainQuery.eq('status', statusFilter);
      }

      // Apply search filter for captain requests
      if (searchQuery.trim()) {
        captainQuery = captainQuery.or(`pickup_address.ilike.%${searchQuery}%,destination_address.ilike.%${searchQuery}%`);
      }

      const [ordersResult, captainResult] = await Promise.all([
        ordersQuery,
        captainQuery
      ]);

      if (ordersResult.error) throw ordersResult.error;
      if (captainResult.error) throw captainResult.error;

      const ordersData = (ordersResult.data || []).map(order => ({ ...order, type: 'order' as const }));
      const captainData = (captainResult.data || []).map(req => ({ ...req, type: 'captain_request' as const }));

      setOrders(ordersData);
      setCaptainRequests(captainData);
      setGroupedOrders(groupOrdersByGroupId(ordersData, captainData));
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('حدث خطأ في جلب الطلبات');
    } finally {
      setLoading(false);
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
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'accepted':
      case 'processing':
        return <Package className="w-4 h-4 text-blue-500" />;
      case 'ready':
      case 'shipping':
        return <Truck className="w-4 h-4 text-orange-500" />;
      case 'delivered':
      case 'completed':
        return <Check className="w-4 h-4 text-green-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
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

  if (selectedCaptainRequest) {
    return (
      <CaptainRequestsTracking
        onClose={() => setSelectedCaptainRequest(null)}
      />
    );
  }

  if (selectedOrder) {
    return (
      <OrderTrackingPage
        orderId={selectedOrder}
        onClose={() => setSelectedOrder(null)}
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
            <Package className="w-6 h-6 text-brand" />
            طلباتي
          </h2>
          <button
            onClick={fetchOrders}
            className="text-brand hover:text-brand-light"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white shadow-sm">
        <div className="max-w-md mx-auto p-4 space-y-4">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="ابحث في طلباتك..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 pr-10 bg-gray-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          </div>

          {/* Filters */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-brand"
            >
              <Filter className="w-5 h-5" />
              <span className="font-medium">تصفية</span>
            </button>
            <motion.div
              animate={{ rotate: showFilters ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-5 h-5 text-gray-500" />
            </motion.div>
          </div>

          {/* Filter Options */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-4 border-t">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    حالة الطلب
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    <option value="all">جميع الطلبات</option>
                    <option value="pending">في انتظار الموافقة</option>
                    <option value="accepted">تم القبول</option>
                    <option value="processing">جاري التحضير</option>
                    <option value="shipping">في الطريق</option>
                    <option value="delivered">تم التوصيل</option>
                    <option value="completed">مكتمل</option>
                    <option value="cancelled">ملغي</option>
                  </select>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto p-4">
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, index) => (
                <div key={index} className="bg-white rounded-lg p-4 border border-gray-200 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                    <div className="flex-1">
                      <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-800 p-4 rounded-lg text-center">
              <Package className="w-12 h-12 text-red-600 mx-auto mb-2" />
              <p>{error}</p>
            </div>
          ) : groupedOrders.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">لا توجد طلبات</h3>
              <p className="text-gray-500 mb-6">لم تقم بإنشاء أي طلبات بعد</p>
              <button
                onClick={onClose}
                className="bg-brand text-white px-6 py-3 rounded-lg hover:bg-brand-light transition-colors"
              >
                ابدأ التسوق
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedOrders.map((item) => {
                // Check if it's an OrderGroup
                const isGroup = 'orders' in item;

                if (isGroup) {
                  const group = item as OrderGroup;
                  const totalItems = group.orders.reduce((sum, order) => sum + (order.items_data?.length || 0), 0);

                  return (
                    <motion.div
                      key={group.order_group_id}
                      whileHover={{ scale: 1.01 }}
                      onClick={() => setSelectedOrder(group.orders[0].id)}
                      className="bg-white rounded-lg p-4 border-2 border-brand/30 shadow-md transition-all cursor-pointer"
                    >
                      {/* Multi-vendor badge */}
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-brand/20">
                        <div className="flex items-center gap-2">
                          <div className="bg-brand/10 text-brand px-3 py-1 rounded-full text-xs font-bold">
                            طلب متعدد المتاجر
                          </div>
                          <span className="text-xs text-gray-600">
                            {group.orders.length} متاجر
                          </span>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(group.status)}`}>
                          {getStatusText(group.status)}
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-brand to-brand-light flex items-center justify-center flex-shrink-0">
                          {getStatusIcon(group.status)}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h3 className="font-bold text-gray-900">
                                طلب رقم {group.order_number || group.order_group_id.slice(-6)}
                              </h3>
                              <div className="text-sm text-gray-600 mt-1 space-y-1">
                                {group.orders.map((order, idx) => (
                                  <div key={order.id} className="flex items-center gap-1">
                                    <span className="text-brand">•</span>
                                    <span>{order.vendor_name}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-brand text-lg">{group.total.toFixed(2)} شيكل</p>
                              <p className="text-xs text-gray-500">المجموع الكلي</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
                            <span>{new Date(group.created_at).toLocaleDateString('ar')}</span>
                            <span>•</span>
                            <span>{totalItems} منتج</span>
                            <span>•</span>
                            <span>{group.orders[0].payment_method === 'cash' ? 'نقدي' : 'محفظة'}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                } else if (item.type === 'captain_request') {
                  // Captain request
                  const request = item as CaptainRequest;
                  return (
                    <motion.div
                      key={request.id}
                      whileHover={{ scale: 1.01 }}
                      onClick={() => setSelectedCaptainRequest(request.id)}
                      className="bg-white rounded-lg p-4 border-2 border-orange-200 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-orange-100">
                        <div className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                          <Truck className="w-3 h-3" />
                          طلب توصيل طرود
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                          {getStatusText(request.status)}
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                          {getStatusIcon(request.status)}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-start gap-2 mb-2">
                                <MapPin className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="text-xs text-gray-500">من</p>
                                  <p className="text-sm font-medium text-gray-900">{request.pickup_address}</p>
                                </div>
                              </div>
                              <div className="flex items-start gap-2">
                                <MapPin className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="text-xs text-gray-500">إلى</p>
                                  <p className="text-sm font-medium text-gray-900">{request.destination_address}</p>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-orange-600 text-lg">
                                {(request.final_fare || request.estimated_fare).toFixed(2)} شيكل
                              </p>
                              <p className="text-xs text-gray-500">
                                {request.final_fare ? 'السعر النهائي' : 'السعر التقديري'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
                            <span>{new Date(request.created_at).toLocaleDateString('ar')}</span>
                            <span>•</span>
                            <span>{request.payment_method === 'cash' ? 'نقدي' : 'محفظة'}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                } else {
                  // Single order
                  const order = item as Order;
                  return (
                    <motion.div
                      key={order.id}
                      whileHover={{ scale: 1.01 }}
                      onClick={() => setSelectedOrder(order.id)}
                      className="bg-white rounded-lg p-4 border border-gray-200 transition-all cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-lg bg-brand/10 flex items-center justify-center flex-shrink-0">
                          {getStatusIcon(order.status)}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h3 className="font-bold text-gray-900">
                                طلب رقم {order.order_number || order.id.slice(-6)}
                              </h3>
                              <p className="text-sm text-gray-600">{order.vendor_name}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-brand">{order.total.toFixed(2)} شيكل</p>
                              <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                                {getStatusText(order.status)}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span>{new Date(order.created_at).toLocaleDateString('ar')}</span>
                            <span>•</span>
                            <span>{order.items_data?.length || 0} منتج</span>
                            <span>•</span>
                            <span>{order.payment_method === 'cash' ? 'نقدي' : 'محفظة'}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                }
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrdersPage;