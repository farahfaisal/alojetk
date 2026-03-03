// Helper functions to check store hours and working status

export interface StoreHours {
  day: number;
  open: string;
  close: string;
  enabled: boolean;
}

export interface VendorWorkingStatus {
  is_open: boolean;
  reason?: 'vacation' | 'closed_today' | 'outside_hours' | 'suspended';
  today_hours?: {
    open: string;
    close: string;
  } | null;
}

/**
 * Convert working_hours from database to array format
 */
export const convertWorkingHoursToArray = (workingHours: any): StoreHours[] => {
  if (!workingHours) return getDefaultStoreHours();

  const dayMapping: { [key: string]: number } = {
    'sunday': 0,
    'monday': 1,
    'tuesday': 2,
    'wednesday': 3,
    'thursday': 4,
    'friday': 5,
    'saturday': 6
  };

  try {
    return Object.entries(workingHours).map(([dayName, hours]: [string, any]) => {
      // Check if the day is explicitly disabled
      const isExplicitlyDisabled = hours?.enabled === false;

      // Check if hours are valid
      const hasValidHours = hours?.open && hours?.close;

      // Special case: 24/7 operation
      const is24Hours = hours?.open === '00:00' && hours?.close === '00:00';

      return {
        day: dayMapping[dayName.toLowerCase()],
        open: hasValidHours ? hours.open : '',
        close: hasValidHours ? hours.close : '',
        // Day is enabled only if it has valid hours AND is not explicitly disabled
        enabled: !isExplicitlyDisabled && hasValidHours
      };
    }).sort((a, b) => a.day - b.day);
  } catch (error) {
    console.error('Error converting working hours:', error);
    return getDefaultStoreHours();
  }
};

/**
 * Get default store hours (9 AM - 9 PM all days)
 */
export const getDefaultStoreHours = (): StoreHours[] => {
  return [
    { day: 0, open: "09:00", close: "21:00", enabled: true }, // Sunday
    { day: 1, open: "09:00", close: "21:00", enabled: true }, // Monday
    { day: 2, open: "09:00", close: "21:00", enabled: true }, // Tuesday
    { day: 3, open: "09:00", close: "21:00", enabled: true }, // Wednesday
    { day: 4, open: "09:00", close: "21:00", enabled: true }, // Thursday
    { day: 5, open: "14:00", close: "21:00", enabled: true }, // Friday
    { day: 6, open: "09:00", close: "21:00", enabled: true }  // Saturday
  ];
};

/**
 * Check if store is currently open based on time
 */
export const checkIfStoreIsOpen = (storeHours: StoreHours[]): boolean => {
  const now = new Date();
  const currentDay = now.getDay();
  const currentTime = now.getHours() * 60 + now.getMinutes();

  const todayHours = storeHours.find(h => h.day === currentDay);

  if (!todayHours || !todayHours.enabled || !todayHours.open) {
    console.log('❌ المتجر مغلق اليوم:', { day: currentDay, todayHours });
    return false;
  }

  // Special case: 24/7 operation (open is 00:00 and close is missing or 23:59)
  if (todayHours.open === '00:00' && (!todayHours.close || todayHours.close === '23:59')) {
    console.log('✅ المتجر مفتوح 24 ساعة');
    return true;
  }

  if (!todayHours.close) {
    console.log('❌ وقت الإغلاق مفقود');
    return false;
  }

  try {
    const [openHour, openMin] = todayHours.open.split(':').map(Number);
    const [closeHour, closeMin] = todayHours.close.split(':').map(Number);

    const openTime = openHour * 60 + openMin;
    const closeTime = closeHour * 60 + closeMin;

    // Handle case where closing time is after midnight (e.g., 08:00 - 02:00)
    let isOpen;
    if (closeTime < openTime) {
      // Store closes after midnight
      isOpen = currentTime >= openTime || currentTime < closeTime;
    } else {
      // Normal hours within same day
      isOpen = currentTime >= openTime && currentTime < closeTime;
    }

    console.log('🕒 فحص ساعات العمل:', {
      currentDay,
      currentTime: `${now.getHours()}:${now.getMinutes()}`,
      openTime: `${openHour}:${openMin}`,
      closeTime: `${closeHour}:${closeMin}`,
      isOpen
    });

    return isOpen;
  } catch (error) {
    console.error('Error checking store hours:', error);
    return true; // Default to open if there's an error
  }
};

/**
 * Get today's hours
 */
export const getTodayHours = (storeHours: StoreHours[]): StoreHours | null => {
  const now = new Date();
  const currentDay = now.getDay();
  return storeHours.find(h => h.day === currentDay) || null;
};

/**
 * Check complete vendor working status
 */
export const checkVendorWorkingStatus = (vendor: {
  working_hours?: any;
  vacation_mode?: boolean;
  status?: string;
}): VendorWorkingStatus => {
  // Check if vendor is suspended or inactive
  if (vendor.status === 'suspended' || vendor.status === 'inactive') {
    return {
      is_open: false,
      reason: 'suspended'
    };
  }

  // Check if vendor is in vacation mode
  if (vendor.vacation_mode) {
    return {
      is_open: false,
      reason: 'vacation'
    };
  }

  // Get store hours
  const storeHours = convertWorkingHoursToArray(vendor.working_hours);
  const todayHours = getTodayHours(storeHours);

  // Check if closed today
  if (!todayHours || !todayHours.enabled || !todayHours.open || !todayHours.close) {
    return {
      is_open: false,
      reason: 'closed_today',
      today_hours: null
    };
  }

  // Check if within working hours
  const isOpen = checkIfStoreIsOpen(storeHours);

  return {
    is_open: isOpen,
    reason: isOpen ? undefined : 'outside_hours',
    today_hours: {
      open: todayHours.open,
      close: todayHours.close
    }
  };
};

/**
 * Get status text in Arabic
 */
export const getStatusText = (status: VendorWorkingStatus): string => {
  if (status.is_open) {
    return 'مفتوح الآن';
  }

  switch (status.reason) {
    case 'vacation':
      return 'في إجازة';
    case 'closed_today':
      return 'مغلق اليوم';
    case 'outside_hours':
      return 'مغلق حالياً';
    case 'suspended':
      return 'معلق';
    default:
      return 'مغلق';
  }
};

/**
 * Get status badge color classes
 */
export const getStatusBadgeClasses = (status: VendorWorkingStatus): string => {
  if (status.is_open) {
    return 'bg-green-500/90 text-white';
  }

  switch (status.reason) {
    case 'vacation':
      return 'bg-blue-500/90 text-white';
    case 'suspended':
      return 'bg-red-600/90 text-white';
    default:
      return 'bg-red-500/90 text-white';
  }
};

/**
 * Format time string to 12-hour format with Arabic AM/PM
 */
export const formatTime = (time: string, use12Hour: boolean = true): string => {
  if (!time || time.trim() === '') {
    return '--:--';
  }
  try {
    const [hoursStr, minutes] = time.split(':');
    const hours = parseInt(hoursStr, 10);

    if (!use12Hour) {
      return `${hoursStr.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
    }

    // Convert to 12-hour format
    const period = hours >= 12 ? 'مساءً' : 'صباحاً';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;

    return `${displayHours.toString().padStart(2, '0')}:${minutes} ${period}`;
  } catch {
    return time;
  }
};

/**
 * Get day name in Arabic
 */
export const getDayName = (day: number): string => {
  const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  return days[day] || '';
};
