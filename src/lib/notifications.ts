import { supabase } from './supabase';
import { showNotification } from './firebase';

export interface OrderNotification {
  id: string;
  order_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
  created_by?: string;
}

// إرسال إشعار عند إنشاء طلب جديد
export async function sendOrderCreatedNotification(orderId: string, orderData: any) {
  try {
    console.log('📧 إرسال إشعار إنشاء الطلب:', orderId);
    
    // إشعار محلي للعميل
    showNotification(
      '✅ تم استلام طلبك بنجاح!',
      `طلب رقم ${orderData.order_number || orderId} قيد المراجعة`,
      {
        type: 'order_created',
        orderId: orderId,
        orderNumber: orderData.order_number
      }
    );
    
    // حفظ الإشعار في قاعدة البيانات
    const { error } = await supabase
      .from('order_notifications')
      .insert({
        order_id: orderId,
        message: `طلب جديد رقم ${orderData.order_number || orderId} - ${orderData.customer_name}`,
        is_read: false,
        created_by: orderData.customer_id
      });
      
    if (error) {
      console.error('خطأ في حفظ إشعار الطلب:', error);
    }
    
    return { success: true };
  } catch (error) {
    console.error('خطأ في إرسال إشعار الطلب:', error);
    return { success: false, error: error.message };
  }
}

// إرسال إشعار عند تحديث حالة الطلب
export async function sendOrderStatusNotification(orderId: string, newStatus: string, orderData?: any) {
  try {
    console.log('📱 إرسال إشعار تحديث الحالة:', { orderId, newStatus });
    
    const statusMessages = {
      'pending': 'طلبك قيد الانتظار',
      'accepted': 'تم قبول طلبك من المتجر',
      'processing': 'جاري تحضير طلبك',
      'ready': 'طلبك جاهز للتوصيل',
      'shipping': 'طلبك في الطريق إليك',
      'delivered': 'تم توصيل طلبك بنجاح',
      'cancelled': 'تم إلغاء طلبك',
      'rejected': 'تم رفض طلبك من المتجر'
    };
    
    const message = statusMessages[newStatus] || `تم تحديث حالة طلبك إلى ${newStatus}`;
    
    // إشعار محلي
    showNotification(
      '📦 تحديث حالة الطلب',
      message,
      {
        type: 'order_status_update',
        orderId: orderId,
        status: newStatus
      }
    );
    
    // حفظ الإشعار في قاعدة البيانات
    const { error } = await supabase
      .from('order_notifications')
      .insert({
        order_id: orderId,
        message: message,
        is_read: false
      });
      
    if (error) {
      console.error('خطأ في حفظ إشعار تحديث الحالة:', error);
    }
    
    return { success: true };
  } catch (error) {
    console.error('خطأ في إرسال إشعار تحديث الحالة:', error);
    return { success: false, error: error.message };
  }
}

// إرسال إشعار عند تعيين سائق
export async function sendDriverAssignedNotification(orderId: string, driverName: string) {
  try {
    const message = `تم تعيين السائق ${driverName} لتوصيل طلبك`;
    
    showNotification(
      '🚗 تم تعيين السائق',
      message,
      {
        type: 'driver_assigned',
        orderId: orderId,
        driverName: driverName
      }
    );
    
    // حفظ في قاعدة البيانات
    const { error } = await supabase
      .from('order_notifications')
      .insert({
        order_id: orderId,
        message: message,
        is_read: false
      });
      
    if (error) {
      console.error('خطأ في حفظ إشعار تعيين السائق:', error);
    }
    
    return { success: true };
  } catch (error) {
    console.error('خطأ في إرسال إشعار تعيين السائق:', error);
    return { success: false, error: error.message };
  }
}

// جلب إشعارات المستخدم
export async function getUserNotifications(userId: string): Promise<OrderNotification[]> {
  try {
    const { data, error } = await supabase
      .from('order_notifications')
      .select(`
        *,
        order:order_id (
          customer_id,
          customer_phone
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    
    // تصفية الإشعارات للمستخدم الحالي
    const userNotifications = data?.filter(notification => 
      notification.order?.customer_id === userId ||
      notification.created_by === userId
    ) || [];
    
    return userNotifications;
  } catch (error) {
    console.error('خطأ في جلب الإشعارات:', error);
    return [];
  }
}

// تحديد الإشعار كمقروء
export async function markNotificationAsRead(notificationId: string) {
  try {
    const { error } = await supabase
      .from('order_notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
      
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('خطأ في تحديد الإشعار كمقروء:', error);
    return { success: false, error: error.message };
  }
}

// تحديد جميع الإشعارات كمقروءة
export async function markAllNotificationsAsRead(userId: string) {
  try {
    // Get user notifications first
    const notifications = await getUserNotifications(userId);
    const notificationIds = notifications.map(n => n.id);
    
    if (notificationIds.length === 0) return { success: true };
    
    const { error } = await supabase
      .from('order_notifications')
      .update({ is_read: true })
      .in('id', notificationIds);
      
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('خطأ في تحديد جميع الإشعارات كمقروءة:', error);
    return { success: false, error: error.message };
  }
}