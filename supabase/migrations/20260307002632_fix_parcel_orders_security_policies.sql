/*
  # إصلاح سياسات الأمان لجدول طلبات الطرود

  ## المشكلة
  - وجود سياسة تسمح لأي شخص بمشاهدة جميع طلبات الطرود
  - سياسات غير آمنة تسمح بالإنشاء دون تحقق

  ## التغييرات
  1. حذف السياسات غير الآمنة
  2. التأكد من أن المستخدمين يمكنهم فقط:
     - إنشاء طلبات لأنفسهم (مع التحقق من customer_id)
     - مشاهدة طلباتهم الخاصة فقط
     - تحديث طلباتهم المعلقة فقط

  ## الأمان
  - جميع السياسات تتحقق من هوية المستخدم
  - العملاء يمكنهم فقط رؤية وإدارة طلباتهم الخاصة
  - المدراء والسائقون لديهم صلاحيات محددة
*/

-- حذف السياسات غير الآمنة
DROP POLICY IF EXISTS "Users can view all parcel orders" ON parcel_orders;
DROP POLICY IF EXISTS "Customers can create parcel orders" ON parcel_orders;

-- التأكد من أن سياسة المشاهدة للعملاء موجودة وصحيحة
-- (السياسة موجودة بالفعل: "Customers can view own parcel orders")

-- تحديث سياسة الإدراج لتتطلب customer_id صحيح
DROP POLICY IF EXISTS "Customers can insert own parcel orders" ON parcel_orders;

CREATE POLICY "Customers can insert own parcel orders"
  ON parcel_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id IS NOT NULL 
    AND (
      customer_id = auth.uid()
      OR customer_id IN (
        SELECT id FROM customers WHERE id = auth.uid()
      )
    )
  );
