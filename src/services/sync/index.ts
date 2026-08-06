import { synchronize } from '@nozbe/watermelondb/sync';
import { database } from '../../database';
import api from '../api/axios';

function sanitizeAsset(raw: any) {
  return {
    id: raw.id,
    asset_number: raw.asset_number,
    asset_type: raw.asset_type,
    current_status: raw.current_status,
    current_location: raw.current_location || null,
    origin: raw.origin || null,
    allocated_shop: raw.allocated_shop || null,
    repair_category: raw.repair_category || null,
    wagon_sr: raw.wagon_sr || null,
    built_year: raw.built_year || null,
    is_active: Boolean(raw.is_active),
    nsy_in_date: raw.nsy_in_date ? new Date(raw.nsy_in_date).getTime() : null,
    shop_in_date: raw.shop_in_date ? new Date(raw.shop_in_date).getTime() : null,
    fit_date: raw.fit_date ? new Date(raw.fit_date).getTime() : null,
    nsy_out_date: raw.nsy_out_date ? new Date(raw.nsy_out_date).getTime() : null,
    created_at: raw.createdAt ? new Date(raw.createdAt).getTime() : null,
    updated_at: raw.updatedAt ? new Date(raw.updatedAt).getTime() : null,
  };
}

function sanitizeMovementLog(raw: any) {
  return {
    id: raw.log_id || raw.id,
    asset_number: raw.asset_number,
    from_location: raw.from_location || null,
    to_location: raw.to_location,
    previous_status: raw.previous_status || null,
    new_status: raw.new_status,
    handled_by: raw.handled_by,
    remarks: raw.remarks || null,
    repair_cycle_id: raw.repair_cycle_id || null,
    is_offline_entry: Boolean(raw.is_offline_entry),
    timestamp: raw.timestamp ? new Date(raw.timestamp).getTime() : null,
  };
}

export async function syncDatabase() {
  await synchronize({
    database,
    pullChanges: async ({ lastPulledAt }) => {
      console.log(`Pulling changes since ${lastPulledAt || 0}`);
      const response = await api.get('/sync', {
        params: { lastPulledAt: lastPulledAt || 0 },
      });

      const { changes, timestamp } = response.data.data;
      
      return { 
        changes: {
          assets: {
            created: (changes?.assets?.created || []).map(sanitizeAsset),
            updated: (changes?.assets?.updated || []).map(sanitizeAsset),
            deleted: changes?.assets?.deleted || [],
          },
          movement_logs: {
            created: (changes?.movement_logs?.created || []).map(sanitizeMovementLog),
            updated: (changes?.movement_logs?.updated || []).map(sanitizeMovementLog),
            deleted: changes?.movement_logs?.deleted || [],
          }
        }, 
        timestamp 
      };
    },
    pushChanges: async ({ changes, lastPulledAt }) => {
      console.log(`Pushing changes...`);
      await api.post('/sync', {
        changes,
        last_pulled_at: lastPulledAt || 0,
      });
    },
  });
}
