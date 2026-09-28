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

// In-memory request tracking to prevent duplicates (simple deduplication)
const recentRequests = new Map<string, number>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of recentRequests.entries()) {
    if (now - timestamp > 5 * 60 * 1000) {
      recentRequests.delete(key);
    }
  }
}, 5 * 60 * 1000);

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

    // Check if we already processing this exact request
    const requestKey = `${phone}-${Date.now() - (Date.now() % 5000)}`; // 5-second window
    if (recentRequests.has(phone)) {
      const lastRequest = recentRequests.get(phone)!;
      const timeSince = Date.now() - lastRequest;
      if (timeSince < 3000) { // 3 seconds
        console.log(`⚠️ Duplicate request detected for ${phone}, blocked (${timeSince}ms ago)`);
        return new Response(JSON.stringify({
          success: false,
          message: "يرجى الانتظار قليلاً قبل إعادة المحاولة",
          duplicate: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 429
        });
      }
    }
    recentRequests.set(phone, Date.now());

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

    const hasHtdCredentials = htdApiId && htdSenderId;
    const isTestMode = !hasHtdCredentials;

    // Use fixed OTP for test number, random for others
    const isTestNumber = standardizedPhone === "0595284308";
    const otp = isTestNumber ? "123456" : Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    if (!isTestMode) {
      console.log("🔧 HTD SMS Configuration Check:");
      console.log("- HTD_API_ID exists:", !!htdApiId);
      console.log("- HTD_SENDER_ID exists:", !!htdSenderId);
    } else {
      console.log("🧪 Running in TEST MODE - HTD credentials not configured");
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

    // Anti-spam: Prevent sending OTP if a valid one was sent in the last 60 seconds
    if (existingOtp && !existingOtp.is_used) {
      const existingExpiry = new Date(existingOtp.expires_at);
      const timeSinceCreation = new Date().getTime() - (existingExpiry.getTime() - 5 * 60 * 1000);

      if (timeSinceCreation < 60000) {
        console.log("⚠️ Anti-spam: OTP was sent recently, returning existing OTP");
        return new Response(JSON.stringify({
          success: true,
          sms_sent: false,
          message: "تم إرسال رمز التحقق مسبقاً. يرجى الانتظار دقيقة قبل إعادة الإرسال",
          debug: {
            isTestMode: false,
            otp: existingOtp.otp_code,
            antiSpam: true,
            secondsRemaining: Math.ceil((60000 - timeSinceCreation) / 1000)
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

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
      console.log("✅ Test mode - OTP stored successfully (HTD not configured)");

      return new Response(JSON.stringify({
        success: true,
        sms_sent: false,
        message: isTestNumber
          ? "رقم تجريبي - رمز التحقق: 123456"
          : "وضع الاختبار - تم تخزين رمز التحقق",
        debug: {
          isTestMode: true,
          otp: otp,
          isTestNumber: isTestNumber
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
            otp: otp,
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