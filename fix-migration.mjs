import { readFileSync } from 'fs';

// Read .env file manually
const envContent = readFileSync('.env', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseAnonKey = envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const sql = 'ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL;';

console.log('🔧 Applying migration to make product_id nullable...\n');
console.log('SQL:', sql, '\n');

// Try to execute via Supabase REST API
const url = `${supabaseUrl}/rest/v1/rpc/exec_sql`;

try {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`
    },
    body: JSON.stringify({ query: sql })
  });

  const result = await response.text();
  console.log('Response:', result);

  if (response.ok) {
    console.log('\n✅ Migration applied successfully!');
  } else {
    console.log('\n⚠️  Could not apply via API. Please apply manually.');
  }
} catch (error) {
  console.error('❌ Error:', error.message);
}

console.log('\n📋 Manual application instructions:');
console.log('1. Go to your Supabase Dashboard: https://fliwyntfvfedslbwkvks.supabase.co');
console.log('2. Navigate to SQL Editor');
console.log('3. Run this SQL:');
console.log('\n' + sql + '\n');
