import { supabase } from './supabase';

// Delivery pricing utilities
export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ShippingMethod {
  id: string;
  name: string;
  cost: number;
  min_amount?: number;
  max_amount?: number;
  delivery_type: 'distance' | 'fixed' | 'zones';
  settings?: {
    price_per_km?: number;
    min_distance?: number;
    max_distance?: number;
    free_delivery_min?: number;
    zones?: Array<{
      name: string;
      cost: number;
    }>;
  };
}

// Calculate distance between two points using Haversine formula
export function calculateDistance(point1: Coordinates, point2: Coordinates): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(point2.lat - point1.lat);
  const dLon = toRad(point2.lng - point1.lng);
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(point1.lat)) * Math.cos(toRad(point2.lat)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in kilometers
  
  // Apply a correction factor to account for actual travel distance vs straight line
  // For short distances, the actual travel distance is typically 1.2-1.5x the straight line
  // For longer distances, it's closer to 1.3-1.4x
  const correctionFactor = distance < 1 ? 1.5 : 1.3;
  const correctedDistance = distance * correctionFactor;
  
  return Math.round(correctedDistance * 10) / 10; // Round to 1 decimal place
}

function toRad(degrees: number): number {
  return degrees * (Math.PI/180);
}

// Get shipping methods for a vendor
export async function getShippingMethods(vendorId: string): Promise<ShippingMethod[]> {
  try {
    const { data, error } = await supabase
      .from('shipping_methods')
      .select(`
        *,
        zones:shipping_zones!inner(
          vendor_id
        )
      `)
      .eq('zones.vendor_id', vendorId);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching shipping methods:', error);
    return [];
  }
}

// Calculate delivery fee based on method and distance
export function calculateDeliveryFee(
  method: ShippingMethod,
  distance: number = 3,
  orderTotal?: number,
  zone?: string
): number {
  try {
    // Check for free delivery
    if (orderTotal && method.settings?.free_delivery_min && orderTotal >= method.settings.free_delivery_min) {
      return 0;
    }

    // Ensure we have a minimum delivery fee of 7 shekels
    const minDeliveryFee = 7;

    switch (method.delivery_type) {
      case 'distance':
        if (!method.settings?.price_per_km) {
          return Math.max(minDeliveryFee, method.cost);
        }
        
        // Check distance limits
        if (method.settings.min_distance && distance < method.settings.min_distance) {
          return Math.max(minDeliveryFee, method.cost);
        }
        if (method.settings.max_distance && distance > method.settings.max_distance) {
          return -1; // Out of delivery range
        }
        
        // Calculate fee based on distance with minimum of 7 shekels
        const calculatedFee = Math.ceil(distance * method.settings.price_per_km);
        console.log(`Distance calculation: ${distance} km * ${method.settings.price_per_km} = ${calculatedFee}`);
        return Math.max(minDeliveryFee, calculatedFee);

      case 'fixed':
        return Math.max(minDeliveryFee, method.cost);

      case 'zones':
        if (!zone || !method.settings?.zones) {
          return Math.max(minDeliveryFee, method.cost);
        }
        const zoneConfig = method.settings.zones.find(z => z.name === zone);
        return Math.max(minDeliveryFee, zoneConfig ? zoneConfig.cost : method.cost);

      default:
        return Math.max(minDeliveryFee, method.cost);
    }
  } catch (error) {
    console.error('Error calculating delivery fee:', error);
    return Math.max(7, method.cost || 7);
  }
}

// Get estimated delivery time based on distance and method
export function getEstimatedDeliveryTime(
  method: ShippingMethod,
  distance?: number
): number {
  const baseTime = 20; // Base preparation time in minutes
  const timePerKm = 3; // Minutes per kilometer

  if (method.delivery_type === 'distance' && distance) {
    return Math.ceil(baseTime + (distance * timePerKm));
  }

  return baseTime + 30; // Default 30 minutes for fixed/zone delivery
}