import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
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
    const otpResponse = await fetch(
      `${supabaseUrl}/rest/v1/stored_otps?phone=eq.${standardizedPhone}&otp_code=eq.${otp}&is_used=eq.false&expires_at=gte.${new Date().toISOString()}`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const otpRecords = await otpResponse.json();
    const otpData = otpRecords?.[0];

    console.log('OTP verification result:', { otpData });

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
    await fetch(`${supabaseUrl}/rest/v1/stored_otps?phone=eq.${standardizedPhone}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ is_used: true })
    });

    // Check if customer exists
    const customerResponse = await fetch(
      `${supabaseUrl}/rest/v1/customers?phone=eq.${standardizedPhone}`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const customers = await customerResponse.json();
    const customerData = customers?.[0];

    console.log('Customer lookup result:', { customerData });

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
      const createResponse = await fetch(`${supabaseUrl}/rest/v1/customers`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          name: "مستخدم جديد",
          phone: standardizedPhone
        })
      });

      if (!createResponse.ok) {
        const createError = await createResponse.json();
        console.error("Error creating new customer:", createError);
        return new Response(
          JSON.stringify({
            success: false,
            message: "فشل في إنشاء حساب جديد"
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      const newCustomers = await createResponse.json();
      customer = newCustomers[0];
      console.log("New customer created:", customer.id);

      // Process referral code if provided
      if (referralCode) {
        try {
          console.log("Processing referral code:", referralCode, "for customer:", customer.id);

          // First check if referral code exists and is valid
          const codeResponse = await fetch(
            `${supabaseUrl}/rest/v1/referral_codes?code=eq.${referralCode}&status=eq.active`,
            {
              method: 'GET',
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
              }
            }
          );

          const codes = await codeResponse.json();
          const codeData = codes?.[0];

          if (!codeData) {
            console.error('Referral code not found or invalid');
            referralProcessed = false;
            referralMessage = 'رمز الإحالة غير صالح أو منتهي الصلاحية';
          } else {
            // Create referral record
            const referralResponse = await fetch(`${supabaseUrl}/rest/v1/referrals`, {
              method: 'POST',
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify({
                referrer_id: codeData.customer_id || codeData.user_id,
                referred_id: customer.id,
                code_id: codeData.id,
                status: 'completed'
              })
            });

            if (!referralResponse.ok) {
              console.error('Error creating referral record');
              referralProcessed = false;
              referralMessage = 'فشل في معالجة رمز الإحالة';
            } else {
              const referralRecords = await referralResponse.json();
              const referralRecord = referralRecords[0];

              // Add points to both users
              try {
                // Add points to referred user (new user)
                await fetch(`${supabaseUrl}/rest/v1/points_transactions`, {
                  method: 'POST',
                  headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    account_id: customer.id,
                    amount: codeData.points_reward,
                    type: 'earn',
                    description: 'نقاط مكافأة الإحالة',
                    reference_id: referralRecord.id
                  })
                });

                // Add points to referrer
                await fetch(`${supabaseUrl}/rest/v1/points_transactions`, {
                  method: 'POST',
                  headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    account_id: codeData.customer_id || codeData.user_id,
                    amount: codeData.points_referrer,
                    type: 'earn',
                    description: 'نقاط إحالة مستخدم جديد',
                    reference_id: referralRecord.id
                  })
                });

                referralProcessed = true;
                referralMessage = 'تم تطبيق رمز الإحالة بنجاح';
                pointsAwarded = codeData.points_reward;
              } catch (pointsErr) {
                console.error('Error processing points:', pointsErr);
                referralProcessed = true;
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