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
    const timeString = now.toLocaleString('en-US', { timeZone: timezone });
    const localTime = new Date(timeString);

    return {
      day: localTime.getDay(),
      hours: localTime.getHours(),
      minutes: localTime.getMinutes()
    };
  } catch (error) {
    console.error('Error getting time in timezone:', timezone, error);
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
