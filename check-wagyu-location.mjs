#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fliwyntfvfedslbwkvks.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsaXd5bnRmdmZlZHNsYndrdmtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjYxOTUsImV4cCI6MjA3NjM0MjE5NX0.Fxhqj4VMq_a1ZkHabPChkzTh4Ep_QqBqPS2LDq0dfLY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkWagyuLocation() {
  console.log('🔍 البحث عن مطعم واغيو...\n');

  // البحث بأسماء مختلفة
  const searchTerms = ['واغيو', 'wagyu', 'وأغيو', 'Wagyu'];

  for (const term of searchTerms) {
    const { data, error } = await supabase
      .from('vendors')
      .select('id, store_name, latitude, longitude, address')
      .ilike('store_name', `%${term}%`);

    if (error) {
      console.error(`❌ خطأ في البحث عن "${term}":`, error.message);
      continue;
    }

    if (data && data.length > 0) {
      console.log(`✅ تم العثور على ${data.length} نتيجة للبحث عن "${term}":\n`);

      data.forEach((vendor, index) => {
        console.log(`--- المتجر #${index + 1} ---`);
        console.log(`📛 الاسم: ${vendor.store_name}`);
        console.log(`🆔 المعرف: ${vendor.id}`);
        console.log(`📍 العنوان: ${vendor.address || 'غير محدد'}`);
        console.log(`🌍 خط العرض: ${vendor.latitude || '❌ غير محدد'}`);
        console.log(`🌍 خط الطول: ${vendor.longitude || '❌ غير محدد'}`);

        // التحقق من دقة الموقع
        if (vendor.latitude && vendor.longitude) {
          console.log(`✅ الموقع محدد بدقة!`);
          console.log(`🔗 رابط Google Maps: https://www.google.com/maps?q=${vendor.latitude},${vendor.longitude}`);
        } else {
          console.log(`❌ الموقع غير محدد - يجب إضافة الإحداثيات!`);
        }
        console.log('');
      });

      break; // وجدنا نتائج، لا داعي للبحث عن المصطلحات الأخرى
    }
  }

  // البحث عن جميع المتاجر بدون موقع
  console.log('\n📊 إحصائيات المتاجر:\n');

  const { data: allVendors, error: allError } = await supabase
    .from('vendors')
    .select('id, store_name, latitude, longitude');

  if (!allError && allVendors) {
    const totalVendors = allVendors.length;
    const withLocation = allVendors.filter(v => v.latitude && v.longitude).length;
    const withoutLocation = totalVendors - withLocation;

    console.log(`📍 إجمالي المتاجر: ${totalVendors}`);
    console.log(`✅ متاجر بموقع دقيق: ${withLocation} (${Math.round(withLocation/totalVendors*100)}%)`);
    console.log(`❌ متاجر بدون موقع: ${withoutLocation} (${Math.round(withoutLocation/totalVendors*100)}%)`);

    if (withoutLocation > 0) {
      console.log('\n⚠️  المتاجر بدون موقع:');
      allVendors
        .filter(v => !v.latitude || !v.longitude)
        .slice(0, 10)
        .forEach((v, i) => {
          console.log(`  ${i + 1}. ${v.store_name}`);
        });

      if (withoutLocation > 10) {
        console.log(`  ... و ${withoutLocation - 10} متجر آخر`);
      }
    }
  }
}

checkWagyuLocation().catch(console.error);
