import React, { useEffect, useState } from 'react';
import { Bell, X, Package, CheckCircle2, XCircle, Loader2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getUserNotifications, markNotificationAsRead, markAllNotificationsAsRead, OrderNotification } from '../lib/notifications';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const loadNotifications = async () => {
    if (!user?.customer_id) return;

    try {
      setLoading(true);
      const data = await getUserNotifications(user.customer_id);
      setNotifications(data);
    } catch (error) {
      console.error('خطأ في تحميل الإشعارات:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && user?.customer_id) {
      loadNotifications();

      const channel = supabase
        .channel('order-notifications')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'order_notifications'
          },
          (payload) => {
            console.log('إشعار جديد:', payload);
            loadNotifications();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isOpen, user?.customer_id]);

  const handleMarkAsRead = async (notificationId: string) => {
    await markNotificationAsRead(notificationId);
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
    );
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.customer_id) return;

    try {
      setMarkingAllRead(true);
      await markAllNotificationsAsRead(user.customer_id);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('خطأ في تحديد جميع الإشعارات كمقروءة:', error);
    } finally {
      setMarkingAllRead(false);
    }
  };

  const formatNotificationTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      const diffInHours = Math.floor(diffInMinutes / 60);
      const diffInDays = Math.floor(diffInHours / 24);

      if (diffInMinutes < 1) {
        return 'الآن';
      } else if (diffInMinutes < 60) {
        return `منذ ${diffInMinutes} دقيقة`;
      } else if (diffInHours < 24) {
        return `منذ ${diffInHours} ساعة`;
      } else if (diffInDays === 1) {
        return 'أمس';
      } else if (diffInDays < 7) {
        return `منذ ${diffInDays} يوم`;
      } else {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${day}/${month}/${year} - ${hours}:${minutes}`;
      }
    } catch {
      return '';
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3 }}
            className="absolute top-0 right-0 h-full w-full sm:w-96 bg-white shadow-xl z-10"
            style={{
              paddingTop: 'max(env(safe-area-inset-top), 0px)'
            }}
          >
            <div className="flex flex-col h-full">
              <div className="p-4 border-b flex items-center justify-between bg-white shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Bell className="w-6 h-6 text-accent" />
                  الإشعارات
                  {unreadCount > 0 && (
                    <span className="bg-accent text-white text-xs px-2 py-1 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </h2>
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {unreadCount > 0 && (
                <div className="p-3 border-b bg-gray-50">
                  <button
                    onClick={handleMarkAllAsRead}
                    disabled={markingAllRead}
                    className="text-sm text-accent hover:text-accent-dark font-medium flex items-center gap-2 disabled:opacity-50"
                  >
                    {markingAllRead ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        جاري التحديد...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        تحديد الكل كمقروء
                      </>
                    )}
                  </button>
                </div>
              )}

              {loading ? (
                <div className="flex flex-col items-center justify-center h-full p-4">
                  <Loader2 className="w-12 h-12 text-brand animate-spin mb-4" />
                  <p className="text-gray-500">جاري تحميل الإشعارات...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-4">
                  <Bell className="w-16 h-16 text-gray-300 mb-4" />
                  <p className="text-gray-500 text-lg font-medium">لا توجد إشعارات</p>
                  <p className="text-gray-400 text-sm mt-2">ستظهر الإشعارات الجديدة هنا</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => !notification.is_read && handleMarkAsRead(notification.id)}
                      className={`p-4 border-b cursor-pointer transition-colors ${
                        notification.is_read
                          ? 'bg-white hover:bg-gray-50'
                          : 'bg-blue-50 hover:bg-blue-100'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          notification.is_read ? 'bg-gray-100' : 'bg-accent/10'
                        }`}>
                          <Package className={`w-5 h-5 ${
                            notification.is_read ? 'text-gray-400' : 'text-accent'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${
                            notification.is_read ? 'text-gray-600' : 'text-gray-900 font-medium'
                          }`}>
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatNotificationTime(notification.created_at)}
                          </p>
                        </div>
                        {!notification.is_read && (
                          <div className="w-2 h-2 bg-accent rounded-full flex-shrink-0 mt-2" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default NotificationCenter;