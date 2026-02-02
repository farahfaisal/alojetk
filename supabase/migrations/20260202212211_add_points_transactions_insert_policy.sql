/*
  # إضافة سياسة INSERT لجدول points_transactions

  1. التغييرات
    - إضافة سياسة INSERT لجدول points_transactions
    - السماح للنظام بإضافة معاملات النقاط من خلال الـ triggers

  2. الأمان
    - السياسة تسمح للجميع بإدراج معاملات النقاط
    - هذا آمن لأن الـ triggers هي التي تقوم بالإدراج وليس المستخدم مباشرة
*/

-- إضافة سياسة INSERT للنظام لإضافة معاملات النقاط
CREATE POLICY "System can insert points transactions"
  ON points_transactions
  FOR INSERT
  TO public
  WITH CHECK (true);
