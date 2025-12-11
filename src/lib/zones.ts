import { supabase } from './supabase';

// Service areas types and utilities
export interface ServiceArea {
  id: string;
  name: string;
  city?: string;
  is_active: boolean;
  delivery_price?: number;
  status?: 'active' | 'coming_soon';
  parent_id?: string | null;
}

export const PALESTINIAN_CITIES = [
  'جنين',
  'Jerusalem',
  'Gaza City',
  'Ramallah',
  'Nablus',
  'Hebron',
  'Bethlehem',
  'Tulkarm',
  'Qalqilya',
  'Jericho'
] as const;

export const getServiceAreas = async (): Promise<ServiceArea[]> => {
  try {
    // First priority: Get only main service areas (parent_id is null)
    const { data: serviceAreasData, error: serviceAreasError } = await supabase
      .from('service_areas')
      .select('*')
      .is('parent_id', null)
      .eq('is_active', true)
      .order('name');

    if (!serviceAreasError && serviceAreasData && serviceAreasData.length > 0) {
      console.log('Service areas loaded from service_areas table:', serviceAreasData.length);
      return serviceAreasData.map(area => ({
        ...area,
        status: area.is_active ? 'active' : 'coming_soon'
      }));
    }

    console.log('service_areas table not available, using vendors service_areas');

    // Get vendors with their service areas
    const { data: vendorsData, error: vendorsError } = await supabase
      .from('vendors')
      .select('service_areas')
      .not('service_areas', 'is', null);

    if (vendorsError) {
      console.error('Error querying vendors:', vendorsError);
      throw vendorsError;
    }

    // Collect all unique areas from active vendors
    const activeAreasSet = new Set<string>();
    if (vendorsData) {
      vendorsData.forEach((vendor) => {
        if (vendor.service_areas && Array.isArray(vendor.service_areas)) {
          vendor.service_areas.forEach((area: string) => {
            activeAreasSet.add(area);
          });
        }
      });
    }

    console.log('🔍 Active service areas from DB:', Array.from(activeAreasSet));
    console.log('📋 Total active areas count:', activeAreasSet.size);

    // Get all default areas and mark those without vendors as "coming soon"
    const defaultAreas = getDefaultServiceAreas();
    console.log('📝 Default areas:', defaultAreas.map(a => a.name));

    const serviceAreas: ServiceArea[] = defaultAreas.map((area) => {
      const isActive = activeAreasSet.has(area.name);
      console.log(`🔎 Area "${area.name}": ${isActive ? '✅ Active' : '❌ Not Active'}`);
      return {
        ...area,
        status: isActive ? 'active' : 'coming_soon',
        is_active: isActive
      };
    });

    // Sort: active areas first, then by name
    serviceAreas.sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      return a.name.localeCompare(b.name, 'ar');
    });

    console.log('Service areas loaded with status:', serviceAreas);
    return serviceAreas;
  } catch (err) {
    console.error('Error fetching service areas:', err);
    return getDefaultServiceAreas();
  }
};

// Default service areas to use when database is not available
export const getDefaultServiceAreas = (): ServiceArea[] => {
  return [
    { id: '1', name: 'يطا', status: 'active', is_active: true },
    { id: '2', name: 'الخليل', status: 'active', is_active: true },
    { id: '3', name: 'دورا', status: 'active', is_active: true },
    { id: '4', name: 'جنين', status: 'active', is_active: true },
    { id: '5', name: 'رام الله', status: 'active', is_active: true },
    { id: '6', name: 'نابلس', status: 'active', is_active: true },
    { id: '7', name: 'بيت لحم', status: 'active', is_active: true },
    { id: '8', name: 'طولكرم', status: 'active', is_active: true },
    { id: '9', name: 'قلقيلية', status: 'active', is_active: true },
    { id: '10', name: 'طوباس', status: 'active', is_active: true },
    { id: '11', name: 'سلفيت', status: 'active', is_active: true },
    { id: '12', name: 'أريحا', status: 'active', is_active: true },
    { id: '13', name: 'القدس', status: 'coming_soon', is_active: false },
    { id: '14', name: 'غزة', status: 'coming_soon', is_active: false },
    { id: '15', name: 'خان يونس', status: 'coming_soon', is_active: false },
    { id: '16', name: 'رفح', status: 'coming_soon', is_active: false },
    { id: '17', name: 'دير البلح', status: 'coming_soon', is_active: false }
  ];
};

export const isServiceAreaActive = async (areaId: string) => {
  try {
    const { data, error } = await supabase
      .from('service_areas')
      .select('is_active')
      .eq('id', areaId)
      .single();

    if (error) throw error;
    return data?.is_active === true;
  } catch (err) {
    console.error('Error checking service area status:', err);
    return false;
  }
};

export const getMainServiceAreas = async (): Promise<ServiceArea[]> => {
  try {
    console.log('🔍 Fetching MAIN service areas only (parent_id IS NULL)...');
    const { data, error } = await supabase
      .from('service_areas')
      .select('*')
      .is('parent_id', null)
      .order('name');

    if (error) {
      console.log('⚠️ service_areas table not found, using vendors data');
      // If service_areas table doesn't exist, use getServiceAreas fallback
      return await getServiceAreas();
    }

    if (!data || data.length === 0) {
      console.log('⚠️ No main service areas found, using vendors data');
      return await getServiceAreas();
    }

    // Get vendors to check which areas have stores
    const { data: vendorsData } = await supabase
      .from('vendors')
      .select('service_areas')
      .not('service_areas', 'is', null);

    const activeAreasSet = new Set<string>();
    if (vendorsData) {
      vendorsData.forEach((vendor) => {
        if (vendor.service_areas && Array.isArray(vendor.service_areas)) {
          vendor.service_areas.forEach((area: string) => {
            activeAreasSet.add(area);
          });
        }
      });
    }

    console.log('🔍 getMainServiceAreas - Active areas from DB:', Array.from(activeAreasSet));
    console.log('✅ Main service areas fetched:', data?.length || 0);

    const areas = data.map(area => {
      const isActive = activeAreasSet.has(area.name);
      console.log(`🔎 Main Area "${area.name}": ${isActive ? '✅ Active' : '❌ Not Active'}`);
      return {
        ...area,
        status: isActive ? 'active' : 'coming_soon',
        is_active: isActive
      };
    });

    // Sort: active areas first, then by name
    areas.sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      return a.name.localeCompare(b.name, 'ar');
    });

    return areas;
  } catch (err) {
    console.error('❌ Error fetching main service areas:', err);
    return await getServiceAreas();
  }
};

export const getSubServiceAreas = async (parentId: string): Promise<ServiceArea[]> => {
  try {
    console.log('🔍 Fetching SUB service areas for parent:', parentId);
    const { data, error } = await supabase
      .from('service_areas')
      .select('*')
      .eq('parent_id', parentId)
      .eq('is_active', true)
      .order('name');

    if (error) throw error;

    console.log('✅ Sub service areas fetched:', data?.length || 0, data);
    return (data || []).map(area => ({
      ...area,
      status: area.is_active ? 'active' : 'coming_soon'
    }));
  } catch (err) {
    console.error('❌ Error fetching sub service areas:', err);
    return [];
  }
};