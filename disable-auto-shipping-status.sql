/*
  تعطيل التحديث التلقائي لحالة "في الطريق" عند تعيين السائق

  التغيير:
  - حذف trigger الذي يحول الطلب تلقائيًا إلى "في الطريق" عند تعيين السائق
  - حذف الدالة المرتبطة به

  النتيجة:
  الطلب سيظهر "في الطريق" فقط عندما يبدأ السائق الرحلة يدويًا
*/

-- حذف trigger التحديث التلقائي
DROP TRIGGER IF EXISTS update_order_with_driver_trigger ON driver_waiting_list;

-- حذف الدالة المرتبطة
DROP FUNCTION IF EXISTS update_delivery_status_with_driver();
