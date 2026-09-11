import { synchronize } from '@nozbe/watermelondb/sync';
import { database } from './index';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SyncOperation from './models/SyncOperation';
import { Q } from '@nozbe/watermelondb';
import { API_BASE_URL } from '../../config';

const BASE_URL = API_BASE_URL;
const SYNC_CURSOR_KEY = '@rsmts_sync_cursor';

export class SyncEngine {
  private static isSyncing = false;

  static async sync() {
    if (this.isSyncing) {
      console.log('Sync already in progress. Skipping.');
      return;
    }
    this.isSyncing = true;

    try {
      const token = await AsyncStorage.getItem('@Auth:token');
      if (!token) throw new Error('Cannot sync: No authentication token.');

      // ======================================================================
      // PHASE 1: PROCESS OUTBOX (MANUAL PUSH)
      // ======================================================================
      await this.processOutbox(token);

      // ======================================================================
      // PHASE 2: NATIVE SYNC (PULL)
      // ======================================================================
      await synchronize({
        database,
        
        pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
          const storedCursor = await AsyncStorage.getItem(SYNC_CURSOR_KEY);
          const cursor = storedCursor || '0';

          const response = await fetch(`${BASE_URL}/sync/pull?last_revision=${cursor}&limit=500`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            throw new Error(`Pull failed: ${response.statusText}`);
          }

          const jsonResponse = await response.json();
          const { changes, next_revision, has_more } = jsonResponse.data || jsonResponse;

          // INTERCEPTION LOGIC: Map Server UUIDs to Local WatermelonDB IDs
          
          for (const tableName of Object.keys(changes)) {
            const tableChanges = changes[tableName];
            
            try {
              // 1. Process CREATED (map via client_operation_id)
              const clientOpIds = tableChanges.created.map((r: any) => r.client_operation_id).filter(Boolean);
              const localRecordsByOp = clientOpIds.length > 0 
                ? await database.collections.get(tableName).query(
                    Q.where('client_operation_id', Q.oneOf(clientOpIds))
                  ).fetch()
                : [];

              const opIdToLocalId = new Map();
              for (const l of localRecordsByOp as any[]) {
                if (l.clientOperationId) {
                  opIdToLocalId.set(l.clientOperationId, l.id);
                }
              }

              const newCreated = [];
              for (const record of tableChanges.created) {
                const localId = opIdToLocalId.get(record.client_operation_id);
                record.server_id = record.id; // Always preserve backend UUID in server_id
                
                if (localId) {
                  record.id = localId; 
                  tableChanges.updated.push(record);
                } else {
                  newCreated.push(record);
                }
              }
              tableChanges.created = newCreated;
              
              // 2. Process UPDATED (map via server_id)
              const serverIds = tableChanges.updated.map((r: any) => r.server_id); 
              const localRecordsByServerId = serverIds.length > 0
                ? await database.collections.get(tableName).query(
                    Q.where('server_id', Q.oneOf(serverIds))
                  ).fetch()
                : [];
                
              const serverIdToLocalId = new Map();
              for (const l of localRecordsByServerId as any[]) {
                if (l.serverId) {
                  serverIdToLocalId.set(l.serverId, l.id);
                }
              }
              
              for (const record of tableChanges.updated) {
                if (!record.server_id) record.server_id = record.id;
                
                const localId = serverIdToLocalId.get(record.server_id);
                if (localId) {
                  record.id = localId;
                }
              }
              
            } catch (e) {
              console.warn(`Interception mapping failed for ${tableName}, skipping.`, e);
            }
          }

          (SyncEngine as any)._nextRevision = next_revision;
          return { changes, timestamp: Date.now() }; 
        },

        pushChanges: async ({ changes, lastPulledAt }) => {
          // No-op: Business operations are strictly handled by outbox.
        },

        migrationsEnabledAtVersion: 6,
      });
      
      if ((SyncEngine as any)._nextRevision) {
        await AsyncStorage.setItem(SYNC_CURSOR_KEY, (SyncEngine as any)._nextRevision.toString());
      }
      
    } catch (error: any) {
      console.error('Sync failed:', error);
      if (error?.message?.includes('401') || error?.status === 401) {
        console.warn('Authentication failed. Queue paused until re-auth.');
      }
      throw error;
    } finally {
      this.isSyncing = false;
      (SyncEngine as any)._nextRevision = null;
    }
  }

  /**
   * Processes the outbox manually in dependency-safe ordered batches.
   */
  private static async processOutbox(token: string) {
    const now = Date.now();
    
    const pendingOps = await database.collections.get<SyncOperation>('sync_operations').query(
      Q.where('status', Q.oneOf(['PENDING', 'RETRY'])),
      Q.sortBy('created_at', Q.asc)
    ).fetch();

    const eligibleOps = pendingOps.filter(op => !op.nextRetryAt || op.nextRetryAt.getTime() <= now);

    if (eligibleOps.length === 0) return;

    const BATCH_SIZE = 20;
    const batch = eligibleOps.slice(0, BATCH_SIZE);

    const operationsPayload = batch.map(op => ({
      ...JSON.parse(op.payload || '{}'),
      client_operation_id: op.clientOperationId,
      command_type: op.commandType
    }));

    const changes = {
      sync_operations: {
        created: operationsPayload,
        updated: [],
        deleted: []
      }
    };

    const response = await fetch(`${BASE_URL}/sync/push`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ changes })
    });

    if (response.status === 401) {
      throw new Error('401 Unauthorized');
    }

    if (!response.ok) {
      await this.handleBatchError(batch, 'INTERNAL_SERVER_ERROR');
      return;
    }

    const { results, errors } = await response.json();
    await this.reconcileOutboxResults(batch, results || [], errors || []);
  }

  private static async reconcileOutboxResults(batch: SyncOperation[], results: any[], errors: any[]) {
    await database.write(async () => {
      const updates = [];

      for (const op of batch) {
        const success = results.find(r => r.client_operation_id === op.clientOperationId);
        const err = errors.find(e => e.client_operation_id === op.clientOperationId);

        if (success) {
          updates.push(op.prepareUpdate(o => {
            o.status = 'SYNCED';
            o.serverResponse = JSON.stringify(success);
          }));

          if (success.server_id && success.entity) {
            const tableMap: Record<string, string> = {
              'REPAIR_CYCLE': 'repair_cycles',
              'ASSET': 'assets',
              'MOVEMENT_LOG': 'movement_logs',
              'MANUFACTURING_CYCLE': 'manufacturing_orders',
              'QA_INSPECTION': 'qa_inspections',
              'EXCEPTION': 'exceptions'
            };
            
            const tableName = tableMap[success.entity];
            if (tableName) {
              const localRecords = await database.collections.get(tableName).query(
                Q.where('client_operation_id', op.clientOperationId)
              ).fetch();
              if (localRecords.length > 0) {
                // If it's a QA Inspection, success.inspection_id takes precedence, otherwise server_id
                const authoritativeId = (success.entity === 'QA_INSPECTION' && success.inspection_id) ? success.inspection_id : success.server_id;
                updates.push(localRecords[0].prepareUpdate((r: any) => {
                  r.serverId = authoritativeId;
                }));
              }
            }

            // Cross-entity reconciliation: Asset ID might be generated during Manufacturing Start or reconciled during QA
            if (success.asset_id) {
              try {
                const payload = JSON.parse(op.payload || '{}');
                const localAssetId = payload.local_asset_id || payload.asset_id; // Check both depending on the dto
                
                if (localAssetId) {
                  // The outbox payload explicitly references a local asset ID
                  const asset = await database.collections.get('assets').find(localAssetId);
                  if (asset) {
                    updates.push(asset.prepareUpdate((r: any) => {
                      r.serverId = success.asset_id;
                    }));
                  }
                } else if (success.entity === 'MANUFACTURING_CYCLE') {
                   // For MANUFACTURING_START, the payload has asset_number, we can find the offline asset by asset_number
                   const assets = await database.collections.get('assets').query(
                     Q.where('asset_number', payload.asset_number),
                     Q.where('server_id', null) // Only update if it doesn't already have one
                   ).fetch();
                   if (assets.length > 0) {
                     updates.push(assets[0].prepareUpdate((r: any) => {
                       r.serverId = success.asset_id;
                     }));
                   }
                }
              } catch (e) {
                console.warn('Cross-entity reconciliation failed for asset_id', e);
              }
            }
          }
        } else if (err) {
          updates.push(op.prepareUpdate(o => {
            if (['INVALID_STATE_TRANSITION', 'VALIDATION_ERROR', 'OPEN_EXCEPTION_BLOCKING', 'QA_CONTEXT_INVALID', 'FORBIDDEN_SCOPE', 'RESOURCE_NOT_FOUND', 'CAPACITY_EXCEEDED'].includes(err.code)) {
              o.status = 'CONFLICT';
            } else {
              o.status = 'RETRY';
              o.attemptCount = (o.attemptCount || 0) + 1;
              const backoffMs = Math.min(Math.pow(2, o.attemptCount) * 1000, 300000);
              o.nextRetryAt = new Date(Date.now() + backoffMs);
            }
            o.errorCode = err.code;
            o.serverResponse = JSON.stringify(err);
          }));
        }
      }

      if (updates.length > 0) {
        await database.batch(...updates);
      }
    });
  }

  private static async handleBatchError(batch: SyncOperation[], code: string) {
    await database.write(async () => {
      const updates = batch.map(op => op.prepareUpdate(o => {
        o.status = 'RETRY';
        o.attemptCount = (o.attemptCount || 0) + 1;
        const backoffMs = Math.min(Math.pow(2, o.attemptCount) * 1000, 300000); 
        o.nextRetryAt = new Date(Date.now() + backoffMs);
        o.errorCode = code;
      }));
      await database.batch(...updates);
    });
  }
}
