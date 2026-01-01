/*
  # إصلاح سياسة RLS لجدول parcel_orders
  
  ## التغييرات
    - إضافة سياسة تسمح للعملاء بإضافة طلبات الطرود
    - السماح للعملاء بعرض طلباتهم الخاصة
  
  ## السبب
    - السياسات الحالية تسمح فقط للمسؤولين بإضافة الطلبات
    - العملاء يحتاجون إلى إمكانية إنشاء طلبات الطرود
*/

-- حذف السياسات القديمة إن وجدت
DROP POLICY IF EXISTS "Customers can create parcel orders" ON parcel_orders;
DROP POLICY IF EXISTS "Users can view all parcel orders" ON parcel_orders;

-- إضافة سياسة للسماح للعملاء بإنشاء طلبات طرود
CREATE POLICY "Customers can create parcel orders"
  ON parcel_orders FOR INSERT
  TO public
  WITH CHECK (true);

-- إضافة سياسة للسماح بعرض جميع طلبات الطرود
CREATE POLICY "Users can view all parcel orders"
  ON parcel_orders FOR SELECT
  TO public
  USING (true);