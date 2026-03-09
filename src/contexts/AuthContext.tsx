import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  loginWithPhone,
  verifyOTP,
  logout as logoutFunc,
  completeProfile as completeProfileFunc,
  deleteUserAccount as deleteAccountFunc,
  getCurrentUser,
  initAuth as initAuthFunc
} from '../lib/auth';

export const isProduction = import.meta.env.PROD;

interface AuthUser {
  id: string;
  phone: string;
  email?: string;
  name?: string;
  customer_id?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  loginWithPhone: (phone: string) => Promise<{ success: boolean; message?: string }>;
  verifyOTP: (phone: string, otp: string) => Promise<{ success: boolean; message?: string; user?: AuthUser; existingUser?: boolean }>;
  completeProfile: (data: { phone: string; name: string; email?: string }) => Promise<{ success: boolean; message?: string; user?: AuthUser; isNewUser?: boolean }>;
  logout: () => void;
  deleteUserAccount: () => Promise<void>;
  isAuthenticated: boolean;
  isGuestMode: boolean;
  isProduction: boolean;
}

const defaultContext: AuthContextType = {
  user: null,
  loading: false,
  error: null,
  loginWithPhone: async () => ({ success: false }),
  verifyOTP: async () => ({ success: false }),
  completeProfile: async () => ({ success: false }),
  logout: () => {},
  deleteUserAccount: async () => {},
  isAuthenticated: false,
  isGuestMode: false,
  isProduction
};

