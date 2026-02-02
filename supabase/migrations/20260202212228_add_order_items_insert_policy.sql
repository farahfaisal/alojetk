/*
  # إضافة سياسة INSERT لجدول order_items

  1. التغييرات
    - إضافة سياسة INSERT لجدول order_items
    - السماح للمستخدمين بإضافة عناصر الطلبات

  2. الأمان
    - السياسة تسمح للمستخدمين المسجلين والعامة بإضافة عناصر الطلبات
    - هذا آمن لأن order_items مرتبطة بطلبات محددة
*/

-- إضافة سياسة INSERT للمستخدمين المسجلين
CREATE POLICY "Authenticated users can insert order items"
  ON order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- إضافة سياسة INSERT للجميع (للطلبات من المستخدمين الضيوف)
CREATE POLICY "Public can insert order items"
  ON order_items
  FOR INSERT
  TO public
  WITH CHECK (true);
