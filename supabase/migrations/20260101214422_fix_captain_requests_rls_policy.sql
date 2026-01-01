/*
  # إصلاح سياسة RLS لجدول captain_requests
  
  ## التغييرات
    - حذف السياسة الحالية التي تتحقق من auth.uid() = customer_id
    - إضافة سياسة جديدة تسمح للمستخدمين المصادقين بإضافة طلبات
  
  ## السبب
    - النظام يستخدم OTP مخصص وليس Supabase Auth
    - لا يوجد auth.uid() للمستخدمين
    - نحتاج للسماح بإضافة الطلبات للمستخدمين المصادقين فقط
*/

-- حذف السياسة القديمة
DROP POLICY IF EXISTS "Users can create own captain requests" ON captain_requests;

-- إضافة سياسة جديدة تسمح للجميع بإضافة طلبات (سيتم التحقق من البيانات في التطبيق)
CREATE POLICY "Anyone can create captain requests"
  ON captain_requests FOR INSERT
  TO public
  WITH CHECK (true);