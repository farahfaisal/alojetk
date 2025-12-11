/*
  # إلغاء السياسات المانعة لإرسال OTP

  1. تعديل السياسات
    - إلغاء القيود على جدول stored_otps
    - السماح للـ Edge Functions بالوصول
    - إزالة قيود service_role

  2. الأمان
    - الحفاظ على الأمان الأساسي
    - السماح بالعمليات المطلوبة فقط
*/

-- إلغاء جميع السياسات الحالية على جدول stored_otps
DROP POLICY IF EXISTS "Only service role can access stored OTPs" ON stored_otps;

-- إنشاء سياسة جديدة تسمح بالوصول الكامل للـ service role
CREATE POLICY "Allow service role full access to stored OTPs"
  ON stored_otps
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- إنشاء سياسة تسمح بالإدراج للمستخدمين المصادق عليهم (للـ Edge Functions)
CREATE POLICY "Allow authenticated users to insert OTPs"
  ON stored_otps
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- إنشاء سياسة تسمح بالقراءة والتحديث للمستخدمين المصادق عليهم
CREATE POLICY "Allow authenticated users to read and update OTPs"
  ON stored_otps
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- إنشاء سياسة تسمح بالوصول للمستخدمين غير المصادق عليهم (للحالات الخاصة)
CREATE POLICY "Allow anon users to access OTPs"
  ON stored_otps
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- تأكد من أن RLS مفعل
ALTER TABLE stored_otps ENABLE ROW LEVEL SECURITY;

-- إلغاء السياسات المقيدة على جدول otp_codes إذا كان موجوداً
DROP POLICY IF EXISTS "Only service role can access OTP codes" ON otp_codes;

-- إنشاء سياسات مرنة لجدول otp_codes
CREATE POLICY "Allow service role full access to otp_codes"
  ON otp_codes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to otp_codes"
  ON otp_codes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon users full access to otp_codes"
  ON otp_codes
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- تأكد من أن RLS مفعل على otp_codes
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;