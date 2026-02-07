import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fliwyntfvfedslbwkvks.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsaXd5bnRmdmZlZHNsYndrdmtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjYxOTUsImV4cCI6MjA3NjM0MjE5NX0.Fxhqj4VMq_a1ZkHabPChkzTh4Ep_QqBqPS2LDq0dfLY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('🔧 جاري تطبيق التعديل...\n');

// حذف trigger التحديث التلقائي
console.log('1️⃣ حذف trigger التحديث التلقائي...');
const { error: error1 } = await supabase.rpc('execute_sql', {
  query: 'DROP TRIGGER IF EXISTS update_order_with_driver_trigger ON driver_waiting_list;'
});

if (error1) {
  console.error('❌ خطأ في حذف trigger:', error1);
} else {
  console.log('✅ تم حذف trigger بنجاح\n');
}

// حذف الدالة المرتبطة
console.log('2️⃣ حذف الدالة التلقائية...');
const { error: error2 } = await supabase.rpc('execute_sql', {
  query: 'DROP FUNCTION IF EXISTS update_delivery_status_with_driver();'
});

if (error2) {
  console.error('❌ خطأ في حذف الدالة:', error2);
} else {
  console.log('✅ تم حذف الدالة بنجاح\n');
}

if (!error1 && !error2) {
  console.log('✅✅✅ تم تطبيق التعديل بنجاح!\n');
  console.log('📋 النتيجة:');
  console.log('   - لن يتحول الطلب تلقائيًا إلى "في الطريق" عند تعيين السائق');
  console.log('   - السائق يجب أن يبدأ الرحلة يدويًا 🚚\n');
} else {
  console.log('\n⚠️ حدثت بعض الأخطاء. يرجى المحاولة يدويًا.\n');
}

process.exit(0);
