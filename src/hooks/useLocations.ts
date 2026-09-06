import { useEffect, useState } from 'react';
import { database } from '../database';

export interface LocationRecord {
  location_id: string;
  max_capacity: number;
  standard_tat_hours: number;
  zone: string | null;
  is_parking_line: boolean;
  location_type?: string;
}

const DEFAULT_JAMALPUR_LOCATIONS: LocationRecord[] = [
  { location_id: 'WRS-1', max_capacity: 50, standard_tat_hours: 120, zone: 'Repair Shops', is_parking_line: false, location_type: 'REPAIR_SHOP' },
  { location_id: 'WRS-2', max_capacity: 50, standard_tat_hours: 120, zone: 'Repair Shops', is_parking_line: false, location_type: 'REPAIR_SHOP' },
  { location_id: 'WRS-3', max_capacity: 50, standard_tat_hours: 120, zone: 'Repair Shops', is_parking_line: false, location_type: 'REPAIR_SHOP' },
  { location_id: 'WRS-4', max_capacity: 50, standard_tat_hours: 120, zone: 'Repair Shops', is_parking_line: false, location_type: 'REPAIR_SHOP' },
  { location_id: 'DPS', max_capacity: 25, standard_tat_hours: 72, zone: 'Locomotive Shed', is_parking_line: false, location_type: 'LOCO_SHED' },
  { location_id: 'GIF', max_capacity: 100, standard_tat_hours: 96, zone: 'Manufacturing Shops', is_parking_line: false, location_type: 'MFG_SHOP' },
  { location_id: 'CRANE', max_capacity: 15, standard_tat_hours: 96, zone: 'Manufacturing Shops', is_parking_line: false, location_type: 'CRANE_SHOP' },
  { location_id: 'WRS-5', max_capacity: 20, standard_tat_hours: 24, zone: 'Quality Assurance', is_parking_line: false, location_type: 'QA_SHOP' },
  { location_id: 'NSY', max_capacity: 500, standard_tat_hours: 48, zone: 'Primary Yards', is_parking_line: false, location_type: 'YARD' },
  { location_id: 'Exit Yard', max_capacity: 100, standard_tat_hours: 24, zone: 'Primary Yards', is_parking_line: false, location_type: 'YARD' },
  { location_id: 'Trial Yard', max_capacity: 30, standard_tat_hours: 24, zone: 'Primary Yards', is_parking_line: false, location_type: 'YARD' },
  { location_id: 'Tower Car Line', max_capacity: 15, standard_tat_hours: 48, zone: 'Specialty Lines', is_parking_line: true, location_type: 'YARD_LINE' },
];

export const useLocations = (filters?: { is_parking_line?: boolean, zone?: string }) => {
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const locationsCollection = database.collections.get('locations');
        const locRecords = await locationsCollection.query().fetch();
        
        let parsed: LocationRecord[] = locRecords.map((r: any) => ({
          location_id: r.locationId || r.location_id || r.id,
          max_capacity: r.maxCapacity ?? r.max_capacity ?? 50,
          standard_tat_hours: r.standardTatHours ?? r.standard_tat_hours ?? 120,
          zone: r.zone || null,
          is_parking_line: r.locationType === 'YARD_LINE' || r.is_parking_line || false,
          location_type: r.locationType || r.location_type || 'SHOP',
        }));

        if (parsed.length === 0) {
          parsed = DEFAULT_JAMALPUR_LOCATIONS;
        }

        if (filters) {
          if (filters.is_parking_line !== undefined) {
            parsed = parsed.filter(l => l.is_parking_line === filters.is_parking_line);
          }
          if (filters.zone !== undefined) {
            parsed = parsed.filter(l => l.zone === filters.zone);
          }
        }

        setLocations(parsed);
      } catch (err) {
        console.warn('Failed to fetch locations from WatermelonDB, using defaults', err);
        setLocations(DEFAULT_JAMALPUR_LOCATIONS);
      } finally {
        setLoading(false);
      }
    };
    fetchLocations();
  }, [filters?.is_parking_line, filters?.zone]);

  return { locations, loading };
};
