/*
  # إصلاح سياسة عرض طلبات الكابتن
  
  ## التغييرات
    - حذف السياسات القديمة التي تعتمد على auth.uid()
    - إضافة سياسة جديدة تسمح للجميع بعرض الطلبات
  
  ## السبب
    - النظام لا يستخدم Supabase Auth
    - المستخدمون لا يملكون auth.uid()
    - نحتاج للسماح بالعرض بدون التحقق من auth.uid()
*/

-- حذف السياسات القديمة
DROP POLICY IF EXISTS "Users can view own captain requests" ON captain_requests;
DROP POLICY IF EXISTS "Authenticated users can view all captain requests for admin" ON captain_requests;

-- إضافة سياسة جديدة تسمح للجميع بعرض الطلبات
CREATE POLICY "Anyone can view captain requests"
  ON captain_requests FOR SELECT
  TO public
  USING (true);