import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import twilio from "npm:twilio@4.11.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;
const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");
const twilioMessageServiceSid = Deno.env.get("TWILIO_MESSAGE_SERVICE_SID");

let twilioClient;
try {
  twilioClient = twilio(accountSid, authToken);
  console.log("✅ Twilio client created successfully");
} catch (clientError) {
  console.error("❌ Failed to create Twilio client:", clientError);
}

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

    const isTest = standardizedPhone === "0595284308";
    const otp = isTest ? "123456" : Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    if (!isTest) {
      console.log("🔧 Twilio Configuration Check for real number:");
      console.log("- ACCOUNT_SID exists:", !!accountSid);
      console.log("- AUTH_TOKEN exists:", !!authToken);
      console.log("- PHONE_NUMBER exists:", !!twilioPhoneNumber);
      console.log("- MESSAGE_SERVICE_SID exists:", !!twilioMessageServiceSid);

      if (!accountSid || !authToken || (!twilioPhoneNumber && !twilioMessageServiceSid)) {
        console.error("❌ Missing Twilio credentials for real number!");
        return new Response(JSON.stringify({
          success: false,
          sms_sent: false,
          message: "خدمة الرسائل النصية غير متاحة حالياً. يرجى استخدام الرقم التجريبي: 0595284308",
          debug: {
            isTestMode: false,
            missingCredentials: {
              accountSid: !accountSid,
              authToken: !authToken,
              phoneNumber: !twilioPhoneNumber,
              messageServiceSid: !twilioMessageServiceSid
            }
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }

      if (!accountSid.startsWith('AC')) {
        console.error("❌ Invalid Account SID format!");
        return new Response(JSON.stringify({
          success: false,
          sms_sent: false,
          message: "إعدادات خدمة الرسائل غير صحيحة. يرجى استخدام الرقم التجريبي: 0595284308",
          debug: {
            accountSidFormat: "يجب أن يبدأ بـ AC"
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }
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

    if (isTest) {
      console.log("✅ Test account - OTP stored successfully");
      return new Response(JSON.stringify({
        success: true,
        sms_sent: false,
        message: "رمز التحقق جاهز - استخدم الرمز: 123456",
        debug: {
          isTestMode: true,
          otp: otp,
          message: "حساب تجريبي - استخدم الرمز 123456"
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const formattedPhone = standardizedPhone.startsWith("0")
      ? "+970" + standardizedPhone.slice(1)
      : standardizedPhone;

    console.log("📱 SMS Send Attempt Details:");
    console.log("- Target phone:", formattedPhone);
    console.log("- From number/Service:", twilioPhoneNumber || twilioMessageServiceSid);

    try {
      console.log("🚀 Attempting to send SMS via Twilio...");
      
      const messageConfig: any = {
        body: `رمز التحقق الخاص بك هو: ${otp}`,
        to: formattedPhone,
      };
      
      if (twilioMessageServiceSid) {
        messageConfig.messagingServiceSid = twilioMessageServiceSid;
        console.log("📤 Using Message Service SID:", twilioMessageServiceSid);
      } else if (twilioPhoneNumber) {
        messageConfig.from = twilioPhoneNumber;
        console.log("📤 Using Phone Number:", twilioPhoneNumber);
      } else {
        throw new Error("لا يوجد رقم مرسل أو Message Service SID");
      }

      console.log("📤 Final message config:", JSON.stringify(messageConfig, null, 2));
      
      const message = await twilioClient.messages.create(messageConfig);

      console.log("✅ SMS sent successfully!");
      console.log("- Message SID:", message.sid);
      console.log("- Status:", message.status);
      
      return new Response(JSON.stringify({
        success: true,
        sms_sent: true,
        message: "تم إرسال رمز التحقق بنجاح",
        debug: {
          isTestMode: false,
          messageSid: message.sid,
          messageStatus: message.status,
          phone: formattedPhone
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
      
    } catch (twilioError: any) {
      console.error("❌ Twilio API Error:", twilioError);
      
      return new Response(JSON.stringify({
        success: false,
        sms_sent: false,
        message: "فشل إرسال رسالة SMS",
        debug: {
          isTestMode: false,
          otp: otp,
          smsError: twilioError.message,
          twilioError: twilioError.code,
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
