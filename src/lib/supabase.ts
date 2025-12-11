// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Improved error handling for fetch
const customFetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
  try {
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout
    
    const [url, options = {}] = args;
    const fetchOptions = {
      ...options,
      signal: controller.signal
    };
    
    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);
    
    console.log('Making request to:', url);
    // Check if response is ok
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Response error:', errorText);
      throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
    }
    
    return response;
  } catch (err: any) {
    console.error('Supabase fetch error:', err);
    
    if (err.name === 'AbortError') {
      throw new Error('انتهت مهلة الاتصال بالخادم');
    } else if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
      throw new Error('فشل الاتصال بالخادم. يرجى التحقق من:\n1. اتصال الإنترنت\n2. إعدادات CORS في Supabase\n3. صحة رابط Supabase');
    } else if (err.message?.includes('HTTP')) {
      throw new Error(`خطأ في الخادم: ${err.message}`);
    } else {
      throw err;
    }
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'X-Client-Info': 'ben-edek-app-twilio'
    },
    fetch: customFetch
  }
});

// Test Supabase connection
export const testSupabaseConnection = async () => {
  try {
    console.log('🔗 Testing Supabase connection...');
    console.log('📍 Supabase URL:', supabaseUrl);
    console.log('🔑 Has Anon Key:', !!supabaseAnonKey);
    
    // Test basic connection
    const { data, error } = await supabase
      .from('vendors')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Supabase connection test failed:', error);
      return { success: false, error: error.message };
    }
    
    console.log('✅ Supabase connection successful');
    return { success: true };
  } catch (err) {
    console.error('❌ Supabase connection error:', err);
    return { success: false, error: err.message };
  }
};

// Test Edge Functions
export const testEdgeFunctions = async () => {
  try {
    console.log('🔧 Testing Edge Functions...');
    
    // Test send-otp function with a test call
    const response = await fetch(`${supabaseUrl}/functions/v1/send-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`
      },
      body: JSON.stringify({ phone: '0595284308' }) // Test number
    });
    
    console.log('📡 Edge Function response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Edge Function error:', errorText);
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }
    
    const data = await response.json();
    console.log('✅ Edge Function test successful:', data);
    return { success: true, data };
  } catch (err) {
    console.error('❌ Edge Function test failed:', err);
    return { success: false, error: err.message };
  }
};
export const getVendors = async () => {
  try {
    const { data, error } = await supabase
      .from('vendors')
      .select('*');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Supabase fetch error:', error);
    // Return empty array instead of throwing to prevent app crashes
    return [];
  }
};