/*
  # حذف السياسة غير الآمنة

  1. التغييرات
    - حذف السياسة "Allow system updates on orders" لأنها تسمح لأي شخص بتحديث أي طلب
*/

DROP POLICY IF EXISTS "Allow system updates on orders" ON orders;
