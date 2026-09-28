import React, { useState, useEffect } from 'react';
import { Settings, Save, RefreshCw, AlertCircle, Check, DollarSign, Gift, Star, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { getPointsSystemSettings, updatePointsSettings } from '../lib/points';

interface PointsSettingsAdminProps {
  onClose: () => void;
}

const PointsSettingsAdmin: React.FC<PointsSettingsAdminProps> = ({ onClose }) => {
  const [settings, setSettings] = useState({
    point_value: 1,
    min_points_to_redeem: 10,
    max_points_per_order: null as number | null,
    points_expiry_days: null as number | null,
    earn_rate: 10,
    referral_points: 100,
    review_points: 10,
    signup_bonus: 50
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const currentSettings = await getPointsSystemSettings();
        setSettings(currentSettings);
      } catch (err) {
        console.error('Error fetching points settings:', err);
        setError('حدث خطأ في جلب الإعدادات');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const result = await updatePointsSettings(settings);
      
      if (result.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || 'فشل في حفظ الإعدادات');
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      setError('حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    const numValue = value === '' ? null : parseFloat(value);
    setSettings(prev => ({
      ...prev,
      [field]: numValue
    }));
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-50 z-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-brand animate-spin mx-auto mb-4" />
          <p className="text-gray-600">جاري تحميل إعدادات النقاط...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto p-4 flex items-center justify-between">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-gray-700"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="font-medium">رجوع</span>
          </button>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-brand" />
            إعدادات نظام النقاط
          </h2>
          <div className="w-[80px]"></div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 space-y-6">
          {error && (
            <div className="bg-sky-50 text-sky-800 p-4 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-green-50 text-green-600 p-4 rounded-lg flex items-center gap-2"
            >
              <Check className="w-5 h-5 flex-shrink-0" />
              <p>تم حفظ الإعدادات بنجاح!</p>
            </motion.div>
          )}

          {/* Basic Settings */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-brand" />
              الإعدادات الأساسية
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  قيمة النقطة (بالشيكل)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={settings.point_value || ''}
                  onChange={(e) => handleInputChange('point_value', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="1.00"
                />
                <p className="text-xs text-gray-500 mt-1">
                  مثال: 1.00 يعني أن كل نقطة تساوي شيكل واحد
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  معدل كسب النقاط
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={settings.earn_rate || ''}
                  onChange={(e) => handleInputChange('earn_rate', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="10.00"
                />
                <p className="text-xs text-gray-500 mt-1">
                  مثال: 10 يعني نقطة واحدة لكل 10 شيكل
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  الحد الأدنى للاستبدال
                </label>
                <input
                  type="number"
                  min="1"
                  value={settings.min_points_to_redeem || ''}
                  onChange={(e) => handleInputChange('min_points_to_redeem', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="10"
                />
                <p className="text-xs text-gray-500 mt-1">
                  أقل عدد نقاط يمكن استبدالها
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  الحد الأقصى للنقاط في الطلب
                </label>
                <input
                  type="number"
                  min="1"
                  value={settings.max_points_per_order || ''}
                  onChange={(e) => handleInputChange('max_points_per_order', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="اتركه فارغاً لعدم وجود حد أقصى"
                />
                <p className="text-xs text-gray-500 mt-1">
                  أقصى عدد نقاط يمكن استخدامها في طلب واحد
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  مدة انتهاء النقاط (بالأيام)
                </label>
                <input
                  type="number"
                  min="1"
                  value={settings.points_expiry_days || ''}
                  onChange={(e) => handleInputChange('points_expiry_days', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="اتركه فارغاً لعدم انتهاء الصلاحية"
                />
                <p className="text-xs text-gray-500 mt-1">
                  عدد الأيام قبل انتهاء صلاحية النقاط
                </p>
              </div>
            </div>
          </div>

          {/* Bonus Settings */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Gift className="w-5 h-5 text-brand" />
              إعدادات المكافآت
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  نقاط الإحالة
                </label>
                <input
                  type="number"
                  min="0"
                  value={settings.referral_points || ''}
                  onChange={(e) => handleInputChange('referral_points', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  النقاط التي يحصل عليها المُحيل
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  نقاط التقييم
                </label>
                <input
                  type="number"
                  min="0"
                  value={settings.review_points || ''}
                  onChange={(e) => handleInputChange('review_points', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="10"
                />
                <p className="text-xs text-gray-500 mt-1">
                  النقاط لكل تقييم يتم إضافته
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  مكافأة التسجيل
                </label>
                <input
                  type="number"
                  min="0"
                  value={settings.signup_bonus || ''}
                  onChange={(e) => handleInputChange('signup_bonus', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="50"
                />
                <p className="text-xs text-gray-500 mt-1">
                  النقاط للمستخدمين الجدد
                </p>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-brand" />
              معاينة النظام
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">مثال على طلب بقيمة 100 شيكل:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• النقاط المكتسبة: {Math.floor(100 / (settings.earn_rate || 10))} نقطة</li>
                  <li>• قيمة النقاط: {Math.floor(100 / (settings.earn_rate || 10)) * (settings.point_value || 1)} شيكل</li>
                </ul>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">مكافآت النظام:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• التسجيل: {settings.signup_bonus} نقطة</li>
                  <li>• الإحالة: {settings.referral_points} نقطة</li>
                  <li>• التقييم: {settings.review_points} نقطة</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="sticky bottom-0 bg-white p-4 border-t">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-brand text-accent py-3 rounded-lg hover:bg-brand-light transition-colors disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  حفظ الإعدادات
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PointsSettingsAdmin;