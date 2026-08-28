import { useEffect, useState } from 'react';
import { database } from '../database';

export interface LocationRecord {
  location_id: string;
  max_capacity: number;
  standard_tat_hours: number;
  zone: string | null;
  is_parking_line: boolean;
}

export const useLocations = (filters?: { is_parking_line?: boolean, zone?: string }) => {
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const locationsCollection = database.collections.get('locations');
        const locRecords = await locationsCollection.query().fetch();
        
        let parsed = locRecords.map((r: any) => ({
          location_id: r.location_id,
          max_capacity: r.max_capacity,
          standard_tat_hours: r.standard_tat_hours,
          zone: r.zone,
          is_parking_line: r.is_parking_line
        }));

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
        console.warn('Failed to fetch locations from WatermelonDB', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLocations();
  }, [filters?.is_parking_line, filters?.zone]);

  return { locations, loading };
};
