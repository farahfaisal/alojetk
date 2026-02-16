/*
  # إصلاح سياسات الأمان لجدول عناوين العملاء

  1. التغييرات
    - تحديث سياسات RLS لتتوافق مع نظام المصادقة المخصص
    - السماح بالوصول العام مع الاعتماد على Application-level security
    - إزالة الاعتماد على auth.uid() لأن النظام يستخدم OTP authentication

  2. السبب
    - جدول customers يستخدم سياسات USING (true)
    - النظام يعتمد على نظام مصادقة OTP مخصص
    - لا يوجد ربط مباشر بين customers.id و auth.uid()
*/

-- حذف السياسات الحالية
DROP POLICY IF EXISTS "Customers can view own addresses" ON customer_addresses;
DROP POLICY IF EXISTS "Customers can insert own addresses" ON customer_addresses;
DROP POLICY IF EXISTS "Customers can update own addresses" ON customer_addresses;
DROP POLICY IF EXISTS "Customers can delete own addresses" ON customer_addresses;

-- إنشاء سياسات جديدة متوافقة مع نظام المصادقة المخصص
CREATE POLICY "Allow customers to view addresses"
  ON customer_addresses
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow customers to insert addresses"
  ON customer_addresses
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow customers to update addresses"
  ON customer_addresses
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow customers to delete addresses"
  ON customer_addresses
  FOR DELETE
  TO public
  USING (true);