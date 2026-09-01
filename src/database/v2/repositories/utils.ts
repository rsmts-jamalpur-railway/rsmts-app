import { database } from '../index';
import SyncOperation from '../models/SyncOperation';
import uuid from 'react-native-uuid';

export function uuidv4(): string {
  return uuid.v4() as string;
}

export type CommandType =
  | 'YARD_INTAKE'
  | 'YARD_DISPATCH'
  | 'REPAIR_START'
  | 'REPAIR_HOLD'
  | 'REPAIR_RESUME'
  | 'REPAIR_CLOSE'
  | 'REPAIR_MISSING'
  | 'REPAIR_REJECT'
  | 'MANUFACTURING_START'
  | 'QA_SUBMIT'
  | 'QA_INSPECT'
  | 'YARD_ALLOCATE'
  | 'YARD_CANCEL_INTAKE';

export type SyncStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'RETRY'
  | 'CONFLICT'
  | 'SYNCED'
  | 'BLOCKED';

/**
 * Helper to prepare a sync_operations outbox record.
 * Must be executed inside a database.write() batch.
 */
export function prepareSyncOperation(
  db: any,
  clientOperationId: string,
  commandType: CommandType,
  payload: object
) {
  return db.collections.get<SyncOperation>('sync_operations').prepareCreate((syncOp: any) => {
    syncOp.clientOperationId = clientOperationId;
    syncOp.commandType = commandType;
    syncOp.payload = JSON.stringify(payload);
    syncOp.status = 'PENDING';
    syncOp.attemptCount = 0;
  });
}
