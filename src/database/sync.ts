import { synchronize } from '@nozbe/watermelondb/sync';
import { database } from './index';
import api from '../services/api/axios';

export async function syncDatabase() {
  await synchronize({
    database,
    
    // PULL CHANGES FROM NESTJS BACKEND
    pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
      try {
        const urlParams = lastPulledAt ? `?lastPulledAt=${lastPulledAt}` : '';
        const response = await api.get(`/sync/pull${urlParams}`);
        
        const { changes, timestamp } = response.data;
        
        return { changes, timestamp };
      } catch (error) {
        console.error("Failed to pull changes:", error);
        throw error; // Fail the sync gracefully
      }
    },

    // PUSH LOCAL OFFLINE CHANGES TO NESTJS BACKEND
    pushChanges: async ({ changes, lastPulledAt }) => {
      try {
        await api.post(`/sync/push`, { changes, lastPulledAt });
      } catch (error: any) {
        // Our Axios interceptor will catch 400 Bad Requests (State Machine conflicts)
        // and redirect them into the SyncError queue. 
        // We throw the error here so WatermelonDB knows the push failed 
        // for these specific records and will try again or wait for Admin override.
        console.error("Failed to push changes:", error);
        throw error;
      }
    },
    
    // Disable migrations for now
    migrationsEnabledAtVersion: 1,
  });
}
