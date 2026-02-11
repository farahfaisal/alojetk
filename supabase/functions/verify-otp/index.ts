import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log('=== Verify OTP Function Started ===');
    
    // Parse request body
    const body = await req.json();
    console.log('Request body:', body);
    
    const { phone, otp, referralCode } = body;
    console.log('Received data:', { phone, otp, referralCode });

    if (!phone || !otp) {
      console.error('Missing phone or OTP');
      return new Response(
        JSON.stringify({
          success: false, 
          message: "رقم الهاتف ورمز التحقق مطلوبان" 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Standardize phone number
    let standardizedPhone = phone;
    if (phone.startsWith("+970")) standardizedPhone = "0" + phone.slice(4);
    else if (phone.startsWith("970")) standardizedPhone = "0" + phone.slice(3);

    console.log("Verifying OTP for phone:", standardizedPhone, "OTP:", otp);

    // التحقق من OTP من جدول stored_otps
    const { data: otpData, error: verifyError } = await supabase
      .from('stored_otps')
      .select('*')
      .eq('phone', standardizedPhone)
      .eq('otp_code', otp)
      .gte('expires_at', new Date().toISOString())
      .eq('is_used', false)
      .single();

    console.log('OTP verification result:', { otpData, verifyError });

    if (verifyError) {
      console.log("OTP verification failed - invalid or expired code");
      return new Response(
        JSON.stringify({
          success: false, 
          message: "رمز التحقق غير صحيح أو منتهي الصلاحية"
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!otpData) {
      console.log("OTP verification failed - no matching record");
      return new Response(
        JSON.stringify({
          success: false, 
          message: "رمز التحقق غير صحيح أو منتهي الصلاحية" 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // تحديث OTP كمستخدم بعد التحقق الناجح
    await supabase
      .from('stored_otps')
      .update({ is_used: true })
      .eq('phone', standardizedPhone);

    // Check if customer exists
    const { data: customerData, error: customerError } = await supabase
      .from("customers")
      .select("*")
      .eq("phone", standardizedPhone)
      .single();

    console.log('Customer lookup result:', { customerData, customerError });

    let customer;
    let existingUser = false;
    let referralProcessed = false;
    let referralMessage = null;
    let pointsAwarded = null;

    if (customerData) {
      // Existing customer
      customer = customerData;
      existingUser = true;
      console.log("Existing customer found:", customer.id);
    } else {
      // Create new customer
      const { data: newCustomer, error: createError } = await supabase
        .from("customers")
        .insert([
          {
            name: "مستخدم جديد", 
            phone: standardizedPhone
          }
        ])
        .select()
        .single();

      console.log('New customer creation result:', { newCustomer, createError });

      if (createError) {
        console.error("Error creating new customer:", createError);
        return new Response(
          JSON.stringify({
            success: false, 
            message: "فشل في إنشاء حساب جديد" 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      customer = newCustomer;
      console.log("New customer created:", customer.id);

      // Process referral code if provided
      if (referralCode) {
        try {
          console.log("Processing referral code:", referralCode, "for customer:", customer.id);
          
          // First check if referral code exists and is valid
          const { data: codeData, error: codeError } = await supabase
            .from('referral_codes')
            .select('*')
            .eq('code', referralCode)
            .eq('status', 'active')
            .single();
            
          if (codeError || !codeData) {
            console.error('Referral code not found or invalid:', codeError);
            referralProcessed = false;
            referralMessage = 'رمز الإحالة غير صالح أو منتهي الصلاحية';
          } else {
            // Create referral record
            const { data: referralRecord, error: referralError } = await supabase
              .from('referrals')
              .insert({
                referrer_id: codeData.customer_id || codeData.user_id,
                referred_id: customer.id,
                code_id: codeData.id,
                status: 'completed'
              })
              .select()
              .single();
              
            if (referralError) {
              console.error('Error creating referral record:', referralError);
              referralProcessed = false;
              referralMessage = 'فشل في معالجة رمز الإحالة';
            } else {
              // Add points to both users
              try {
                // Add points to referred user (new user)
                const { error: pointsError1 } = await supabase
                  .from('points_transactions')
                  .insert({
                    account_id: customer.id, // This might need to be points_account_id
                    amount: codeData.points_reward,
                    type: 'earn',
                    description: 'نقاط مكافأة الإحالة',
                    reference_id: referralRecord.id
                  });
                  
                // Add points to referrer
                const { error: pointsError2 } = await supabase
                  .from('points_transactions')
                  .insert({
                    account_id: codeData.customer_id || codeData.user_id,
                    amount: codeData.points_referrer,
                    type: 'earn',
                    description: 'نقاط إحالة مستخدم جديد',
                    reference_id: referralRecord.id
                  });
                  
                if (pointsError1 || pointsError2) {
                  console.warn('Error adding points:', { pointsError1, pointsError2 });
                }
                
                referralProcessed = true;
                referralMessage = 'تم تطبيق رمز الإحالة بنجاح';
                pointsAwarded = codeData.points_reward;
              } catch (pointsErr) {
                console.error('Error processing points:', pointsErr);
                referralProcessed = true; // Still mark as processed
                referralMessage = 'تم تطبيق رمز الإحالة ولكن فشل في إضافة النقاط';
              }
            }
          }

        } catch (refErr) {
          console.error("Referral processing error:", refErr);
          referralProcessed = false;
          referralMessage = 'حدث خطأ أثناء معالجة رمز الإحالة';
        }
      }
    }

    console.log('Final response data preparation...');

    return new Response(
      JSON.stringify({
        success: true,
        message: "تم التحقق بنجاح",
        existing_user: existingUser,
        user: {
          id: customer.id,
          customer_id: customer.id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email
        },
        referral_processed: referralCode ? referralProcessed : null,
        referral_message: referralCode ? referralMessage : null,
        points_awarded: referralCode ? pointsAwarded : null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error("Function error:", err);
    return new Response(
      JSON.stringify({
        success: false, 
        message: "حدث خطأ أثناء التحقق", 
        error: err.message || 'Unknown server error'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});