import React from 'react';
import { X, Phone, Mail, MapPin, Clock, Globe, MessageSquare, ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';

interface ContactPageProps {
  onClose: () => void;
}

const ContactPage: React.FC<ContactPageProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-gray-50 z-[999999] flex flex-col overflow-hidden" style={{
      paddingTop: 'max(env(safe-area-inset-top), 0px)'
    }}>
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto">
          <div className="p-4 flex items-center justify-between">
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-gray-700"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="font-medium">رجوع</span>
            </button>
            <h2 className="text-xl font-bold text-gray-900">اتصل بنا</h2>
            <div className="w-[80px]"></div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto p-4 space-y-6">
          {/* Hero Section */}
          <div className="bg-gradient-to-br from-brand to-brand-light rounded-xl p-6 text-center shadow-lg">
            <h1 className="text-2xl font-bold text-accent mb-2">نحن هنا لمساعدتك</h1>
            <p className="text-accent/80">يسعدنا التواصل معك والإجابة على استفساراتك</p>
          </div>

          {/* Contact Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Phone */}
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="bg-white rounded-xl p-4 shadow-sm flex items-start gap-4"
            >
              <div className="w-12 h-12 bg-brand/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Phone className="w-6 h-6 text-brand" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">اتصل بنا</h3>
                <a href="tel:00972597868159" className="text-accent hover:text-accent-light transition-colors block">
                  00972 59-786-8159
                </a>
              </div>
            </motion.div>

            {/* WhatsApp */}
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="bg-white rounded-xl p-4 shadow-sm flex items-start gap-4"
            >
              <div className="w-12 h-12 bg-brand/10 rounded-full flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-6 h-6 text-brand" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">واتساب</h3>
                <a href="https://wa.me/972597868159" className="text-accent hover:text-accent-light transition-colors block">
                  00972 59-786-8159
                </a>
              </div>
            </motion.div>

            {/* Email */}
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="bg-white rounded-xl p-4 shadow-sm flex items-start gap-4"
            >
              <div className="w-12 h-12 bg-brand/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Mail className="w-6 h-6 text-brand" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">البريد الإلكتروني</h3>
                <a href="mailto:info@ben-edek.shop" className="text-accent hover:text-accent-light transition-colors block">
                  info@ben-edek.shop
                </a>
              </div>
            </motion.div>

            {/* Location */}
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="bg-white rounded-xl p-4 shadow-sm flex items-start gap-4"
            >
              <div className="w-12 h-12 bg-brand/10 rounded-full flex items-center justify-center flex-shrink-0">
                <MapPin className="w-6 h-6 text-brand" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">العنوان</h3>
                <p className="text-gray-600">فلسطين، الضفة الغربية</p>
              </div>
            </motion.div>
          </div>

          {/* Working Hours */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-brand/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-brand" />
              </div>
              <h3 className="font-semibold text-gray-900">ساعات العمل</h3>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">الأحد - الخميس</span>
                <span className="font-medium">9:00 ص - 9:00 م</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">الجمعة</span>
                <span className="font-medium">2:00 م - 9:00 م</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">السبت</span>
                <span className="font-medium">9:00 ص - 9:00 م</span>
              </div>
            </div>
          </div>

          {/* Social Media */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-brand/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Globe className="w-5 h-5 text-brand" />
              </div>
              <h3 className="font-semibold text-gray-900">تواصل معنا</h3>
            </div>
            
            <div className="flex justify-center gap-4">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-pink-600 rounded-full flex items-center justify-center text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-blue-400 rounded-full flex items-center justify-center text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path></svg>
              </a>
            </div>
          </div>

          {/* Contact Form */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">أرسل لنا رسالة</h3>
            
            <form className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  الاسم
                </label>
                <input
                  type="text"
                  id="name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="أدخل اسمك"
                />
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  id="email"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="أدخل بريدك الإلكتروني"
                />
              </div>
              
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                  الرسالة
                </label>
                <textarea
                  id="message"
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand resize-none"
                  placeholder="اكتب رسالتك هنا..."
                ></textarea>
              </div>
              
              <button
                type="submit"
                className="w-full bg-brand text-accent py-3 rounded-lg hover:bg-brand-light transition-colors font-medium"
              >
                إرسال الرسالة
              </button>
            </form>
          </div>

          {/* FAQ Section */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">الأسئلة الشائعة</h3>
            
            <div className="space-y-4">
              <div className="border-b pb-4">
                <h4 className="font-medium text-gray-900 mb-2">ما هي مناطق التوصيل المتاحة؟</h4>
                <p className="text-gray-600">نقدم خدمة التوصيل في جميع مدن الضفة الغربية الرئيسية، بما في ذلك رام الله، نابلس، جنين، الخليل، بيت لحم، وطولكرم.</p>
              </div>
              
              <div className="border-b pb-4">
                <h4 className="font-medium text-gray-900 mb-2">كم تستغرق عملية التوصيل؟</h4>
                <p className="text-gray-600">يعتمد وقت التوصيل على المسافة والطلب، ولكن عادة ما يتراوح بين 30-60 دقيقة.</p>
              </div>
              
              <div className="border-b pb-4">
                <h4 className="font-medium text-gray-900 mb-2">هل يمكنني تتبع طلبي؟</h4>
                <p className="text-gray-600">نعم، يمكنك تتبع طلبك مباشرة من خلال التطبيق بمجرد تأكيد الطلب.</p>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 mb-2">ما هي طرق الدفع المتاحة؟</h4>
                <p className="text-gray-600">حالياً نقبل الدفع النقدي عند الاستلام، وقريباً سنضيف خيارات الدفع الإلكتروني.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;