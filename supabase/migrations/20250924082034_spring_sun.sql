/*
  # إنشاء دوال المشغلات للطلبات

  1. دوال المشغلات الجديدة
    - `auto_insert_status_history` - إدراج تلقائي لتاريخ حالة الطلب
    - `complete_order_on_delivery` - إكمال الطلب عند التوصيل
    - `handle_order_completion` - معالجة إكمال الطلب
    - `handle_order_status_update` - معالجة تحديث حالة الطلب
    - `log_order_status_change` - تسجيل تغيير حالة الطلب
    - `notify_order_status_change` - إرسال إشعار عند تغيير الحالة
    - `record_delivery_completion` - تسجيل إكمال التوصيل
    - `send_external_notification` - إرسال إشعار خارجي
    - `handle_order_status_created_by` - تعيين منشئ تحديث الحالة
    - `add_points_for_completed_order` - إضافة نقاط عند إكمال الطلب

  2. المشغلات
    - مشغلات تلقائية لتحديث حالة الطلب
    - مشغلات الإشعارات
    - مشغلات النقاط والعمولات

  3. الأمان
    - جميع الدوال محمية ومحدودة الوصول
    - تسجيل شامل للتغييرات
*/

-- 1. دالة إدراج تلقائي لتاريخ حالة الطلب
CREATE OR REPLACE FUNCTION auto_insert_status_history()
RETURNS TRIGGER AS $$
BEGIN
  -- إدراج سجل جديد في تاريخ الحالة عند تحديث حالة الطلب
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO order_status_history (
      order_id,
      status,
      note,
      created_by,
      created_at
    ) VALUES (
      NEW.id,
      NEW.status,
      'تم تحديث حالة الطلب تلقائياً',
      NULL,
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. دالة إكمال الطلب عند التوصيل
CREATE OR REPLACE FUNCTION complete_order_on_delivery()
RETURNS TRIGGER AS $$
BEGIN
  -- عندما يكمل السائق التوصيل، قم بتحديث حالة الطلب
  IF NEW.status = 'completed' THEN
    UPDATE orders 
    SET 
      status = 'completed',
      updated_at = NOW()
    WHERE id = NEW.order_id;
    
    -- إدراج سجل في تاريخ الحالة
    INSERT INTO order_status_history (
      order_id,
      status,
      note,
      created_by,
      driver_name
    ) VALUES (
      NEW.order_id,
      'completed',
      'تم إكمال التوصيل بواسطة السائق',
      NEW.driver_id,
      COALESCE(NEW.driver_name, 'السائق')
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. دالة معالجة إكمال الطلب
CREATE OR REPLACE FUNCTION handle_order_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- معالجة إكمال الطلب
  IF NEW.status = 'completed' THEN
    -- تحديث إحصائيات المتجر
    UPDATE vendors 
    SET updated_at = NOW()
    WHERE id = (
      SELECT vendor_id 
      FROM orders 
      WHERE id = NEW.order_id
    );
    
    -- تحديث إحصائيات السائق
    UPDATE drivers 
    SET updated_at = NOW()
    WHERE id = (
      SELECT driver_id 
      FROM orders 
      WHERE id = NEW.order_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. دالة معالجة تحديث حالة الطلب
CREATE OR REPLACE FUNCTION handle_order_status_update()
RETURNS TRIGGER AS $$
BEGIN
  -- معالجة تحديث حالة الطلب
  -- إرسال إشعارات للأطراف المعنية
  
  -- إشعار العميل
  INSERT INTO order_notifications (
    order_id,
    message,
    is_read,
    created_by
  ) VALUES (
    NEW.id,
    'تم تحديث حالة طلبك إلى: ' || NEW.status,
    false,
    NEW.customer_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. دالة تسجيل تغيير حالة الطلب
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- تسجيل تغيير حالة الطلب في سجل النظام
  INSERT INTO system_logs (
    event_type,
    message,
    details
  ) VALUES (
    'order_status_change',
    'تم تغيير حالة الطلب',
    jsonb_build_object(
      'order_id', COALESCE(NEW.id, OLD.id),
      'old_status', OLD.status,
      'new_status', NEW.status,
      'customer_id', COALESCE(NEW.customer_id, OLD.customer_id),
      'vendor_id', COALESCE(NEW.vendor_id, OLD.vendor_id),
      'changed_at', NOW()
    )
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 6. دالة إرسال إشعار عند تغيير حالة الطلب
CREATE OR REPLACE FUNCTION notify_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
  order_info RECORD;
  notification_message TEXT;
BEGIN
  -- الحصول على معلومات الطلب
  SELECT o.*, c.name as customer_name, v.store_name as vendor_name
  INTO order_info
  FROM orders o
  LEFT JOIN customers c ON c.id = o.customer_id
  LEFT JOIN vendors v ON v.id = o.vendor_id
  WHERE o.id = NEW.order_id;
  
  -- تحديد رسالة الإشعار حسب الحالة
  CASE NEW.status
    WHEN 'accepted' THEN
      notification_message := 'تم قبول طلبك من ' || COALESCE(order_info.vendor_name, 'المتجر');
    WHEN 'processing' THEN
      notification_message := 'جاري تحضير طلبك';
    WHEN 'ready' THEN
      notification_message := 'طلبك جاهز للتوصيل';
    WHEN 'delivering' THEN
      notification_message := 'طلبك في الطريق إليك';
    WHEN 'completed' THEN
      notification_message := 'تم توصيل طلبك بنجاح';
    WHEN 'cancelled' THEN
      notification_message := 'تم إلغاء طلبك';
    WHEN 'rejected' THEN
      notification_message := 'تم رفض طلبك من المتجر';
    ELSE
      notification_message := 'تم تحديث حالة طلبك';
  END CASE;
  
  -- إدراج الإشعار
  INSERT INTO order_notifications (
    order_id,
    message,
    is_read,
    created_by
  ) VALUES (
    NEW.order_id,
    notification_message,
    false,
    NEW.created_by
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. دالة تسجيل إكمال التوصيل
CREATE OR REPLACE FUNCTION record_delivery_completion()
RETURNS TRIGGER AS $$
DECLARE
  order_total NUMERIC;
  commission_rate NUMERIC;
  driver_commission NUMERIC;
  vendor_commission NUMERIC;
BEGIN
  -- الحصول على إجمالي الطلب
  SELECT total INTO order_total
  FROM orders
  WHERE id = NEW.order_id;
  
  -- حساب العمولات
  SELECT commission_rate INTO commission_rate
  FROM drivers
  WHERE id = NEW.created_by;
  
  IF commission_rate IS NOT NULL AND order_total IS NOT NULL THEN
    driver_commission := order_total * (commission_rate / 100);
    vendor_commission := order_total * 0.10; -- 10% للمتجر
    
    -- تسجيل عمولة السائق
    INSERT INTO delivery_commissions (
      driver_id,
      order_id,
      amount,
      rate,
      status
    ) VALUES (
      NEW.created_by,
      NEW.order_id,
      driver_commission,
      commission_rate,
      'completed'
    );
    
    -- تسجيل عمولة المتجر
    INSERT INTO vendor_commissions (
      vendor_id,
      order_id,
      amount,
      rate,
      status
    ) VALUES (
      (SELECT vendor_id FROM orders WHERE id = NEW.order_id),
      NEW.order_id,
      vendor_commission,
      10.00,
      'completed'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. دالة إرسال إشعار خارجي
CREATE OR REPLACE FUNCTION send_external_notification()
RETURNS TRIGGER AS $$
DECLARE
  notification_payload JSONB;
BEGIN
  -- إعداد بيانات الإشعار
  notification_payload := jsonb_build_object(
    'order_id', NEW.id,
    'customer_name', NEW.customer_name,
    'customer_phone', NEW.customer_phone,
    'vendor_name', NEW.vendor_name,
    'total', NEW.total,
    'status', NEW.status,
    'created_at', NEW.created_at
  );
  
  -- تسجيل الإشعار في سجل الإشعارات
  INSERT INTO notification_logs (
    user_id,
    vendor_id,
    notification_type,
    channel,
    status,
    payload
  ) VALUES (
    NEW.customer_id,
    NEW.vendor_id,
    'order_created',
    'external_api',
    'pending',
    notification_payload
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. دالة تعيين منشئ تحديث الحالة
CREATE OR REPLACE FUNCTION handle_order_status_created_by()
RETURNS TRIGGER AS $$
BEGIN
  -- تعيين منشئ تحديث الحالة تلقائياً إذا لم يكن محدداً
  IF NEW.created_by IS NULL THEN
    -- محاولة تحديد المنشئ بناءً على السياق
    NEW.created_by := auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10. دالة إضافة نقاط عند إكمال الطلب
CREATE OR REPLACE FUNCTION add_points_for_completed_order()
RETURNS TRIGGER AS $$
DECLARE
  order_info RECORD;
  customer_points_account_id UUID;
  points_to_add INTEGER;
  points_rate NUMERIC := 10; -- نقطة واحدة لكل 10 شيكل
BEGIN
  -- الحصول على معلومات الطلب
  SELECT * INTO order_info
  FROM orders
  WHERE id = NEW.order_id;
  
  -- الحصول على معرف حساب النقاط للعميل
  SELECT id INTO customer_points_account_id
  FROM points_accounts
  WHERE customer_id = order_info.customer_id;
  
  -- إذا لم يكن هناك حساب نقاط، قم بإنشاء واحد
  IF customer_points_account_id IS NULL THEN
    INSERT INTO points_accounts (customer_id, balance)
    VALUES (order_info.customer_id, 0)
    RETURNING id INTO customer_points_account_id;
  END IF;
  
  -- حساب النقاط المستحقة
  points_to_add := FLOOR(order_info.total / points_rate);
  
  -- إضافة النقاط
  IF points_to_add > 0 THEN
    INSERT INTO points_transactions (
      account_id,
      order_id,
      amount,
      type,
      description
    ) VALUES (
      customer_points_account_id,
      NEW.order_id,
      points_to_add,
      'earn',
      'نقاط مكافأة للطلب رقم ' || COALESCE(order_info.order_number, order_info.id::text)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;