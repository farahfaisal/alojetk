import React, { useState, useEffect } from 'react';
import { Gift, X, Loader2, AlertCircle, Check, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAvailableRewards, redeemPointsForReward, PointsReward } from '../lib/points';
import { useAuth } from '../contexts/AuthContext';

interface PointsRedemptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  userPoints: number;
  onRedeemSuccess: () => void;
}

const PointsRedemptionModal: React.FC<PointsRedemptionModalProps> = ({
  isOpen,
  onClose,
  userPoints,
  onRedeemSuccess
}) => {
  const { user } = useAuth();
  const [rewards, setRewards] = useState<PointsReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReward, setSelectedReward] = useState<PointsReward | null>(null);
  const [confirmationStep, setConfirmationStep] = useState(false);
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redemptionCode, setRedemptionCode] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchRewards();
    }
  }, [isOpen]);

  const fetchRewards = async () => {
    try {
      setLoading(true);
      setError(null);

      const rewardsData = await getAvailableRewards();
      setRewards(rewardsData);
    } catch (err) {
      console.error('Error fetching rewards:', err);
      setError('حدث خطأ في جلب المكافآت المتاحة');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectReward = (reward: PointsReward) => {
    setSelectedReward(reward);
    setConfirmationStep(true);
  };

  const handleRedeemReward = async () => {
    const customerId = user?.customer_id || user?.id;
    if (!selectedReward || !customerId) return;

    try {
      setRedeemLoading(true);
      setRedeemError(null);

      // Call the RPC function to redeem the reward with proper parameters
      const result = await redeemPointsForReward('', selectedReward.id, customerId);

      if (result.success) {
        setRedemptionCode(result.redemptionCode);
        onRedeemSuccess();
      } else {
        setRedeemError(result.message || 'فشل في استبدال النقاط');
      }
    } catch (err) {
      console.error('Error redeeming reward:', err);
      setRedeemError('فشل في استبدال النقاط. الرجاء المحاولة مرة أخرى.');
    } finally {
      setRedeemLoading(false);
    }
  };

  const handleBack = () => {
    setConfirmationStep(false);
    setSelectedReward(null);
    setRedeemError(null);
    setRedemptionCode(null);
  };

  const getRewardIcon = (type: string) => {
    switch (type) {
      case 'free_delivery':
        return <Gift className="w-6 h-6" />;
      case 'order_discount':
        return <Gift className="w-6 h-6" />;
      case 'delivery_discount':
        return <Gift className="w-6 h-6" />;
      case 'product_discount':
        return <Gift className="w-6 h-6" />;
      case 'gift':
        return <Gift className="w-6 h-6" />;
      default:
        return <Gift className="w-6 h-6" />;
    }
  };

  const getRewardDescription = (reward: PointsReward) => {
    switch (reward.reward_type) {
      case 'free_delivery':
        return 'توصيل مجاني';
      case 'order_discount':
        if (reward.discount_type === 'percentage') {
          return `خصم ${reward.discount_value}% على الطلب`;
        } else {
          return `خصم ${reward.discount_value} شيكل على الطلب`;
        }
      case 'delivery_discount':
        if (reward.discount_type === 'percentage') {
          return `خصم ${reward.discount_value}% على رسوم التوصيل`;
        } else {
          return `خصم ${reward.discount_value} شيكل على رسوم التوصيل`;
        }
      case 'product_discount':
        if (reward.discount_type === 'percentage') {
          return `خصم ${reward.discount_value}% على المنتجات`;
        } else {
          return `خصم ${reward.discount_value} شيكل على المنتجات`;
        }
      case 'gift':
        return 'هدية مجانية';
      default:
        return reward.description || '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {confirmationStep ? 'تأكيد استبدال النقاط' : 'استبدال النقاط'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-10 h-10 text-brand animate-spin mb-4" />
              <p className="text-gray-600">جاري تحميل المكافآت المتاحة...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-800 p-4 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          ) : confirmationStep && selectedReward ? (
            <div className="space-y-6">
              {redeemError && (
                <div className="bg-red-50 text-red-800 p-4 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p>{redeemError}</p>
                </div>
              )}

              {redemptionCode ? (
                <div className="text-center py-6 space-y-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <Check className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">تم استبدال النقاط بنجاح!</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-2">رمز الاستبدال الخاص بك:</p>
                    <p className="text-xl font-bold text-brand">{redemptionCode}</p>
                  </div>
                  <p className="text-sm text-gray-600">
                    يمكنك استخدام هذا الرمز عند إتمام طلبك التالي
                  </p>
                  <button
                    onClick={onClose}
                    className="w-full bg-brand text-white py-3 rounded-lg hover:bg-brand-light transition-colors"
                  >
                    إغلاق
                  </button>
                </div>
              ) : (
                <>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-brand/10 rounded-full flex items-center justify-center">
                        {getRewardIcon(selectedReward.reward_type)}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{selectedReward.name}</h3>
                        <p className="text-sm text-gray-600">
                          {getRewardDescription(selectedReward)}
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-3 border-t">
                      <span className="text-gray-600">التكلفة:</span>
                      <span className="font-bold text-brand">{selectedReward.points_cost} نقطة</span>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <span className="text-gray-600">رصيدك الحالي:</span>
                      <span className="font-bold text-gray-900">{userPoints} نقطة</span>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <span className="text-gray-600">الرصيد المتبقي:</span>
                      <span className="font-bold text-gray-900">
                        {userPoints - selectedReward.points_cost} نقطة
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>
                      صالح حتى {new Date(selectedReward.end_date).toLocaleDateString('ar')}
                    </span>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      رجوع
                    </button>
                    <button
                      type="button"
                      onClick={handleRedeemReward}
                      disabled={redeemLoading || userPoints < selectedReward.points_cost || !user?.customer_id}
                      className="flex-1 bg-brand text-white py-3 rounded-lg hover:bg-brand-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {redeemLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          جاري الاستبدال...
                        </>
                      ) : (
                        'تأكيد الاستبدال'
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : rewards.length === 0 ? (
            <div className="text-center py-8">
              <Gift className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">لا توجد مكافآت متاحة</h3>
              <p className="text-gray-500">لا توجد مكافآت متاحة للاستبدال حالياً</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-brand/10 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">رصيد النقاط الحالي:</span>
                  <span className="font-bold text-brand">{userPoints} نقطة</span>
                </div>
              </div>

              <div className="space-y-3">
                {rewards.map((reward) => (
                  <button
                    key={reward.id}
                    onClick={() => handleSelectReward(reward)}
                    disabled={userPoints < reward.points_cost}
                    className={`w-full text-right p-4 rounded-lg border-2 transition-all ${
                      userPoints >= reward.points_cost
                        ? 'border-gray-200 hover:border-brand/50'
                        : 'border-gray-200 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-brand/10 rounded-full flex items-center justify-center flex-shrink-0">
                        {getRewardIcon(reward.reward_type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <h3 className="font-semibold text-gray-900">{reward.name}</h3>
                          <span className="font-bold text-brand">{reward.points_cost} نقطة</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {getRewardDescription(reward)}
                        </p>
                        {reward.min_order_amount && (
                          <p className="text-xs text-gray-500 mt-1">
                            الحد الأدنى للطلب: {reward.min_order_amount} شيكل
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                          <Clock className="w-3 h-3" />
                          <span>
                            صالح حتى {new Date(reward.end_date).toLocaleDateString('ar')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default PointsRedemptionModal;