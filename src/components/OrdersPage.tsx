import React, { useState, useEffect } from 'react';
import { Package, Clock, Truck, Check, ChevronLeft, RefreshCw, Search, Filter, ChevronDown, Star, MapPin, Box, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import OrderTrackingPage from './OrderTrackingPage';
import BottomNav from './BottomNav';

interface OrdersPageProps {
  onClose: () => void;
  onOpenCart?: () => void;
  onOpenAccount?: () => void;
  onViewModeChange?: (mode: 'restaurants' | 'supermarket' | 'all') => void;
  viewMode?: 'restaurants' | 'supermarket' | 'all';
  cartItemsCount?: number;
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
  order_type?: string;
}

interface GroupedOrder extends Order {
  sub_orders?: Order[];
  total_vendors?: number;
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
  notes?: string;
  status: string;
  delivery_fee: number;
  distance?: number;
  payment_method: string;
  created_at: string;
  updated_at: string;
}

const OrdersPage: React.FC<OrdersPageProps> = ({
  onClose,
  onOpenCart,
  onOpenAccount,
  onViewModeChange,
  viewMode = 'restaurants',
  cartItemsCount = 0
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'restaurant' | 'parcel'>('restaurant');
  const [orders, setOrders] = useState<Order[]>([]);
  const [groupedOrders, setGroupedOrders] = useState<GroupedOrder[]>([]);
  const [parcelOrders, setParcelOrders] = useState<ParcelOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (activeTab === 'restaurant') {
      fetchOrders();
    } else {
      fetchParcelOrders();
    }
  }, [user, statusFilter, searchQuery, activeTab]);

  const fetchOrders = async () => {
    const phone = user?.phone;

    if (!phone) {
      setError('يجب تسجيل الدخول لعرض الطلبات');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('orders')
        .select('*')
        .eq('customer_phone', phone)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (searchQuery.trim()) {
        query = query.or(`order_number.ilike.%${searchQuery}%,vendor_name.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      const allOrders = data || [];

      // جلب items_data من جداول order_items و custom_order_items إذا كان فارغاً
      for (const order of allOrders) {
        if (!order.items_data || order.items_data.length === 0) {
          console.log('⚠️ items_data is empty for order', order.id, ', fetching from tables');

          const [regularItemsResult, customItemsResult] = await Promise.all([
            supabase.from('order_items').select('*').eq('order_id', order.id),
            supabase.from('custom_order_items').select('*').eq('order_id', order.id)
          ]);

          const items_data = [];

          if (regularItemsResult.data) {
            regularItemsResult.data.forEach(item => {
              items_data.push({
                product_id: item.product_id,
                name: item.name || item.product_name,
                price: item.price,
                quantity: item.quantity,
                variant_id: item.variant_id,
                variant_name: item.variant_name,
                addons: item.addons_data || [],
                is_custom: false
              });
            });
          }

          if (customItemsResult.data) {
            customItemsResult.data.forEach(item => {
              items_data.push({
                product_id: null,
                name: item.custom_product_name,
                price: item.price,
                quantity: item.quantity,
                custom_details: item.description || item.notes,
                is_custom: true
              });
            });
          }

          order.items_data = items_data;
          console.log('✅ Loaded items for order', order.id, ':', items_data.length, 'items');
        }
      }

      setOrders(allOrders);

      console.log('📦 All orders fetched:', allOrders.length);
      allOrders.forEach((order, index) => {
        console.log(`Order ${index + 1}:`, {
          id: order.id,
          order_number: order.order_number,
          is_multi_vendor: order.is_multi_vendor,
          order_group_id: order.order_group_id,
          vendor_name: order.vendor_name,
          items_data: order.items_data,
          items_count: order.items_data?.length || 0
        });
      });

      // Group multi-vendor orders
      const grouped = groupMultiVendorOrders(allOrders);
      console.log('📦 Grouped orders:', grouped.length);
      grouped.forEach((order, index) => {
        console.log(`Grouped ${index + 1}:`, {
          id: order.id,
          order_number: order.order_number,
          vendor_name: order.vendor_name,
          sub_orders_count: order.sub_orders?.length || 0,
          order_group_id: order.order_group_id
        });
      });
      setGroupedOrders(grouped);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('حدث خطأ في جلب الطلبات');
    } finally {
      setLoading(false);
    }
  };

  const groupMultiVendorOrders = (orders: Order[]): GroupedOrder[] => {
    const grouped: { [key: string]: GroupedOrder } = {};
    const standalone: GroupedOrder[] = [];

    orders.forEach(order => {
      if (order.is_multi_vendor && order.order_group_id) {
        if (!grouped[order.order_group_id]) {
          // Create parent order entry
          grouped[order.order_group_id] = {
            ...order,
            id: order.order_group_id, // Use group ID as the ID
            vendor_name: 'طلب متعدد المتاجر',
            sub_orders: [],
            total: 0,
            total_vendors: 0
          };
        }

        // Add to sub-orders
        grouped[order.order_group_id].sub_orders!.push(order);
        grouped[order.order_group_id].total += Number(order.total);
        grouped[order.order_group_id].total_vendors = grouped[order.order_group_id].sub_orders!.length;

        // Use the earliest created_at
        if (new Date(order.created_at) < new Date(grouped[order.order_group_id].created_at)) {
          grouped[order.order_group_id].created_at = order.created_at;
        }

        // Use the order number from the first sub-order
        if (grouped[order.order_group_id].sub_orders!.length === 1) {
          grouped[order.order_group_id].order_number = order.order_number;
        }

        // Determine the overall status based on all sub-orders
        const subOrders = grouped[order.order_group_id].sub_orders!;
        const statuses = subOrders.map(o => o.status);

        // Priority: cancelled > rejected > pending > processing > shipping > delivered > completed
        if (statuses.includes('cancelled')) {
          grouped[order.order_group_id].status = 'cancelled';
        } else if (statuses.includes('rejected')) {
          grouped[order.order_group_id].status = 'rejected';
        } else if (statuses.includes('pending')) {
          grouped[order.order_group_id].status = 'pending';
        } else if (statuses.includes('processing') || statuses.includes('accepted') || statuses.includes('ready') || statuses.includes('waiting-for-driver')) {
          grouped[order.order_group_id].status = 'processing';
        } else if (statuses.includes('shipping')) {
          grouped[order.order_group_id].status = 'shipping';
        } else if (statuses.every(s => s === 'delivered' || s === 'completed')) {
          grouped[order.order_group_id].status = 'delivered';
        } else {
          grouped[order.order_group_id].status = subOrders[0].status;
        }
      } else {
        // Standalone order
        standalone.push(order);
      }
    });

    // Combine grouped and standalone orders
    const result = [...Object.values(grouped), ...standalone];

    // Sort by created_at descending
    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return result;
  };

  const fetchParcelOrders = async () => {
    if (!user) {
      setError('يجب تسجيل الدخول لعرض الطلبات');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const customerId = user.customer_id || user.id;

      let query = supabase
        .from('parcel_orders')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (searchQuery.trim()) {
        query = query.or(`order_number.ilike.%${searchQuery}%,receiver_name.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setParcelOrders(data || []);
    } catch (err) {
      console.error('Error fetching parcel orders:', err);
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
      'waiting-for-driver': 'قيد التحضير',
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
      case 'waiting-for-driver':
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
      case 'waiting-for-driver':
        return 'bg-blue-100 text-blue-800';
      case 'ready':
      case 'shipping':
        return 'bg-orange-100 text-orange-800';
      case 'delivered':
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
      case 'rejected':
        return 'bg-[#1759cb]/10 text-[#1759cb]';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (selectedOrder) {
    return (
      <OrderTrackingPage
        orderId={selectedOrder}
        orderGroupId={selectedGroupId || undefined}
        onClose={() => {
          setSelectedOrder(null);
          setSelectedGroupId(null);
        }}
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
            onClick={activeTab === 'restaurant' ? fetchOrders : fetchParcelOrders}
            className="text-brand hover:text-brand-light"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="max-w-md mx-auto px-4 pb-4">
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('restaurant')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                activeTab === 'restaurant'
                  ? 'bg-white text-brand shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Package className="w-4 h-4" />
                <span>طلبات المطاعم</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('parcel')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                activeTab === 'parcel'
                  ? 'bg-white text-brand shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Box className="w-4 h-4" />
                <span>طلبات الطرود</span>
              </div>
            </button>
          </div>
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
      <div className="flex-1 overflow-y-auto pb-20" style={{
        paddingBottom: 'calc(120px + max(env(safe-area-inset-bottom), 0px))'
      }}>
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
            <div className="bg-[#1759cb]/10 text-[#1759cb] p-4 rounded-lg text-center">
              <Package className="w-12 h-12 text-[#1759cb] mx-auto mb-2" />
              <p>{error}</p>
            </div>
          ) : activeTab === 'restaurant' && groupedOrders.length === 0 ? (
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
          ) : activeTab === 'parcel' && parcelOrders.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Box className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">لا توجد طلبات طرود</h3>
              <p className="text-gray-500 mb-6">لم تقم بإنشاء أي طلبات طرود بعد</p>
            </div>
          ) : activeTab === 'restaurant' ? (
            <div className="space-y-4">
              {groupedOrders.map((order) => (
                <motion.div
                  key={order.id}
                  whileHover={{ scale: 1.01 }}
                  className="bg-white rounded-lg p-4 border border-gray-200 transition-all hover:shadow-[0_8px_30px_rgba(23,89,203,0.35)] hover:border-[#1759cb]/40"
                  style={{ boxShadow: '0 2px 12px rgba(23,89,203,0.08)' }}
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
                          {order.sub_orders && order.sub_orders.length > 0 && (
                            <p className="text-xs text-blue-600 mt-1">
                              {order.total_vendors} متاجر
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-brand">{Number(order.total).toFixed(2)} شيكل</p>
                          <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                            {getStatusText(order.status)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                        <span>{new Date(order.created_at).toLocaleDateString('ar')}</span>
                        <span>•</span>
                        <span>
                          {order.sub_orders
                            ? `${order.sub_orders.reduce((acc, o) => acc + (o.items_data?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 0), 0)} منتج`
                            : `${order.items_data?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 0} منتج`
                          }
                        </span>
                        <span>•</span>
                        <span>{order.payment_method === 'cash' ? 'نقدي' : 'محفظة'}</span>
                      </div>

                      {order.sub_orders && order.sub_orders.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-xs text-gray-500 mb-2">المتاجر في هذا الطلب:</p>
                          <div className="flex flex-wrap gap-2">
                            {order.sub_orders.map((subOrder, idx) => (
                              <div key={subOrder.id} className="text-xs bg-gray-100 px-2 py-1 rounded">
                                {subOrder.vendor_name}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          console.log('🔍 Order clicked:', {
                            id: order.id,
                            order_number: order.order_number,
                            has_sub_orders: !!(order.sub_orders && order.sub_orders.length > 0),
                            sub_orders_count: order.sub_orders?.length || 0,
                            order_group_id: order.order_group_id
                          });

                          if (order.sub_orders && order.sub_orders.length > 0) {
                            console.log('🔍 Opening multi-vendor order:', {
                              firstOrderId: order.sub_orders[0].id,
                              groupId: order.order_group_id
                            });
                            setSelectedOrder(order.sub_orders[0].id);
                            setSelectedGroupId(order.order_group_id || null);
                          } else {
                            console.log('🔍 Opening single vendor order:', order.id);
                            setSelectedOrder(order.id);
                            setSelectedGroupId(null);
                          }
                        }}
                        className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand text-white rounded-lg hover:bg-brand-light transition-colors font-medium"
                      >
                        <Eye className="w-4 h-4" />
                        <span>عرض التفاصيل</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {parcelOrders.map((order) => (
                <motion.div
                  key={order.id}
                  whileHover={{ scale: 1.01 }}
                  className="bg-white rounded-lg p-4 border border-gray-200 transition-all hover:shadow-[0_8px_30px_rgba(23,89,203,0.35)] hover:border-[#1759cb]/40"
                  style={{ boxShadow: '0 2px 12px rgba(23,89,203,0.08)' }}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-lg bg-brand/10 flex items-center justify-center flex-shrink-0">
                      <Box className="w-6 h-6 text-brand" />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-bold text-gray-900">
                            طلب رقم {order.order_number}
                          </h3>
                          <p className="text-sm text-gray-600">
                            من: {order.sender_city || order.sender_address}
                          </p>
                          <p className="text-sm text-gray-600">
                            إلى: {order.receiver_city || order.receiver_address}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-brand">{Number(order.delivery_fee).toFixed(2)} شيكل</p>
                          <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                            {getStatusText(order.status)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{new Date(order.created_at).toLocaleDateString('ar')}</span>
                        <span>•</span>
                        <span>المستلم: {order.receiver_name}</span>
                        <span>•</span>
                        <span>{order.payment_method === 'cash' ? 'نقدي' : 'محفظة'}</span>
                      </div>

                      {order.notes && (
                        <p className="mt-2 text-sm text-gray-500 bg-gray-50 p-2 rounded">
                          {order.notes}
                        </p>
                      )}

                      <button
                        onClick={() => {
                          window.location.href = `/parcel-tracking/${order.id}`;
                        }}
                        className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand text-white rounded-lg hover:bg-brand-light transition-colors font-medium"
                      >
                        <Eye className="w-4 h-4" />
                        <span>عرض التفاصيل</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav
        onOpenCart={() => {
          onClose();
          setTimeout(() => {
            if (onOpenCart) onOpenCart();
          }, 100);
        }}
        onOpenAccount={() => {
          onClose();
          setTimeout(() => {
            if (onOpenAccount) onOpenAccount();
          }, 100);
        }}
        onOpenOrders={() => {}}
        viewMode={viewMode}
        onViewModeChange={(mode) => {
          onClose();
          setTimeout(() => {
            if (onViewModeChange) onViewModeChange(mode);
          }, 100);
        }}
        cartItemsCount={cartItemsCount}
        isAccountOpen={false}
        isOrdersOpen={true}
        isCartOpen={false}
      />
    </div>
  );
};

export default OrdersPage;