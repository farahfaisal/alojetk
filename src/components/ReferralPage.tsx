import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Share2, Copy, Gift, Users, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface ReferralData {
  referral_code: string;
  referral_count: number;
  total_earned: number;
}

interface Referral {
  id: string;
  referred_id: string;
  status: string;
  referrer_reward_points: number;
  created_at: string;
  customer_name: string;
}

export default function ReferralPage() {
  const { user } = useAuth();
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const referralLink = `https://app.jetekapp.site?ref=${referralData?.referral_code}`;

  useEffect(() => {
    if (user?.id) {
      fetchReferralData();
      fetchReferrals();
    }
  }, [user]);

  const fetchReferralData = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('referral_code, referral_count')
        .eq('id', user?.id)
        .maybeSingle();

      if (error) throw error;

      const { data: rewards } = await supabase
        .from('referrals')
        .select('referrer_reward_points')
        .eq('referrer_id', user?.id)
        .eq('status', 'rewarded');

      const totalEarned = rewards?.reduce((sum, r) => sum + r.referrer_reward_points, 0) || 0;

      setReferralData({
        referral_code: data?.referral_code || '',
        referral_count: data?.referral_count || 0,
        total_earned: totalEarned
      });
    } catch (error) {
      console.error('Error fetching referral data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReferrals = async () => {
    try {
      const { data, error } = await supabase
        .from('referrals')
        .select(`
          id,
          referred_id,
          status,
          referrer_reward_points,
          created_at,
          referred:customers!referrals_referred_id_fkey(name)
        `)
        .eq('referrer_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedReferrals = data?.map((r: any) => ({
        ...r,
        customer_name: r.referred?.name || 'مستخدم جديد'
      })) || [];

      setReferrals(formattedReferrals);
    } catch (error) {
      console.error('Error fetching referrals:', error);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error copying:', error);
    }
  };

  const shareReferral = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'انضم إلى جيتك',
          text: 'احصل على 50 نقطة عند التسجيل من خلال رابط الإحالة الخاص بي!',
          url: referralLink
        });
      } else {
        copyToClipboard();
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-gradient-to-br from-green-600 to-green-700 text-white p-6">
        <h1 className="text-2xl font-bold mb-2">برنامج الإحالة</h1>
        <p className="text-green-100">ادع أصدقاءك واحصل على مكافآت</p>
      </div>

      <div className="p-4 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-sm p-6"
        >
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <Gift className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              احصل على 50 نقطة لكل إحالة!
            </h2>
            <p className="text-gray-600">
              شارك رابط الإحالة مع أصدقائك واحصل على نقاط عند تسجيلهم
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-600 mb-2">رابط الإحالة الخاص بك:</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white rounded-lg px-3 py-2 text-sm border border-gray-200 overflow-x-auto">
                {referralLink}
              </div>
              <button
                onClick={copyToClipboard}
                className="flex-shrink-0 p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                {copied ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            onClick={shareReferral}
            className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:from-green-700 hover:to-green-800 transition-all shadow-md hover:shadow-lg"
          >
            <div className="flex items-center justify-center w-6 h-6 bg-white/20 rounded-lg">
              <Share2 className="w-4 h-4" />
            </div>
            مشاركة رابط الإحالة
          </button>
        </motion.div>

        <div className="grid grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl shadow-sm p-4 text-center"
          >
            <Users className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{referralData?.referral_count || 0}</p>
            <p className="text-sm text-gray-600">إحالات ناجحة</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl shadow-sm p-4 text-center"
          >
            <Gift className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">{referralData?.total_earned || 0}</p>
            <p className="text-sm text-gray-600">نقطة مكتسبة</p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl shadow-sm p-6"
        >
          <h3 className="text-lg font-bold text-gray-900 mb-4">كيف يعمل البرنامج؟</h3>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <p className="font-semibold text-gray-900">شارك رابطك</p>
                <p className="text-sm text-gray-600">أرسل رابط الإحالة لأصدقائك وعائلتك</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <p className="font-semibold text-gray-900">يسجلون حساب جديد</p>
                <p className="text-sm text-gray-600">عند التسجيل عبر رابطك، يحصلون على 50 نقطة</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <p className="font-semibold text-gray-900">احصل على مكافأتك</p>
                <p className="text-sm text-gray-600">تحصل على 50 نقطة عند أول طلب لهم</p>
              </div>
            </div>
          </div>
        </motion.div>

        {referrals.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-xl shadow-sm p-6"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4">إحالاتي</h3>
            <div className="space-y-3">
              {referrals.map((referral) => (
                <div key={referral.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="font-semibold text-gray-900">{referral.customer_name}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(referral.created_at).toLocaleDateString('ar')}
                    </p>
                  </div>
                  <div className="text-left">
                    {referral.status === 'rewarded' ? (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm font-semibold">+{referral.referrer_reward_points} نقطة</span>
                      </div>
                    ) : referral.status === 'completed' ? (
                      <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">قيد المعالجة</span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">قيد الانتظار</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}