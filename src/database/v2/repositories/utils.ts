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
  | 'MANUFACTURING_CLOSE'
  | 'QA_SUBMIT'
  | 'QA_INSPECT'
  | 'EXCEPTION_REPORT'
  | 'YARD_ALLOCATE'
  | 'YARD_CANCEL_INTAKE'
  | 'TEST_500'
  | 'TEST_401'
  | 'TEST_400_STATE'
  | 'TEST_403'
  | 'TEST_409_CAPACITY'
  | 'TEST_409_IDEMPOTENCY'
  | string;

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
  return db.collections.get('sync_operations').prepareCreate((syncOp: any) => {
    syncOp.clientOperationId = clientOperationId;
    syncOp.commandType = commandType;
    syncOp.payload = JSON.stringify(payload);
    syncOp.status = 'PENDING';
    syncOp.attemptCount = 0;
  });
}
