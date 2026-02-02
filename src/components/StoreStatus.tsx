import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Store, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface StoreHours {
  day: number;
  open: string;
  close: string;
  enabled: boolean;
}

interface StoreStatusProps {
  vendorId: string;
}

const StoreStatus: React.FC<StoreStatusProps> = ({ vendorId }) => {
  const [storeStatus, setStoreStatus] = useState<{
    store_hours: StoreHours[];
    vacation_mode: boolean;
    closed_dates: string[];
    is_open_now: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [vendorTimezone, setVendorTimezone] = useState<string>('Asia/Jerusalem');

  const convertWorkingHoursToArray = (workingHours: any): StoreHours[] => {
    if (!workingHours) return defaultStoreHours;

    const dayMapping: { [key: string]: number } = {
      'sunday': 0,
      'monday': 1,
      'tuesday': 2,
      'wednesday': 3,
      'thursday': 4,
      'friday': 5,
      'saturday': 6
    };

    return Object.entries(workingHours).map(([dayName, hours]: [string, any]) => ({
      day: dayMapping[dayName.toLowerCase()],
      open: hours?.open || null,
      close: hours?.close || null,
      enabled: hours?.enabled === true
    })).sort((a, b) => a.day - b.day);
  };

  const getCurrentTimeInTimezone = (timezone: string) => {
    try {
      const now = new Date();

      console.log('🏪 StoreStatus - Getting time for timezone:', timezone);
      console.log('   Server time:', now.toISOString());

      // Get the time in the target timezone using Intl.DateTimeFormat
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        weekday: 'long',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });

      const parts = formatter.formatToParts(now);

      const getValue = (type: string) => {
        const part = parts.find(p => p.type === type);
        return part ? part.value : '0';
      };

      const weekday = getValue('weekday');
      const hours = parseInt(getValue('hour'), 10);
      const minutes = parseInt(getValue('minute'), 10);

      const dayMap: { [key: string]: number } = {
        'Sunday': 0,
        'Monday': 1,
        'Tuesday': 2,
        'Wednesday': 3,
        'Thursday': 4,
        'Friday': 5,
        'Saturday': 6
      };

      const day = dayMap[weekday] ?? 0;

      console.log(`   ✅ Result: ${weekday} (${day}) at ${hours}:${minutes}`);

      return { day, hours, minutes };
    } catch (error) {
      console.error('❌ Error getting time in timezone:', timezone, error);
      const now = new Date();
      return {
        day: now.getDay(),
        hours: now.getHours(),
        minutes: now.getMinutes()
      };
    }
  };

  const checkIfOpen = (storeHours: StoreHours[], timezone: string): boolean => {
    const currentTime = getCurrentTimeInTimezone(timezone);
    const currentDay = currentTime.day;
    const currentMinutes = currentTime.hours * 60 + currentTime.minutes;

    console.log('🔍 StoreStatus - Checking if open:');
    console.log('   Current day:', currentDay);
    console.log('   Current time:', `${currentTime.hours}:${currentTime.minutes} (${currentMinutes} minutes)`);

    const todayHours = storeHours.find(h => h.day === currentDay);
    console.log('   Today hours:', todayHours);

    if (!todayHours || !todayHours.enabled || !todayHours.open || !todayHours.close) {
      console.log('   ❌ Store closed - no hours configured for today');
      return false;
    }

    const [openHour, openMin] = todayHours.open.split(':').map(Number);
    const [closeHour, closeMin] = todayHours.close.split(':').map(Number);

    const openTime = openHour * 60 + openMin;
    const closeTime = closeHour * 60 + closeMin;

    console.log('   Opening time:', `${openHour}:${openMin} (${openTime} minutes)`);
    console.log('   Closing time:', `${closeHour}:${closeMin} (${closeTime} minutes)`);

    // Check if this is an overnight shift (e.g., 22:00 - 09:00)
    const isOvernightShift = closeTime <= openTime;
    console.log('   Is overnight shift:', isOvernightShift);

    let isOpen: boolean;
    if (isOvernightShift) {
      // For overnight shifts: open if time >= openTime OR time < closeTime
      isOpen = currentMinutes >= openTime || currentMinutes < closeTime;
    } else {
      // For normal shifts: open if time >= openTime AND time < closeTime
      isOpen = currentMinutes >= openTime && currentMinutes < closeTime;
    }

    console.log('   📊 Result:', isOpen ? '✅ OPEN' : '❌ CLOSED');
    return isOpen;
  };

  useEffect(() => {
    const fetchStoreStatus = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: vendorData, error: vendorError } = await supabase
          .from('vendors')
          .select('working_hours, timezone')
          .eq('id', vendorId)
          .maybeSingle();

        if (vendorError) throw vendorError;

        const timezone = vendorData?.timezone || 'Asia/Jerusalem';
        setVendorTimezone(timezone);

        const storeHours = convertWorkingHoursToArray(vendorData?.working_hours);
        const isOpen = checkIfOpen(storeHours, timezone);

        setStoreStatus({
          store_hours: storeHours,
          vacation_mode: false,
          closed_dates: [],
          is_open_now: isOpen
        });

        setLoading(false);
      } catch (err) {
        console.warn('خطأ في جلب حالة المتجر:', err);

        const storeHours = defaultStoreHours;
        setStoreStatus({
          store_hours: storeHours,
          vacation_mode: false,
          closed_dates: [],
          is_open_now: checkIfOpen(storeHours, vendorTimezone)
        });

        setError(err instanceof Error ? err.message : 'حدث خطأ في جلب البيانات');
        setLoading(false);

        if (retryCount < 3) {
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
          }, 2000 * (retryCount + 1));
        }
      }
    };

    fetchStoreStatus();

    const interval = setInterval(fetchStoreStatus, 60000);

    return () => clearInterval(interval);
  }, [vendorId, retryCount]);

  if (loading) {
    return (
      <div className="animate-pulse bg-white rounded-lg shadow-sm p-4">
        <div className="h-6 bg-gray-200 rounded w-3/4 mb-3"></div>
        <div className="space-y-2">
          {[...Array(7)].map((_, index) => (
            <div key={index} className="h-4 bg-gray-200 rounded w-full"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error && !storeStatus) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-5 h-5" />
          <p className="font-medium">خطأ في جلب البيانات</p>
        </div>
        <p className="text-sm">{error}</p>
        {retryCount < 3 && (
          <p className="text-sm mt-2">
            جاري إعادة المحاولة... ({retryCount + 1}/3)
          </p>
        )}
      </div>
    );
  }

  if (!storeStatus) {
    return (
      <div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg flex items-center gap-2 mb-4">
        <Store className="w-5 h-5" />
        <p>لا توجد معلومات عن ساعات العمل</p>
      </div>
    );
  }

  const getDayName = (day: number) => {
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return days[day];
  };

  const formatTime = (time: string) => {
    try {
      const [hours, minutes] = time.split(':');
      return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
    } catch {
      return time;
    }
  };

  const currentDay = getCurrentTimeInTimezone(vendorTimezone).day;
  const todayHours = storeStatus.store_hours.find(hours => hours.day === currentDay);

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      {/* حالة المتجر */}
      <div className="flex items-center gap-3 mb-4">
        <Store className={`w-5 h-5 ${
          storeStatus.is_open_now ? 'text-green-500' : 'text-red-500'
        }`} />
        <div>
          <h3 className="font-semibold text-gray-900">
            {storeStatus.vacation_mode ? 'المتجر في إجازة' : 
             storeStatus.is_open_now ? 'المتجر مفتوح الآن' : 'المتجر مغلق حالياً'}
          </h3>
          {!storeStatus.vacation_mode && todayHours && (
            <p className="text-sm text-gray-600">
              {!todayHours.enabled || !todayHours.open || !todayHours.close ? (
                <span>المتجر مغلق اليوم</span>
              ) : (
                `ساعات العمل اليوم: ${formatTime(todayHours.open)} - ${formatTime(todayHours.close)}`
              )}
            </p>
          )}
        </div>
      </div>

      {/* ساعات العمل */}
      {!storeStatus.vacation_mode && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <Clock className="w-4 h-4 text-brand" />
            <span>ساعات العمل</span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {storeStatus.store_hours.map((hours) => (
              <div
                key={hours.day}
                className={`flex justify-between text-sm ${
                  hours.day === currentDay ? 'text-brand font-medium' : 'text-gray-600'
                }`}
              >
                <span>{getDayName(hours.day)}</span>
                <span>
                  {!hours.enabled || !hours.open || !hours.close ? (
                    <span className="text-red-600">مغلق</span>
                  ) : (
                    `${formatTime(hours.open)} - ${formatTime(hours.close)}`
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* التواريخ المغلقة */}
      {storeStatus.closed_dates && storeStatus.closed_dates.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <Calendar className="w-4 h-4 text-brand" />
            <span>أيام الإغلاق القادمة</span>
          </div>
          <div className="space-y-1">
            {storeStatus.closed_dates.map((date) => (
              <div key={date} className="text-sm text-gray-600">
                {new Date(date).toLocaleDateString('ar-SA')}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ساعات العمل الافتراضية
const defaultStoreHours: StoreHours[] = [
  { day: 0, open: "09:00", close: "21:00", enabled: true }, // الأحد
  { day: 1, open: "09:00", close: "21:00", enabled: true }, // الاثنين
  { day: 2, open: "09:00", close: "21:00", enabled: true }, // الثلاثاء
  { day: 3, open: "09:00", close: "21:00", enabled: true }, // الأربعاء
  { day: 4, open: "09:00", close: "21:00", enabled: true }, // الخميس
  { day: 5, open: "14:00", close: "21:00", enabled: true }, // الجمعة
  { day: 6, open: "09:00", close: "21:00", enabled: true }  // السبت
];

export default StoreStatus;