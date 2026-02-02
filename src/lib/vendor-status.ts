/**
 * Vendor status utility functions
 * Handles checking if a vendor is currently open based on working hours and timezone
 */

export interface WorkingHours {
  monday?: { open: string | null; close: string | null; enabled: boolean };
  tuesday?: { open: string | null; close: string | null; enabled: boolean };
  wednesday?: { open: string | null; close: string | null; enabled: boolean };
  thursday?: { open: string | null; close: string | null; enabled: boolean };
  friday?: { open: string | null; close: string | null; enabled: boolean };
  saturday?: { open: string | null; close: string | null; enabled: boolean };
  sunday?: { open: string | null; close: string | null; enabled: boolean };
}

/**
 * Get current time in a specific timezone
 */
const getCurrentTimeInTimezone = (timezone: string) => {
  try {
    const now = new Date();

    console.log('📅 Getting time for timezone:', timezone);
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
    console.log('   Formatted parts:', parts);

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

    return {
      day,
      hours,
      minutes
    };
  } catch (error) {
    console.error('❌ Error getting time in timezone:', timezone, error);
    // Fallback to local time
    const now = new Date();
    return {
      day: now.getDay(),
      hours: now.getHours(),
      minutes: now.getMinutes()
    };
  }
};

/**
 * Get day name from day number
 */
const getDayName = (dayNumber: number): keyof WorkingHours => {
  const days: (keyof WorkingHours)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[dayNumber];
};

/**
 * Check if vendor is currently open based on working hours and timezone
 */
export const isVendorOpen = (
  status: string,
  workingHours: WorkingHours | null | undefined,
  timezone: string = 'Asia/Jerusalem',
  vacationMode: boolean = false
): boolean => {
  // If vendor is not active or in vacation mode, it's closed
  if (status !== 'active' || vacationMode) {
    return false;
  }

  // If no working hours defined, assume closed
  if (!workingHours) {
    return false;
  }

  try {
    const currentTime = getCurrentTimeInTimezone(timezone);
    const currentDay = currentTime.day;
    const currentMinutes = currentTime.hours * 60 + currentTime.minutes;

    const dayName = getDayName(currentDay);
    const todayHours = workingHours[dayName];

    console.log('🔍 Vendor Status Check:', {
      timezone,
      currentTime: `${String(currentTime.hours).padStart(2, '0')}:${String(currentTime.minutes).padStart(2, '0')}`,
      dayName,
      dayNumber: currentDay,
      currentMinutes,
      todayHours,
      status,
      vacationMode
    });

    // If today is disabled or no hours defined, store is closed
    if (!todayHours || !todayHours.enabled || !todayHours.open || !todayHours.close) {
      console.log('❌ Closed: No hours or disabled');
      return false;
    }

    // Parse opening and closing times
    const [openHour, openMin] = todayHours.open.split(':').map(Number);
    const [closeHour, closeMin] = todayHours.close.split(':').map(Number);

    const openTime = openHour * 60 + openMin;
    const closeTime = closeHour * 60 + closeMin;

    // Check if this is an overnight shift (e.g., 22:00 - 09:00)
    const isOvernightShift = closeTime <= openTime;

    console.log('⏰ Time Calculation:', {
      open: todayHours.open,
      close: todayHours.close,
      openTime,
      closeTime,
      currentMinutes,
      isOvernightShift
    });

    let isOpen: boolean;
    if (isOvernightShift) {
      // For overnight shifts: open if time >= openTime OR time < closeTime
      isOpen = currentMinutes >= openTime || currentMinutes < closeTime;
      console.log(`🌙 Overnight shift: ${isOpen ? '✅ OPEN' : '❌ CLOSED'}`);
    } else {
      // For normal shifts: open if time >= openTime AND time < closeTime
      isOpen = currentMinutes >= openTime && currentMinutes < closeTime;
      console.log(`☀️ Normal shift: ${isOpen ? '✅ OPEN' : '❌ CLOSED'}`);
    }

    // Check if current time is within working hours
    return isOpen;
  } catch (error) {
    console.error('Error checking vendor status:', error);
    return false;
  }
};

/**
 * Get vendor status message
 */
export const getVendorStatusMessage = (
  status: string,
  workingHours: WorkingHours | null | undefined,
  timezone: string = 'Asia/Jerusalem',
  vacationMode: boolean = false
): string => {
  if (vacationMode) {
    return 'في إجازة';
  }

  if (status !== 'active') {
    return 'مغلق';
  }

  const isOpen = isVendorOpen(status, workingHours, timezone, vacationMode);
  return isOpen ? 'مفتوح الآن' : 'مغلق حالياً';
};
