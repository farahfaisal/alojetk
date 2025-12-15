import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Read the migration file
const migrationPath = join(__dirname, 'supabase/migrations/20251214151900_make_product_id_nullable.sql');
const migrationSQL = readFileSync(migrationPath, 'utf-8');

// Extract the SQL command (skip comments)
const sqlCommand = migrationSQL
  .split('\n')
  .filter(line => !line.trim().startsWith('--') && !line.trim().startsWith('/*') && !line.trim().startsWith('*') && line.trim())
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '');

console.log('Applying migration to make product_id nullable...');
console.log('SQL:', sqlCommand);

// Apply the migration
try {
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: sqlCommand
  });

  if (error) {
    console.error('Error applying migration:', error);
    console.log('\nTrying alternative method...');

    // Try using the REST API directly
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({ sql: sqlCommand })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Alternative method also failed:', errorText);
      console.error('\nPlease apply the migration manually in Supabase Dashboard SQL Editor:');
      console.log(sqlCommand);
      process.exit(1);
    }
  }

  console.log('✅ Migration applied successfully!');
  console.log('The order_items.product_id column is now nullable.');
} catch (err) {
  console.error('Error:', err);
  console.error('\nPlease apply the migration manually in Supabase Dashboard SQL Editor:');
  console.log(sqlCommand);
  process.exit(1);
}
