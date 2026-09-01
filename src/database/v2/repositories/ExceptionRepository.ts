import { database } from '../index';
import Asset from '../models/Asset';
import Exception from '../models/Exception';
import { uuidv4, prepareSyncOperation } from './utils';

let db = database;

export class ExceptionRepository {
  static setDatabase(testDb: any) {
    db = testDb;
  }

  /**
   * Reports an exception atomically, queuing it for sync.
   */
  static async reportException(params: {
    assetId: string;
    type: string;
    severity: string;
    reason: string;
  }) {
    const clientOperationId = uuidv4();
    const now = new Date();

    await db.write(async () => {
      const asset = await db.collections.get<Asset>('assets').find(params.assetId);

      const exceptionCreate = db.collections.get<Exception>('exceptions').prepareCreate(exc => {
        exc.clientOperationId = clientOperationId;
        exc.assetId = asset.id;
        exc.exceptionType = params.type;
        exc.status = 'OPEN';
        exc.severity = params.severity;
      });

      const assetUpdate = asset.prepareUpdate(a => {
        a.currentStatus = 'EXCEPTION_LOGGED';
      });

      const syncOperation = prepareSyncOperation(db, clientOperationId, 'EXCEPTION_REPORT', {
        client_operation_id: clientOperationId,
        asset_id: asset.serverId || null,
        asset_number: asset.assetNumber,
        local_asset_id: asset.id,
        type: params.type,
        severity: params.severity,
        reason: params.reason,
        offline_timestamp: now.getTime()
      });

      await db.batch(exceptionCreate, assetUpdate, syncOperation);
    });

    return clientOperationId;
  }
}
