/*
  # إنشاء المشغلات للطلبات

  1. المشغلات الجديدة
    - مشغل تحديث تاريخ حالة الطلب
    - مشغل إكمال الطلب عند التوصيل
    - مشغل معالجة إكمال الطلب
    - مشغل تحديث حالة الطلب
    - مشغل تسجيل تغيير الحالة
    - مشغل إرسال الإشعارات
    - مشغل تسجيل إكمال التوصيل
    - مشغل الإشعارات الخارجية
    - مشغل تعيين منشئ التحديث
    - مشغل إضافة النقاط

  2. الأمان
    - جميع المشغلات محمية
    - تسجيل شامل للأحداث
*/

-- إزالة المشغلات الموجودة إذا كانت موجودة
DROP TRIGGER IF EXISTS auto_insert_status_history_trigger ON orders;
DROP TRIGGER IF EXISTS complete_order_on_delivery_trigger ON driver_trips;
DROP TRIGGER IF EXISTS handle_order_completion_trigger ON order_status_history;
DROP TRIGGER IF EXISTS order_status_update_trigger ON orders;
DROP TRIGGER IF EXISTS log_status_change_trigger_orders ON orders;
DROP TRIGGER IF EXISTS notify_status_change_trigger ON order_status_history;
DROP TRIGGER IF EXISTS record_delivery_completion_trigger ON order_status_history;
DROP TRIGGER IF EXISTS send_external_notification_trigger ON orders;
DROP TRIGGER IF EXISTS set_order_status_created_by_trigger ON order_status_history;
DROP TRIGGER IF EXISTS add_points_on_order_completion ON order_status_history;

-- 1. مشغل إدراج تلقائي لتاريخ حالة الطلب
CREATE TRIGGER auto_insert_status_history_trigger
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION auto_insert_status_history();

-- 2. مشغل إكمال الطلب عند التوصيل
CREATE TRIGGER complete_order_on_delivery_trigger
  AFTER UPDATE OF status ON driver_trips
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION complete_order_on_delivery();

-- 3. مشغل معالجة إكمال الطلب
CREATE TRIGGER handle_order_completion_trigger
  AFTER UPDATE OF status ON order_status_history
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION handle_order_completion();

-- 4. مشغل تحديث حالة الطلب
CREATE TRIGGER order_status_update_trigger
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_order_status_update();

-- 5. مشغل تسجيل تغيير حالة الطلب
CREATE TRIGGER log_status_change_trigger_orders
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION log_order_status_change();

-- 6. مشغل إرسال إشعار عند تغيير الحالة
CREATE TRIGGER notify_status_change_trigger
  AFTER UPDATE OF status ON order_status_history
  FOR EACH ROW
  EXECUTE FUNCTION notify_order_status_change();

-- 7. مشغل تسجيل إكمال التوصيل
CREATE TRIGGER record_delivery_completion_trigger
  AFTER UPDATE OF status ON order_status_history
  FOR EACH ROW
  WHEN (NEW.status = 'delivered')
  EXECUTE FUNCTION record_delivery_completion();

-- 8. مشغل الإشعارات الخارجية
CREATE TRIGGER send_external_notification_trigger
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION send_external_notification();

-- 9. مشغل تعيين منشئ تحديث الحالة
CREATE TRIGGER set_order_status_created_by_trigger
  BEFORE INSERT ON order_status_history
  FOR EACH ROW
  EXECUTE FUNCTION handle_order_status_created_by();

-- 10. مشغل إضافة النقاط عند إكمال الطلب
CREATE TRIGGER add_points_on_order_completion
  AFTER INSERT OR UPDATE OF status ON order_status_history
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION add_points_for_completed_order();