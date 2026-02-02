/*
  # إصلاح صلاحيات الدوال المساعدة

  1. التغييرات
    - إضافة SECURITY DEFINER للدوال المساعدة المستخدمة في triggers
    - هذا يضمن أن جميع العمليات تعمل بصلاحيات المسؤول

  2. الأمان
    - الدوال المساعدة تحتاج SECURITY DEFINER لقراءة البيانات
    - لا تشكل خطرًا أمنيًا لأنها تقوم بعمليات قراءة بسيطة فقط
*/

-- إضافة SECURITY DEFINER لدالة extract_city_from_address
CREATE OR REPLACE FUNCTION public.extract_city_from_address(address text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  city text;
BEGIN
  -- Improved extraction logic with more cities and better matching
  IF address ILIKE '%جنين%' THEN
    RETURN 'جنين';
  ELSIF address ILIKE '%نابلس%' THEN
    RETURN 'نابلس';
  ELSIF address ILIKE '%طولكرم%' THEN
    RETURN 'طولكرم';
  ELSIF address ILIKE '%قباطية%' THEN
    RETURN 'قباطية';
  ELSIF address ILIKE '%طوباس%' THEN
    RETURN 'طوباس';
  ELSIF address ILIKE '%يعبد%' THEN
    RETURN 'يعبد';
  ELSIF address ILIKE '%الخليل%' THEN
    RETURN 'الخليل';
  ELSIF address ILIKE '%بيت لحم%' THEN
    RETURN 'بيت لحم';
  ELSIF address ILIKE '%رام الله%' THEN
    RETURN 'رام الله';
  ELSIF address ILIKE '%اريحا%' OR address ILIKE '%أريحا%' THEN
    RETURN 'أريحا';
  ELSIF address ILIKE '%القدس%' THEN
    RETURN 'القدس';
  ELSIF address ILIKE '%غزة%' THEN
    RETURN 'غزة';
  ELSIF address ILIKE '%خان يونس%' THEN
    RETURN 'خان يونس';
  ELSIF address ILIKE '%رفح%' THEN
    RETURN 'رفح';
  ELSIF address ILIKE '%دير البلح%' THEN
    RETURN 'دير البلح';
  ELSIF address ILIKE '%بيت حانون%' THEN
    RETURN 'بيت حانون';
  ELSE
    RETURN NULL; -- Return NULL if no city is found
  END IF;
END;
$function$;

-- إضافة SECURITY DEFINER لدالة get_default_city_coordinates
CREATE OR REPLACE FUNCTION public.get_default_city_coordinates(city_name text)
RETURNS TABLE(latitude numeric, longitude numeric)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Default coordinates for known cities
  IF city_name = 'جنين' THEN
    RETURN QUERY SELECT 32.4594::numeric, 35.2956::numeric;
  ELSIF city_name = 'نابلس' THEN
    RETURN QUERY SELECT 32.2211::numeric, 35.2544::numeric;
  ELSIF city_name = 'طولكرم' THEN
    RETURN QUERY SELECT 32.3188::numeric, 35.0281::numeric;
  ELSIF city_name = 'قباطية' THEN
    RETURN QUERY SELECT 32.4104::numeric, 35.2856::numeric;
  ELSIF city_name = 'طوباس' THEN
    RETURN QUERY SELECT 32.1908::numeric, 35.3639::numeric;
  ELSIF city_name = 'يعبد' THEN
    RETURN QUERY SELECT 32.4454::numeric, 35.2286::numeric;
  ELSIF city_name = 'الخليل' THEN
    RETURN QUERY SELECT 31.5326::numeric, 35.0998::numeric;
  ELSIF city_name = 'بيت لحم' THEN
    RETURN QUERY SELECT 31.7054::numeric, 35.2024::numeric;
  ELSIF city_name = 'رام الله' THEN
    RETURN QUERY SELECT 31.9038::numeric, 35.2034::numeric;
  ELSIF city_name = 'أريحا' THEN
    RETURN QUERY SELECT 31.8667::numeric, 35.4500::numeric;
  ELSIF city_name = 'القدس' THEN
    RETURN QUERY SELECT 31.7683::numeric, 35.2137::numeric;
  ELSIF city_name = 'غزة' THEN
    RETURN QUERY SELECT 31.5017::numeric, 34.4668::numeric;
  ELSE
    -- Default to Jenin if city not recognized
    RETURN QUERY SELECT 32.4594::numeric, 35.2956::numeric;
  END IF;
END;
$function$;
