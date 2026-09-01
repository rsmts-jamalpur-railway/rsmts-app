import { database } from '../index';
import ManufacturingOrder from '../models/ManufacturingOrder';
import Asset from '../models/Asset';
import MovementLog from '../models/MovementLog';
import { uuidv4, prepareSyncOperation } from './utils';

let db = database;

export class ManufacturingRepository {
  static setDatabase(testDb: any) {
    db = testDb;
  }
  
  /**
   * Starts a manufacturing order atomically offline, generating an outbox entry.
   * Does NOT block if serverId is missing; offline-first creation is supported.
   */
  static async startOrder(params: {
    assetId: string;
    shopId: string;
    targetAssetType: string;
    userId: string;
  }) {
    const clientOperationId = uuidv4();
    const now = new Date();

    await db.write(async () => {
      const asset = await db.collections.get<Asset>('assets').find(params.assetId);
      
      if (asset.currentStatus === 'IN_MANUFACTURING' || asset.currentStatus === 'DISPATCHED') {
        throw new Error(`Cannot start manufacturing: Asset is currently ${asset.currentStatus}`);
      }

      const assetUpdate = asset.prepareUpdate(a => {
        a.currentStatus = 'IN_MANUFACTURING';
        a.currentLocationId = params.shopId;
      });

      const orderCreate = db.collections.get<ManufacturingOrder>('manufacturing_orders').prepareCreate(order => {
        order.clientOperationId = clientOperationId;
        order.assetId = params.assetId;
        order.manufacturingShopId = params.shopId;
        order.targetAssetType = params.targetAssetType;
        order.orderStatus = 'IN_PROGRESS';
      });

      const movementLogCreate = db.collections.get<MovementLog>('movement_logs').prepareCreate(log => {
        log.clientOperationId = clientOperationId;
        log.assetId = params.assetId;
        log.fromLocationId = asset.currentLocationId;
        log.toLocationId = params.shopId;
        log.previousStatus = asset.currentStatus;
        log.newStatus = 'IN_MANUFACTURING';
        log.manufacturingOrderId = orderCreate.id; 
      });

      const syncOperation = prepareSyncOperation(db, clientOperationId, 'MANUFACTURING_START', {
        client_operation_id: clientOperationId,
        asset_id: asset.serverId || null,
        local_asset_id: asset.id,
        shop_id: params.shopId,
        target_asset_type: params.targetAssetType,
        offline_timestamp: now.getTime()
      });

      await db.batch(assetUpdate, orderCreate, movementLogCreate, syncOperation);
    });

    return clientOperationId;
  }

  /**
   * Completes a manufacturing order.
   */
  static async completeOrder(params: {
    orderId: string;
    finalRemarks?: string;
    userId: string;
  }) {
    const clientOperationId = uuidv4();
    const now = new Date();

    await db.write(async () => {
      const order = await db.collections.get<ManufacturingOrder>('manufacturing_orders').find(params.orderId);
      
      if (order.orderStatus !== 'IN_PROGRESS') {
        throw new Error(`Cannot complete order: Order is currently ${order.orderStatus}`);
      }

      const asset = await db.collections.get<Asset>('assets').find(order.assetId);

      const assetUpdate = asset.prepareUpdate(a => {
        a.currentStatus = 'PENDING_QA';
        // Note: It stays in the same location pending QA
      });

      const orderUpdate = order.prepareUpdate(o => {
        o.orderStatus = 'COMPLETED';
      });

      const movementLogCreate = db.collections.get<MovementLog>('movement_logs').prepareCreate(log => {
        log.clientOperationId = clientOperationId;
        log.assetId = order.assetId;
        log.fromLocationId = asset.currentLocationId;
        log.toLocationId = asset.currentLocationId;
        log.previousStatus = asset.currentStatus;
        log.newStatus = 'PENDING_QA';
        log.manufacturingOrderId = order.id;
        log.remarks = params.finalRemarks || 'Completed via App';
      });

      const syncOperation = prepareSyncOperation(db, clientOperationId, 'MANUFACTURING_CLOSE', {
        client_operation_id: clientOperationId,
        order_id: order.serverId || null,
        local_order_id: order.id,
        final_remarks: params.finalRemarks,
        offline_timestamp: now.getTime()
      });

      await db.batch(assetUpdate, orderUpdate, movementLogCreate, syncOperation);
    });

    return clientOperationId;
  }
}
