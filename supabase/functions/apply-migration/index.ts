import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Execute the migration SQL
    const { data, error } = await supabase.rpc('exec', {
      sql: 'ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL;'
    });

    if (error) {
      // Try alternative approach using raw SQL
      const { error: execError } = await supabase
        .from('order_items')
        .select('*')
        .limit(1);

      // If we can query, try to modify the schema directly
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
          instructions: 'Please run this SQL in Supabase Dashboard:\nALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL;'
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Migration applied successfully! product_id is now nullable.'
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        instructions: 'Please run this SQL in Supabase Dashboard SQL Editor:\n\nALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL;'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
