import React, { useState, useEffect } from 'react';
import { X, Navigation, MapPin, Phone, User, Clock, CheckCircle, XCircle, Loader2, AlertCircle, Calendar, Banknote, Wallet } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface CaptainRequestsTrackingProps {
  onClose: () => void;
}

interface CaptainRequest {
  id: string;
  customer_name: string;
  customer_phone: string;
  pickup_address: string;
  destination_address: string;
  notes?: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  estimated_fare?: number;
  final_fare?: number;
  payment_method: 'cash' | 'wallet';
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

const statusConfig = {
  pending: {
    label: 'قيد الانتظار',
    color: 'bg-yellow-500',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-700',
    icon: Clock
  },
  assigned: {
    label: 'تم التعيين',
    color: 'bg-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
    icon: User
  },
  in_progress: {
    label: 'جاري التنفيذ',
    color: 'bg-purple-500',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-700',
    icon: Navigation
  },
  completed: {
    label: 'مكتمل',
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

const CaptainRequestsTracking: React.FC<CaptainRequestsTrackingProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<CaptainRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<CaptainRequest | null>(null);

  useEffect(() => {
    fetchRequests();

    const channel = supabase
      .channel('captain_requests_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'captain_requests',
          filter: `customer_id=eq.${user?.id}`
        },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchRequests = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('captain_requests')
        .select('*')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error('Error fetching captain requests:', err);
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

  const handleCancelRequest = async (requestId: string) => {
    if (!confirm('هل أنت متأكد من إلغاء هذا الطلب؟')) return;

    try {
      const { error } = await supabase
        .from('captain_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId)
        .eq('customer_id', user?.id)
        .eq('status', 'pending');

      if (error) throw error;

      fetchRequests();
      setSelectedRequest(null);
      alert('تم إلغاء الطلب بنجاح');
    } catch (err: any) {
      console.error('Error cancelling request:', err);
      alert('حدث خطأ أثناء إلغاء الطلب');
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-[9998] backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed inset-0 z-[9999] bg-gray-50 overflow-hidden"
        style={{
          paddingTop: 'max(env(safe-area-inset-top), 0px)',
          paddingBottom: 'max(env(safe-area-inset-bottom), 0px)'
        }}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-brand to-red-600 text-white px-4 py-4 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <Navigation className="w-6 h-6" />
              <h2 className="text-xl font-bold">طلبات الكابتن</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-brand" />
              </div>
            ) : requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <Navigation className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg font-medium">لا توجد طلبات حتى الآن</p>
                <p className="text-sm mt-2">اطلب الآن لتبدأ توصيل طردك</p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((request) => {
                  const config = statusConfig[request.status];
                  const StatusIcon = config.icon;

                  return (
                    <motion.div
                      key={request.id}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => setSelectedRequest(request)}
                      className={`${config.bgColor} ${config.borderColor} border-2 rounded-xl p-4 shadow-md hover:shadow-lg transition-all cursor-pointer`}
                    >
                      {/* Status Badge */}
                      <div className="flex items-center justify-between mb-3">
                        <div className={`${config.color} text-white px-3 py-1 rounded-full flex items-center gap-2 text-sm font-bold`}>
                          <StatusIcon className="w-4 h-4" />
                          {config.label}
                        </div>
                        <div className="flex items-center gap-2 text-gray-600 text-xs">
                          <Calendar className="w-4 h-4" />
                          {new Date(request.created_at).toLocaleDateString('ar-PS')}
                        </div>
                      </div>

                      {/* Route */}
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                          </div>
                          <div className="flex-1">
                            <p className="text-xs text-gray-600 mb-1">من</p>
                            <p className="font-medium text-gray-800">{request.pickup_address}</p>
                          </div>
                        </div>

                        <div className="mr-3 border-r-2 border-dashed border-gray-300 h-4"></div>

                        <div className="flex items-start gap-2">
                          <div className="w-6 h-6 rounded-full bg-red-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <MapPin className="w-4 h-4 text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs text-gray-600 mb-1">إلى</p>
                            <p className="font-medium text-gray-800">{request.destination_address}</p>
                          </div>
                        </div>
                      </div>

                      {/* Fare & Payment */}
                      {request.estimated_fare && (
                        <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {request.payment_method === 'cash' ? (
                              <Banknote className="w-5 h-5 text-green-600" />
                            ) : (
                              <Wallet className="w-5 h-5 text-blue-600" />
                            )}
                            <span className="text-sm text-gray-600">
                              {request.payment_method === 'cash' ? 'كاش' : 'محفظة'}
                            </span>
                          </div>
                          <div className="text-lg font-bold text-brand">
                            {request.final_fare || request.estimated_fare} ₪
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Request Details Modal */}
      <AnimatePresence>
        {selectedRequest && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-[10000] backdrop-blur-sm"
              onClick={() => setSelectedRequest(null)}
            />

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[10001] bg-white rounded-2xl shadow-2xl max-h-[80vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-gradient-to-r from-brand to-red-600 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
                <h3 className="text-lg font-bold">تفاصيل الطلب</h3>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Status */}
                <div className={`${statusConfig[selectedRequest.status].bgColor} ${statusConfig[selectedRequest.status].borderColor} border-2 rounded-xl p-4`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">الحالة</span>
                    <div className={`${statusConfig[selectedRequest.status].color} text-white px-4 py-2 rounded-full flex items-center gap-2 font-bold`}>
                      {React.createElement(statusConfig[selectedRequest.status].icon, { className: 'w-5 h-5' })}
                      {statusConfig[selectedRequest.status].label}
                    </div>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <h4 className="font-bold text-gray-800 mb-3">معلومات العميل</h4>
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-gray-500" />
                    <span className="text-gray-700">{selectedRequest.customer_name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-gray-500" />
                    <span className="text-gray-700 dir-ltr text-right">{selectedRequest.customer_phone}</span>
                  </div>
                </div>

                {/* Route Details */}
                <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                  <h4 className="font-bold text-gray-800">تفاصيل الرحلة</h4>

                  <div className="space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                        <div className="w-3 h-3 bg-white rounded-full"></div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">نقطة الانطلاق</p>
                        <p className="font-medium text-gray-800">{selectedRequest.pickup_address}</p>
                      </div>
                    </div>

                    <div className="mr-4 border-r-2 border-dashed border-gray-300 h-6"></div>

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-700 flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">الوجهة</p>
                        <p className="font-medium text-gray-800">{selectedRequest.destination_address}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {selectedRequest.notes && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-yellow-800 mb-1">ملاحظات</p>
                        <p className="text-sm text-yellow-700">{selectedRequest.notes}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Fare & Payment */}
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <h4 className="font-bold text-gray-800">التكلفة والدفع</h4>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">طريقة الدفع</span>
                    <div className="flex items-center gap-2">
                      {selectedRequest.payment_method === 'cash' ? (
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

                  {selectedRequest.estimated_fare && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">السعر التقديري</span>
                      <span className="text-lg font-bold text-gray-800">{selectedRequest.estimated_fare} ₪</span>
                    </div>
                  )}

                  {selectedRequest.final_fare && (
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                      <span className="font-medium text-gray-800">السعر النهائي</span>
                      <span className="text-xl font-bold text-brand">{selectedRequest.final_fare} ₪</span>
                    </div>
                  )}
                </div>

                {/* Timestamps */}
                <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">تاريخ الطلب</span>
                    <span className="text-gray-800">{formatDate(selectedRequest.created_at)}</span>
                  </div>
                  {selectedRequest.completed_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">تاريخ الإكمال</span>
                      <span className="text-gray-800">{formatDate(selectedRequest.completed_at)}</span>
                    </div>
                  )}
                </div>

                {/* Cancel Button */}
                {selectedRequest.status === 'pending' && (
                  <button
                    onClick={() => handleCancelRequest(selectedRequest.id)}
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

export default CaptainRequestsTracking;
