import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// HTD SMS API Configuration
const htdApiId = Deno.env.get("HTD_API_ID")!;
const htdSenderId = Deno.env.get("HTD_SENDER_ID") || "SMS";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (req.headers.get("content-type") !== "application/json") {
      return new Response(JSON.stringify({ success: false, message: "الطلب يجب أن يكون بصيغة JSON" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const { phone } = await req.json();

    if (!phone) {
      return new Response(JSON.stringify({ success: false, message: "رقم الهاتف مطلوب" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    let standardizedPhone = phone;
    if (phone.startsWith("+970")) standardizedPhone = "0" + phone.slice(4);
    else if (phone.startsWith("970")) standardizedPhone = "0" + phone.slice(3);

    console.log("Sending OTP to phone:", standardizedPhone);

    const isTestPhone = standardizedPhone === "0595284308";

    const hasHtdCredentials = htdApiId && htdSenderId;
    // Force test mode until HTD Sender ID is approved
    const isTestMode = true; // isTestPhone || !hasHtdCredentials;
    const otp = isTestMode ? "123456" : Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    if (!isTestMode) {
      console.log("🔧 HTD SMS Configuration Check for real number:");
      console.log("- HTD_API_ID exists:", !!htdApiId);
      console.log("- HTD_SENDER_ID exists:", !!htdSenderId);
    } else {
      console.log("🧪 Running in TEST MODE:", {
        isTestPhone,
        hasHtdCredentials
      });
    }

    const otpResponse = await fetch(`${supabaseUrl}/rest/v1/stored_otps?phone=eq.${standardizedPhone}`, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    const existingOtps = await otpResponse.json();
    const existingOtp = existingOtps?.[0];

    console.log("Existing OTP record:", existingOtp);

    let dbResult;
    if (existingOtp) {
      dbResult = await fetch(`${supabaseUrl}/rest/v1/stored_otps?phone=eq.${standardizedPhone}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          otp_code: otp,
          expires_at: expiresAt.toISOString(),
          is_used: false,
        })
      });
    } else {
      dbResult = await fetch(`${supabaseUrl}/rest/v1/stored_otps`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          phone: standardizedPhone,
          otp_code: otp,
          expires_at: expiresAt.toISOString(),
          is_used: false,
        })
      });
    }

    if (!dbResult.ok) {
      const error = await dbResult.json();
      console.error("DB operation error:", error);
      return new Response(
        JSON.stringify({ success: false, message: "فشل في تخزين الكود", error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log("OTP stored successfully:", {
      phone: standardizedPhone,
      otp: otp,
      expires_at: expiresAt.toISOString()
    });

    if (isTestMode) {
      console.log("✅ Test mode - OTP stored successfully");
      const testMessage = isTestPhone
        ? "حساب تجريبي - استخدم الرمز 123456"
        : "وضع الاختبار مفعل (HTD غير متاح) - استخدم الرمز 123456";

      return new Response(JSON.stringify({
        success: true,
        sms_sent: false,
        message: "رمز التحقق جاهز - استخدم الرمز: 123456",
        debug: {
          isTestMode: true,
          otp: otp,
          message: testMessage
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Format phone for HTD (international format: 970599999999)
    const formattedPhone = standardizedPhone.startsWith("0")
      ? "970" + standardizedPhone.slice(1)
      : standardizedPhone;

    console.log("📱 SMS Send Attempt Details:");
    console.log("- Target phone:", formattedPhone);
    console.log("- Sender ID:", htdSenderId);

    try {
      console.log("🚀 Attempting to send SMS via HTD...");

      const messageText = `رمز التحقق الخاص بك هو: ${otp}`;

      // Build HTD API URL with parameters (matches: http://sms.htd.ps/API/SendSMS.aspx?id=xxx&sender=xxx&to=970xxx&msg=xxx)
      const htdUrl = new URL("http://sms.htd.ps/API/SendSMS.aspx");
      htdUrl.searchParams.append("id", htdApiId);
      htdUrl.searchParams.append("sender", htdSenderId);
      htdUrl.searchParams.append("to", formattedPhone);
      htdUrl.searchParams.append("msg", messageText);
      htdUrl.searchParams.append("mode", "0");

      console.log("📤 HTD API URL:", htdUrl.toString());

      const response = await fetch(htdUrl.toString(), {
        method: 'GET'
      });

      const responseText = await response.text();
      console.log("📥 HTD Response:", responseText);

      // Check if SMS was sent successfully
      if (responseText.includes("Message Sent Successfully")) {
        console.log("✅ SMS sent successfully via HTD!");

        return new Response(JSON.stringify({
          success: true,
          sms_sent: true,
          message: "تم إرسال رمز التحقق بنجاح",
          debug: {
            isTestMode: false,
            htdResponse: responseText,
            phone: formattedPhone
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        // SMS failed
        console.error("❌ HTD SMS Error:", responseText);

        return new Response(JSON.stringify({
          success: false,
          sms_sent: false,
          message: "فشل إرسال رسالة SMS",
          debug: {
            isTestMode: false,
            otp: otp,
            htdResponse: responseText,
            phone: formattedPhone
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }

    } catch (htdError: any) {
      console.error("❌ HTD API Error:", htdError);

      return new Response(JSON.stringify({
        success: false,
        sms_sent: false,
        message: "فشل إرسال رسالة SMS",
        debug: {
          isTestMode: false,
          otp: otp,
          smsError: htdError.message,
          phone: formattedPhone
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }
  } catch (err: any) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ success: false, message: "حدث خطأ", error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});