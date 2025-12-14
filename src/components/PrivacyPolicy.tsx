import React from 'react';
import { X, Shield, Lock, Eye, FileText, Server, Check } from 'lucide-react';
import { motion } from 'framer-motion';

interface PrivacyPolicyProps {
  onClose: () => void;
}

const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col overflow-hidden" style={{
      paddingTop: 'max(env(safe-area-inset-top), 0px)'
    }}>
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto">
          <div className="p-4 flex items-center justify-between">
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-gray-700"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="font-medium">رجوع</span>
            </button>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-brand" />
              سياسة الخصوصية
            </h2>
            <div className="w-[80px]"></div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 pb-20">
          <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
            <div className="flex items-center gap-3 mb-4 pb-4 border-b">
              <div className="w-10 h-10 bg-brand/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Lock className="w-5 h-5 text-brand" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-gray-900">مقدمة</h3>
                <p className="text-gray-600 mt-1">
                  نحن في تطبيق "بين إديك" نقدر خصوصيتك ونلتزم بحمايتها. تشرح سياسة الخصوصية هذه كيفية جمعنا واستخدامنا وحمايتنا لمعلوماتك الشخصية عند استخدام تطبيقنا.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 mb-4 pb-4 border-b">
              <div className="w-10 h-10 bg-brand/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Eye className="w-5 h-5 text-brand" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-gray-900">المعلومات التي نجمعها</h3>
                <p className="text-gray-600 mt-1">
                  نجمع المعلومات التالية لتقديم خدماتنا:
                </p>
                <ul className="mt-2 space-y-2">
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">معلومات الحساب: الاسم، رقم الهاتف، البريد الإلكتروني (اختياري)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">معلومات الموقع: لتوفير خدمات التوصيل وتحديد المتاجر القريبة</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">معلومات الطلبات: تفاصيل المنتجات، العناوين، طرق الدفع</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">معلومات الجهاز: نوع الجهاز، إصدار نظام التشغيل، معرف الجهاز</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex items-start gap-3 mb-4 pb-4 border-b">
              <div className="w-10 h-10 bg-brand/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Server className="w-5 h-5 text-brand" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-gray-900">كيفية استخدام المعلومات</h3>
                <p className="text-gray-600 mt-1">
                  نستخدم المعلومات التي نجمعها للأغراض التالية:
                </p>
                <ul className="mt-2 space-y-2">
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">توفير خدمات التوصيل وتتبع الطلبات</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">تحسين تجربة المستخدم وتخصيص المحتوى</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">إرسال إشعارات مهمة حول طلباتك والعروض</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">تحليل استخدام التطبيق لتحسين خدماتنا</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex items-start gap-3 mb-4 pb-4 border-b">
              <div className="w-10 h-10 bg-brand/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-brand" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-gray-900">حماية المعلومات</h3>
                <p className="text-gray-600 mt-1">
                  نحن نتخذ إجراءات أمنية مناسبة لحماية معلوماتك الشخصية من الوصول غير المصرح به أو التعديل أو الإفصاح أو الإتلاف. هذه الإجراءات تشمل:
                </p>
                <ul className="mt-2 space-y-2">
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">تشفير البيانات أثناء النقل باستخدام تقنية SSL</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">تخزين البيانات في بيئة آمنة ومحمية</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">تقييد الوصول إلى المعلومات الشخصية للموظفين المصرح لهم فقط</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex items-start gap-3 mb-4 pb-4 border-b">
              <div className="w-10 h-10 bg-brand/10 rounded-full flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-brand" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-gray-900">مشاركة المعلومات</h3>
                <p className="text-gray-600 mt-1">
                  قد نشارك معلوماتك في الحالات التالية:
                </p>
                <ul className="mt-2 space-y-2">
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">مع المتاجر والسائقين لتسهيل توصيل طلباتك</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">مع مقدمي الخدمات الذين يساعدوننا في تشغيل التطبيق</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">عند الضرورة للامتثال للقانون أو حماية حقوقنا</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-brand/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Lock className="w-5 h-5 text-brand" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-gray-900">حقوقك</h3>
                <p className="text-gray-600 mt-1">
                  لديك الحق في:
                </p>
                <ul className="mt-2 space-y-2">
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">الوصول إلى معلوماتك الشخصية</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">تصحيح معلوماتك غير الدقيقة</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">حذف معلوماتك في ظروف معينة</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">الاعتراض على معالجة معلوماتك</span>
                  </li>
                </ul>
                <p className="text-gray-600 mt-4">
                  للاستفسارات المتعلقة بالخصوصية، يرجى التواصل معنا على: privacy@ben-edek.shop
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
            <h3 className="font-semibold text-lg text-gray-900 mb-3">التغييرات على سياسة الخصوصية</h3>
            <p className="text-gray-600">
              قد نقوم بتحديث سياسة الخصوصية هذه من وقت لآخر. سنخطرك بأي تغييرات جوهرية من خلال نشر إشعار بارز في التطبيق أو عن طريق إرسال إشعار إليك.
            </p>
            <p className="text-gray-600 mt-2">
              تاريخ آخر تحديث: 15 يونيو 2025
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-lg text-gray-900 mb-3">الاتصال بنا</h3>
            <p className="text-gray-600">
              إذا كان لديك أي أسئلة حول سياسة الخصوصية هذه، يرجى التواصل معنا:
            </p>
            <ul className="mt-2 space-y-2">
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700">البريد الإلكتروني: privacy@ben-edek.shop</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700">الهاتف: 0569697080</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700">العنوان: فلسطين</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t p-4 sticky bottom-0">
        <div className="max-w-3xl mx-auto">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClose}
            className="w-full bg-brand text-accent py-3 rounded-lg hover:bg-brand-light transition-colors"
          >
            موافق
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;