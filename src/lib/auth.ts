import { supabase } from './supabase';

// تحويل الرقم إلى تنسيق E.164 (مثال: 0591234567 → +970591234567)
function toE164(phone: string): string {
  if (phone.startsWith('+970')) return phone;
  if (phone.startsWith('970')) return '+' + phone;
  if (phone.startsWith('0')) return '+970' + phone.slice(1);
  throw new Error('رقم الهاتف غير صالح');
}

// تنسيق رقم الهاتف إلى الصيغة المحلية (يبدأ بـ 0)
function standardizePhoneNumber(phone: string): string {
  // إذا كان الرقم يبدأ بـ 0، أعده كما هو
  if (phone.startsWith('0')) {
    return phone;
  }
  
  // إذا كان الرقم بالصيغة الدولية +970، حوله إلى الصيغة المحلية
  if (phone.startsWith('+970')) {
    return '0' + phone.substring(4);
  }
  
  // إذا كان الرقم يبدأ بـ 970 بدون +، حوله إلى الصيغة المحلية
  if (phone.startsWith('970')) {
    return '0' + phone.substring(3);
  }
  
  // في حالات أخرى، افترض أنه رقم محلي بدون 0 في البداية
  return '0' + phone;
}

// إرسال رمز التحقق
export async function loginWithPhone(phone: string) {
  try {
    // تنسيق رقم الهاتف إلى الصيغة المحلية
    const formattedPhone = standardizePhoneNumber(phone);
    console.log('Sending OTP to formatted phone:', formattedPhone);
    
    // استدعاء Edge Function لإرسال OTP
    const response = await fetch(`${supabase.supabaseUrl}/functions/v1/send-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabase.supabaseKey}`
      },
      body: JSON.stringify({ phone: formattedPhone })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response from send-otp function:', errorText);
      try {
        const errorData = JSON.parse(errorText);
        return { success: false, message: errorData.message || 'فشل إرسال رمز التحقق' };
      } catch (e) {
        return { success: false, message: `فشل إرسال رمز التحقق: ${response.status} ${response.statusText}` };
      }
    }
    
    const data = await response.json();
    console.log('OTP send response:', data);
    
    // للأرقام التجريبية، نرجع الرمز في الاستجابة
    if (formattedPhone === '0595284308' && data.otp) {
      return { 
        success: true, 
        message: 'تم إرسال رمز التحقق بنجاح', 
        otp: data.otp 
      };
    }
    
    return data;
  } catch (error) {
    console.error('Error in loginWithPhone:', error);
    return { success: false, message: error.message || 'فشل إرسال رمز التحقق' };
  }
}

// التحقق من رمز OTP
export async function verifyOTP(phone: string, otp: string) {
  try {
    // تنسيق رقم الهاتف إلى الصيغة المحلية
    const formattedPhone = standardizePhoneNumber(phone);
    console.log('Verifying OTP for formatted phone:', formattedPhone, 'OTP:', otp);
    
    // استدعاء Edge Function للتحقق من OTP
    const response = await fetch(`${supabase.supabaseUrl}/functions/v1/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabase.supabaseKey}`
      },
      body: JSON.stringify({ phone: formattedPhone, otp })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response from verify-otp function:', errorText);
      try {
        const errorData = JSON.parse(errorText);
        return { success: false, message: errorData.message || 'فشل التحقق من الرمز' };
      } catch (e) {
        return { success: false, message: `فشل التحقق من الرمز: ${response.status} ${response.statusText}` };
      }
    }
    
    const data = await response.json();
    console.log('Verification response:', data);
    
    // إذا نجح التحقق، نقوم بتخزين بيانات المستخدم في localStorage
    if (data.success) {
      const userData = {
        id: data.user?.id || formattedPhone,
        customer_id: data.user?.id || formattedPhone,
        phone: formattedPhone,
        name: data.user?.name || '',
        email: data.user?.email || ''
      };
      
      localStorage.setItem('auth_user', JSON.stringify(userData));
      
      // إرسال حدث تغيير حالة المصادقة
      window.dispatchEvent(new Event('auth-change'));
      
      return {
        success: true,
        message: 'تم التحقق بنجاح',
        user: userData,
        existing_user: data.existing_user
      };
    }
    
    return data;
  } catch (err) {
    console.error('Error in verifyOTP:', err);
    return { success: false, message: err.message || 'فشل التحقق من الرمز' };
  }
}

