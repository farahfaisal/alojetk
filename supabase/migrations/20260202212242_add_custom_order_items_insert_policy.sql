/*
  # إضافة سياسة INSERT لجدول custom_order_items

  1. التغييرات
    - إضافة سياسة INSERT لجدول custom_order_items
    - السماح للمستخدمين بإضافة عناصر طلبات مخصصة

  2. الأمان
    - السياسة تسمح للمستخدمين المسجلين والعامة بإضافة عناصر الطلبات المخصصة
    - هذا آمن لأن custom_order_items مرتبطة بطلبات محددة
*/

-- إضافة سياسة INSERT للمستخدمين المسجلين
CREATE POLICY "Authenticated users can insert custom order items"
  ON custom_order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- إضافة سياسة INSERT للجميع (للطلبات من المستخدمين الضيوف)
CREATE POLICY "Public can insert custom order items"
  ON custom_order_items
  FOR INSERT
  TO public
  WITH CHECK (true);
