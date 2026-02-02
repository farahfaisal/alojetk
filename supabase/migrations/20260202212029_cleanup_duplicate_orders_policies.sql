/*
  # تنظيف السياسات المكررة في جدول orders

  1. التغييرات
    - حذف السياسات المكررة للـ INSERT
    - حذف السياسات المكررة للـ SELECT
    - الإبقاء على سياسة واحدة فقط لكل عملية

  2. الأمان
    - تبسيط السياسات لتجنب التعارضات
    - الإبقاء على السياسات الأكثر عمومية
*/

-- حذف السياسات المكررة للـ INSERT
DROP POLICY IF EXISTS "Orders can be created by anyone" ON orders;
DROP POLICY IF EXISTS "Anonymous users can create orders" ON orders;

-- حذف السياسات المكررة للـ SELECT
DROP POLICY IF EXISTS "Customers can view their orders" ON orders;
