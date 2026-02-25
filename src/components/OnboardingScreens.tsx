import { useState } from 'react';
import { ChevronLeft, ShoppingBag, Clock, Truck, Gift, Sparkles } from 'lucide-react';

interface OnboardingScreensProps {
  onComplete: () => void;
}

const OnboardingScreens = ({ onComplete }: OnboardingScreensProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showWelcome, setShowWelcome] = useState(false);

  const slides = [
    {
      icon: ShoppingBag,
      title: 'ابحث عن الطعام الذي تحبه',
      description: 'اكتشف أفضل الأطعمة من جميع المطاعم مع توصيل سريع إلى باب منزلك',
      color: 'from-red-50 to-red-100',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-700'
    },
    {
      icon: Clock,
      title: 'توصيل سريع وموثوق',
      description: 'احصل على طلبك في أسرع وقت ممكن مع تتبع مباشر للطلب',
      color: 'from-orange-50 to-orange-100',
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-700'
    },
    {
      icon: Truck,
      title: 'تتبع طلبك لحظة بلحظة',
      description: 'راقب طلبك من المطعم حتى باب منزلك مع التحديثات الفورية',
      color: 'from-amber-50 to-amber-100',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-700'
    },
    {
      icon: Gift,
      title: 'عروض وخصومات حصرية',
      description: 'استمتع بالعروض اليومية والخصومات الخاصة على مطاعمك المفضلة',
      color: 'from-red-50 to-red-100',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-700'
    }
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      setShowWelcome(true);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    onComplete();
  };

  const currentSlideData = slides[currentSlide];
  const Icon = currentSlideData.icon;

  // Welcome Screen
  if (showWelcome) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-red-50 via-white to-orange-50 z-50 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          {/* Logo Container */}
          <div className="relative mb-8">
            <div className="w-40 h-40 bg-white rounded-3xl shadow-2xl flex items-center justify-center overflow-hidden">
              <img
                src="/icons/app-icon.jpg"
                alt="الو جيتك"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full animate-bounce"></div>
            <div className="absolute -bottom-2 -left-2 w-6 h-6 bg-orange-400 rounded-full animate-pulse"></div>
          </div>

          {/* Welcome Text */}
          <h1 className="text-4xl font-bold text-gray-900 mb-4 text-center">
            مرحباً بك في الو جيتك
          </h1>
          <p className="text-gray-600 text-lg text-center max-w-sm mb-12 leading-relaxed">
            أفضل المطاعم من الو جيتك - توصيلاً سريعاً لآلاف المأكولات من جميع المتاجر المحلية
          </p>

          {/* Action Buttons */}
          <div className="w-full max-w-sm space-y-4">
            <button
              onClick={() => {
                localStorage.setItem('hasSeenOnboarding', 'true');
                onComplete();
              }}
              className="w-full bg-gradient-to-r from-red-700 to-red-800 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all"
            >
              تسجيل الدخول
            </button>
            <button
              onClick={() => {
                localStorage.setItem('hasSeenOnboarding', 'true');
                onComplete();
              }}
              className="w-full bg-white border-2 border-red-700 text-red-700 py-4 rounded-xl font-bold text-lg hover:bg-red-50 transition-all"
            >
              إنشاء حساب جديد
            </button>
          </div>
        </div>

        {/* Footer Note */}
        <div className="px-6 pb-8 text-center">
          <p className="text-gray-500 text-sm">
            بالمتابعة، أنت توافق على شروط الاستخدام وسياسة الخصوصية
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Skip Button */}
      <div className="absolute top-6 left-6 z-10">
        <button
          onClick={handleSkip}
          className="text-gray-500 hover:text-gray-700 font-medium text-sm"
        >
          تخطي
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-24">
        {/* Illustration Container */}
        <div className="relative w-80 h-80 mb-12">
          {/* Background Decorative Circles */}
          <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${currentSlideData.color} opacity-20 animate-pulse`}></div>
          <div className={`absolute inset-8 rounded-full bg-gradient-to-br ${currentSlideData.color} opacity-30`}></div>

          {/* Main Icon Circle */}
          <div className={`absolute inset-16 rounded-full ${currentSlideData.iconBg} shadow-2xl flex items-center justify-center`}>
            <Icon className={`w-28 h-28 ${currentSlideData.iconColor}`} strokeWidth={1.5} />
          </div>

          {/* Decorative Elements */}
          <div className="absolute top-8 right-8 w-12 h-12 bg-red-200 rounded-full opacity-50"></div>
          <div className="absolute bottom-12 left-8 w-8 h-8 bg-red-300 rounded-full opacity-40"></div>
          <div className="absolute top-1/2 right-4 w-6 h-6 bg-red-400 rounded-full opacity-30"></div>
        </div>

        {/* Text Content */}
        <div className="text-center max-w-sm">
          <h2 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">
            {currentSlideData.title}
          </h2>
          <p className="text-gray-600 text-lg leading-relaxed">
            {currentSlideData.description}
          </p>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="px-6 pb-8">
        {/* Dots Indicator */}
        <div className="flex justify-center gap-2 mb-6">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`transition-all duration-300 rounded-full ${
                index === currentSlide
                  ? 'w-8 h-2 bg-red-700'
                  : 'w-2 h-2 bg-gray-300'
              }`}
            />
          ))}
        </div>

        {/* Next Button */}
        <button
          onClick={handleNext}
          className="w-full bg-gradient-to-r from-red-700 to-red-800 text-white py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
        >
          {currentSlide === slides.length - 1 ? 'التالي' : 'التالي'}
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default OnboardingScreens;
