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

interface FirebaseNotification {
  id: string;
  title: string;
  body: string;
  data?: any;
  is_read: boolean;
  created_at: string;
  type: 'firebase';
}

interface CombinedNotification {
  id: string;
  title?: string;
  message?: string;
  body?: string;
  is_read: boolean;
  created_at: string;
  type: 'order' | 'firebase';
  data?: any;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<CombinedNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const loadNotifications = async () => {
    if (!user?.customer_id) return;

    try {
      setLoading(true);

      // Load order notifications
      const orderNotifications = await getUserNotifications(user.customer_id);

      // Load Firebase notifications
      const { data: firebaseNotifications, error } = await supabase
        .from('firebase_notifications')
        .select('*')
        .eq('user_id', user.customer_id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error loading Firebase notifications:', error);
      }

      // Combine and sort notifications
      const combined: CombinedNotification[] = [
        ...orderNotifications.map(n => ({
          id: n.id,
          message: n.message,
          is_read: n.is_read,
          created_at: n.created_at,
          type: 'order' as const
        })),
        ...(firebaseNotifications || []).map(n => ({
          id: n.id,
          title: n.title,
          body: n.body,
          is_read: n.is_read,
          created_at: n.created_at,
          type: 'firebase' as const,
          data: n.data
        }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setNotifications(combined);
    } catch (error) {
      console.error('خطأ في تحميل الإشعارات:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && user?.customer_id) {
      loadNotifications();

      // Subscribe to order notifications
      const orderChannel = supabase
        .channel('order-notifications')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'order_notifications'
          },
          (payload) => {
            console.log('إشعار طلب جديد:', payload);
            loadNotifications();
          }
        )
        .subscribe();

      // Subscribe to Firebase notifications
      const firebaseChannel = supabase
        .channel('firebase-notifications')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'firebase_notifications',
            filter: `user_id=eq.${user.customer_id}`
          },
          (payload) => {
            console.log('إشعار Firebase جديد:', payload);
            loadNotifications();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(orderChannel);
        supabase.removeChannel(firebaseChannel);
      };
    }
  }, [isOpen, user?.customer_id]);

  const handleMarkAsRead = async (notificationId: string, type: 'order' | 'firebase') => {
    try {
      if (type === 'order') {
        await markNotificationAsRead(notificationId);
      } else {
        // Mark Firebase notification as read
        const { error } = await supabase
          .from('firebase_notifications')
          .update({ is_read: true })
          .eq('id', notificationId);

        if (error) {
          console.error('Error marking Firebase notification as read:', error);
          return;
        }
      }

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.customer_id) return;

    try {
      setMarkingAllRead(true);

      // Mark all order notifications as read
      await markAllNotificationsAsRead(user.customer_id);

      // Mark all Firebase notifications as read
      const { error } = await supabase
        .from('firebase_notifications')
        .update({ is_read: true })
        .eq('user_id', user.customer_id)
        .eq('is_read', false);

      if (error) {
        console.error('Error marking all Firebase notifications as read:', error);
      }

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
            className="absolute inset-0 bg-black/10 backdrop-blur-lg"
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
                  {notifications.map((notification) => {
                    const displayTitle = notification.type === 'firebase'
                      ? notification.title
                      : '';
                    const displayMessage = notification.type === 'firebase'
                      ? notification.body
                      : notification.message;

                    return (
                      <div
                        key={notification.id}
                        onClick={() => !notification.is_read && handleMarkAsRead(notification.id, notification.type)}
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
                            {notification.type === 'firebase' ? (
                              <Bell className={`w-5 h-5 ${
                                notification.is_read ? 'text-gray-400' : 'text-accent'
                              }`} />
                            ) : (
                              <Package className={`w-5 h-5 ${
                                notification.is_read ? 'text-gray-400' : 'text-accent'
                              }`} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            {displayTitle && (
                              <p className={`text-sm font-semibold mb-1 ${
                                notification.is_read ? 'text-gray-700' : 'text-gray-900'
                              }`}>
                                {displayTitle}
                              </p>
                            )}
                            <p className={`text-sm ${
                              notification.is_read ? 'text-gray-600' : 'text-gray-900 font-medium'
                            }`}>
                              {displayMessage}
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
                    );
                  })}
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