const AuthContext = createContext<AuthContextType>(defaultContext);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGuestMode, setIsGuestMode] = useState(false);

  // Validate customer exists in database
  const validateCustomer = async (user: AuthUser): Promise<AuthUser | null> => {
    if (!user.customer_id) {
      return user;
    }

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, phone, email')
        .eq('id', user.customer_id)
        .maybeSingle();

      if (error) {
        // Don't remove user data on network/temporary errors
        return user;
      }

      if (!data) {
        localStorage.removeItem('auth_user');
        return null;
      }

      // Update user data with latest from database
      const updatedUser = {
        ...user,
        name: data.name || user.name,
        email: data.email || user.email,
        phone: data.phone || user.phone
      };

      // Update localStorage with fresh data
      localStorage.setItem('auth_user', JSON.stringify(updatedUser));

      return updatedUser;
    } catch (err) {
      // Don't clear user data on catch - could be network issue
      return user;
    }
  };

  useEffect(() => {
    initAuthFunc();

    const checkGuestMode = () => {
      const guestMode = localStorage.getItem('guest_mode') === 'true';
      setIsGuestMode(guestMode);
      return guestMode;
    };

    getCurrentUser().then(async (current) => {
      const guestMode = checkGuestMode();
      if (current) {
        const validatedUser = await validateCustomer(current);
        setUser(validatedUser);
        setIsGuestMode(false);
      } else if (guestMode) {
        setUser(null);
        setIsGuestMode(true);
      } else {
        setUser(null);
        setIsGuestMode(false);
      }
      setLoading(false);
    });

    window.addEventListener('auth-change', async () => {
      const guestMode = checkGuestMode();
      const current = await getCurrentUser();
      if (current) {
        const validatedUser = await validateCustomer(current);
        setUser(validatedUser);
        setIsGuestMode(false);
      } else if (guestMode) {
        setUser(null);
        setIsGuestMode(true);
      } else {
        setUser(null);
        setIsGuestMode(false);
      }
    });
  }, []);

  const handleLoginWithPhone = async (phone: string) => {
    setLoading(true);
    setError(null);

    try {
      if (!navigator.onLine) {
        setError('لا يوجد اتصال بالإنترنت');
        return { success: false, message: 'لا يوجد اتصال بالإنترنت' };
      }

      const result = await loginWithPhone(phone.trim());
      if (!result.success) setError(result.message || 'فشل إرسال رمز التحقق');
      return result;
    } catch (err: any) {
      console.error('Login Error:', err);
      setError('حدث خطأ أثناء تسجيل الدخول');
      return { success: false, message: 'حدث خطأ أثناء تسجيل الدخول' };
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (phone: string, otp: string) => {
    setLoading(true);
    setError(null);

    try {
      const result = await verifyOTP(phone.trim(), otp.trim());
      if (result.success) {
        // تأكد من وجود customer_id في بيانات المستخدم وتحديث localStorage
        if (result.user && result.existing_user) {
          // إذا كان المستخدم موجود بالفعل
          if (!result.user.customer_id && result.user.id) {
            console.log('Setting customer_id from user id for existing user:', result.user.id);
            result.user.customer_id = result.user.id;
          }
          
          // تأكد من حفظ البيانات المحدثة في localStorage
          localStorage.setItem('auth_user', JSON.stringify(result.user));
        }
        
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        
        // Dispatch auth change event after successful login
        window.dispatchEvent(new Event('auth-change'));
      } else {
        setError(result.message || 'رمز التحقق غير صحيح');
      }
      return result;
    } catch (err: any) {
      console.error('OTP Error:', err);
      setError('فشل التحقق من الرمز');
      return { success: false, message: 'فشل التحقق من الرمز' };
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteProfile = async (data: { phone: string; name: string; email?: string }) => {
    setLoading(true);
    setError(null);

    try {
      const result = await completeProfileFunc(data);
      if (result.success && result.user) {
        // تأكد من وجود customer_id في بيانات المستخدم
        if (!result.user.customer_id && result.user.id) {
          console.log('Setting customer_id from user id:', result.user.id);
          result.user.customer_id = result.user.id;
        }
        
        // تأكد من وجود customer_id في بيانات المستخدم
        if (!result.user.customer_id && result.user.id) {
          console.log('Setting customer_id from user id:', result.user.id);
          result.user.customer_id = result.user.id;
        }
        
        setUser(result.user);
        
        // تأكد من تحديث localStorage بالبيانات الصحيحة
        localStorage.setItem('auth_user', JSON.stringify(result.user));
        
        // Dispatch auth change event after profile completion
        window.dispatchEvent(new Event('auth-change'));
      } else if (result.message) {
        setError(result.message);
      }
      return result;
    } catch (err: any) {
      console.error('Complete Profile Error:', err);
      setError('فشل إكمال الملف الشخصي');
      return { success: false, message: 'فشل إكمال الملف الشخصي' };
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logoutFunc();
    setUser(null);
    localStorage.removeItem('guest_mode');
    setIsGuestMode(false);
    window.dispatchEvent(new Event('auth-change'));

    // Show a farewell message
    const logoutMessage = document.createElement('div');
    logoutMessage.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white py-3 px-4 rounded-lg shadow-lg z-[100] flex items-center gap-2';
    logoutMessage.innerHTML = `
      <div class="w-5 h-5 bg-white rounded-full flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-500"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </div>
      <span>تم تسجيل الخروج بنجاح. نتمنى رؤيتك مرة أخرى قريباً!</span>
    `;
    document.body.appendChild(logoutMessage);

    // Remove the message after 3 seconds
    setTimeout(() => {
      logoutMessage.classList.add('opacity-0', 'transition-opacity', 'duration-300');
      setTimeout(() => {
        document.body.removeChild(logoutMessage);
      }, 300);
    }, 3000);
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteAccountFunc();
      setUser(null);
      window.dispatchEvent(new Event('auth-change'));
    } catch (err) {
      console.error('Delete account error:', err);
      throw err;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    error,
    loginWithPhone: handleLoginWithPhone,
    verifyOTP: handleVerifyOTP,
    completeProfile: handleCompleteProfile,
    logout: handleLogout,
    deleteUserAccount: handleDeleteAccount,
    isAuthenticated: !!user,
    isGuestMode,
    isProduction
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}