/*
  # التأكد من أن الجميع يمكنهم إنشاء الطلبات

  1. التغييرات
    - حذف السياسة القديمة "Public can create orders"
    - إضافة سياسة جديدة أكثر وضوحاً
    - التأكد من أن السياسة تعمل بشكل صحيح

  2. الأمان
    - السياسة تسمح للجميع (authenticated + anon + public) بإنشاء الطلبات
    - هذا آمن لأن النظام يتحقق من البيانات في الكود
*/

-- حذف السياسة القديمة
DROP POLICY IF EXISTS "Public can create orders" ON orders;

-- إضافة سياسة جديدة بشكل أكثر وضوحاً
CREATE POLICY "Everyone can insert orders"
  ON orders
  FOR INSERT
  TO public
  WITH CHECK (true);
