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

    // Use toLocaleString to get time in the specific timezone
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short'
    };

    // Format the date in the target timezone
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(now);

    // Extract values from parts
    const getPartValue = (partType: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === partType)?.value || '';

    const weekdayShort = getPartValue('weekday');
    const hour = parseInt(getPartValue('hour'), 10);
    const minute = parseInt(getPartValue('minute'), 10);
    const year = parseInt(getPartValue('year'), 10);
    const month = parseInt(getPartValue('month'), 10);
    const dayNum = parseInt(getPartValue('day'), 10);

    // Create a date object in the target timezone to get the correct day of week
    const tzDate = new Date(year, month - 1, dayNum);
    const day = tzDate.getDay();

    return {
      day,
      hours: hour,
      minutes: minute
    };
  } catch (error) {
    console.error('Error getting time in timezone:', timezone, error);
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

    // If today is disabled or no hours defined, store is closed
    if (!todayHours || !todayHours.enabled || !todayHours.open || !todayHours.close) {
      return false;
    }

    // Parse opening and closing times
    const [openHour, openMin] = todayHours.open.split(':').map(Number);
    const [closeHour, closeMin] = todayHours.close.split(':').map(Number);

    const openTime = openHour * 60 + openMin;
    const closeTime = closeHour * 60 + closeMin;

    // Check if current time is within working hours
    return currentMinutes >= openTime && currentMinutes < closeTime;
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
