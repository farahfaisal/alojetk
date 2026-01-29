/*
  # إصلاح حقل description في customer_wallet_transactions

  ## المشكلة
  - حقل description هو NOT NULL بدون قيمة افتراضية
  - يسبب خطأ PG0001 عند محاولة الإدخال بدون قيمة

  ## الحل
  - إضافة قيمة افتراضية لحقل description
*/

-- إضافة قيمة افتراضية لحقل description
ALTER TABLE customer_wallet_transactions 
ALTER COLUMN description SET DEFAULT 'معاملة محفظة';

-- تحديث أي سجلات قد تكون فارغة (إذا وجدت)
UPDATE customer_wallet_transactions 
SET description = 'معاملة محفظة' 
WHERE description IS NULL OR description = '';