// تسجيل الخروج
export function logout() {
  localStorage.removeItem('auth_user');
  supabase.auth.signOut();
}

// جلب المستخدم الحالي
export async function getCurrentUser() {
  // أولًا، نحاول الحصول على المستخدم من localStorage
  try {
    const storedUser = localStorage.getItem('auth_user');
    if (storedUser) {
      return JSON.parse(storedUser);
    }
  } catch (e) {
    console.error('Error parsing stored user:', e);
  }
  
  return null;
}

// تهيئة التحقق
export function initAuth() {
  // تحقق من وجود بيانات المستخدم في localStorage
  const storedUser = localStorage.getItem('auth_user');
  if (storedUser) {
    try {
      const userData = JSON.parse(storedUser);
      console.log('User data loaded from localStorage:', userData);
    } catch (e) {
      console.error('Error parsing user data from localStorage:', e);
      localStorage.removeItem('auth_user');
    }
  }
}

// حذف الحساب
export async function deleteUserAccount() {
  localStorage.removeItem('auth_user');
}

// إكمال بيانات المستخدم
export async function completeProfile(data: { phone: string; name: string; email?: string }) {
  try {
    console.log('Starting completeProfile with data:', data);
    
    // تنسيق رقم الهاتف إلى الصيغة المحلية
    const formattedPhone = standardizePhoneNumber(data.phone);
    console.log('Formatted phone:', formattedPhone);
    
    // تحقق من وجود حساب بالفعل
    const { data: customerData, error: customerError } = await supabase
      .from('customers')
      .select('id, name, phone, email')
      .eq('phone', formattedPhone)
      .maybeSingle();
      
    console.log('Customer lookup result:', { customerData, customerError });
      
    if (customerError) {
      console.error('Error checking customer:', customerError);
      return { success: false, message: 'فشل التحقق من وجود الحساب' };
    }
    
    let newCustomerId: string | null = null;
    
    // إذا كان الحساب موجودًا، قم بتحديث البيانات
    if (customerData) {
      console.log('Updating existing customer:', customerData.id);
      
      // تحديث بيانات العميل
      const { error: updateError } = await supabase
        .from('customers')
        .update({
          name: data.name,
          email: data.email || null
        })
        .eq('id', customerData.id);
        
      if (updateError) {
        console.error('Error updating customer:', updateError);
        return { success: false, message: 'فشل تحديث بيانات الحساب' };
      }
      
      newCustomerId = customerData.id;
      
      // حفظ البيانات في localStorage
      const userData = {
        id: customerData.id,
        customer_id: customerData.id, // تأكيد على استخدام نفس المعرف
        phone: formattedPhone,
        name: data.name,
        email: data.email
      };
      
      localStorage.setItem('auth_user', JSON.stringify(userData));
      
      return { 
        success: true, 
        user: userData,
        isNewUser: false
      };
    } else {
      // إنشاء حساب جديد
      console.log('Creating new customer');
      
      const { data: newCustomer, error: insertError } = await supabase
        .from('customers')
        .insert({
          name: data.name,
          phone: formattedPhone,
          email: data.email || null
        })
        .select()
        .single();
        
      if (insertError) {
        console.error('Error creating customer:', insertError);
        return { success: false, message: 'فشل إنشاء حساب جديد' };
      }
      
      // تأكد من وجود معرف العميل
      if (!newCustomer || !newCustomer.id) {
        console.error('No customer ID returned from database');
        return { success: false, message: 'فشل في الحصول على معرف العميل' };
      }
      
      newCustomerId = newCustomer.id;
      console.log('New customer created with ID:', newCustomerId);
      
      // حفظ البيانات في localStorage
      const userData = {
        id: newCustomer.id,
        customer_id: newCustomer.id, // تأكيد على استخدام نفس المعرف
        phone: formattedPhone,
        name: data.name,
        email: data.email
      };
      
      console.log('New customer created with ID:', newCustomer.id);
      localStorage.setItem('auth_user', JSON.stringify(userData));
      
      // تحديث حالة المصادقة
      window.dispatchEvent(new Event('auth-change'));
      
      return { 
        success: true, 
        user: userData,
        isNewUser: true
      };
    }
  } catch (err) {
    console.error('Error in completeProfile:', err);
    return { success: false, message: err.message || 'فشل إكمال البيانات' };
  }
}