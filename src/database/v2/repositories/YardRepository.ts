import { database } from '../index';
import Asset from '../models/Asset';
import MovementLog from '../models/MovementLog';
import { uuidv4, prepareSyncOperation } from './utils';

let db = database;

export class YardRepository {
  static setDatabase(testDb: any) {
    db = testDb;
  }
  
  /**
   * Records a new asset arrival at the yard (NSY IN)
   */
  static async recordArrival(params: {
    assetNumber: string;
    category: string;
    userId: string;
    photoCount: number;
    assignedLocationId?: string | null;
  }) {
    const clientOperationId = uuidv4();
    const now = new Date();

    await db.write(async () => {
      // Create local asset first (it will not have a server_id yet)
      const assetCreate = db.collections.get<Asset>('assets').prepareCreate(a => {
        a.assetNumber = params.assetNumber.toUpperCase().trim();
        a.assetCategory = params.category;
        a.assetType = params.category;
        a.currentStatus = 'RECEIVED_IN_YARD';
        a.currentLocationId = params.assignedLocationId || 'YARD';
      });

      const movementLogCreate = db.collections.get<MovementLog>('movement_logs').prepareCreate(log => {
        log.clientOperationId = clientOperationId;
        log.assetId = assetCreate.id;
        log.toLocationId = params.assignedLocationId || 'YARD';
        log.newStatus = 'RECEIVED_IN_YARD';

        log.remarks = `Intake from External. ${params.photoCount > 0 ? `[${params.photoCount}x PHOTO_PROOF_ATTACHED]` : ''}`;
      });

      const syncOperation = prepareSyncOperation(db, clientOperationId, 'YARD_INTAKE', {
        client_operation_id: clientOperationId,
        asset_number: params.assetNumber.toUpperCase().trim(),
        category_id: params.category,
        from_railway: 'EXTERNAL',
        offline_timestamp: now.getTime()
      });

      await db.batch(assetCreate, movementLogCreate, syncOperation);
    });

    return clientOperationId;
  }

  /**
   * Allocates an asset to a specific repair shop
   */
  static async allocateAsset(params: {
    assetId: string;
    shopId: string;
    userId: string;
  }) {
    const clientOperationId = uuidv4();
    const now = new Date();

    await db.write(async () => {
      const asset = await db.collections.get<Asset>('assets').find(params.assetId);
      
      const assetUpdate = asset.prepareUpdate(a => {
        a.currentStatus = 'Allocated'; // Mapping to backend state? Will map to IN_TRANSIT_TO_SHOP on backend
        // Note: WatermelonDB schema for assets doesn't have allocated_shop, it uses currentLocationId?
        // Wait, schema has current_location_id. We should update currentLocationId to the shopId.
        a.currentLocationId = params.shopId;
      });

      const movementLogCreate = db.collections.get<MovementLog>('movement_logs').prepareCreate(log => {
        log.clientOperationId = clientOperationId;
        log.assetId = asset.id;
        log.fromLocationId = 'YARD';
        log.toLocationId = params.shopId;
        log.previousStatus = asset.currentStatus;
        log.newStatus = 'Allocated';
        log.remarks = `Allocated to ${params.shopId}`;
      });

      const syncOperation = prepareSyncOperation(db, clientOperationId, 'YARD_ALLOCATE', {
        client_operation_id: clientOperationId,
        asset_id: asset.serverId || null,
        local_asset_id: asset.id, // Helpful for debugging
        shop_id: params.shopId,
        offline_timestamp: now.getTime()
      });

      await db.batch(assetUpdate, movementLogCreate, syncOperation);
    });

    return clientOperationId;
  }

  /**
   * Re-routes an asset to a different repair shop
   */
  static async reallocateAsset(params: {
    assetId: string;
    newShopId: string;
    userId: string;
  }) {
    // Reallocation is effectively identical to allocation in terms of the sync payload
    return this.allocateAsset({ ...params, shopId: params.newShopId });
  }

  /**
   * Cancels an arrival entry
   */
  static async cancelArrival(params: {
    assetId: string;
    userId: string;
  }) {
    const clientOperationId = uuidv4();
    const now = new Date();

    await db.write(async () => {
      const asset = await db.collections.get<Asset>('assets').find(params.assetId);
      
      const assetUpdate = asset.prepareUpdate(a => {
        a.currentStatus = 'Cancelled Entry';
      });

      const movementLogCreate = db.collections.get<MovementLog>('movement_logs').prepareCreate(log => {
        log.clientOperationId = clientOperationId;
        log.assetId = asset.id;
        log.fromLocationId = 'YARD';
        log.toLocationId = 'YARD';
        log.previousStatus = asset.currentStatus;
        log.newStatus = 'Cancelled Entry';

        log.remarks = 'Entry cancelled by Yard Master due to error.';
      });

      const syncOperation = prepareSyncOperation(db, clientOperationId, 'YARD_CANCEL_INTAKE', {
        client_operation_id: clientOperationId,
        asset_id: asset.serverId || null,
        local_asset_id: asset.id,
        offline_timestamp: now.getTime()
      });

      await db.batch(assetUpdate, movementLogCreate, syncOperation);
    });

    return clientOperationId;
  }

  /**
   * Dispatches a QA Fit asset out of the yard
   */
  static async dispatchAsset(params: {
    assetId: string;
    userId: string;
    toRailway: string;
  }) {
    const clientOperationId = uuidv4();
    const now = new Date();

    await db.write(async () => {
      const asset = await db.collections.get<Asset>('assets').find(params.assetId);
      
      const assetUpdate = asset.prepareUpdate(a => {
        a.currentStatus = 'DISPATCHED';
        a.currentLocationId = 'OUT';
      });

      const movementLogCreate = db.collections.get<MovementLog>('movement_logs').prepareCreate(log => {
        log.clientOperationId = clientOperationId;
        log.assetId = asset.id;
        log.fromLocationId = 'YARD';
        log.toLocationId = 'EXTERNAL_RAILWAY';
        log.previousStatus = asset.currentStatus;
        log.newStatus = 'DISPATCHED';

        log.remarks = `Dispatched out of yard to ${params.toRailway}`;
      });

      const syncOperation = prepareSyncOperation(db, clientOperationId, 'YARD_DISPATCH', {
        client_operation_id: clientOperationId,
        asset_number: asset.assetNumber,
        asset_id: asset.serverId || null,
        to_railway: params.toRailway,
        offline_timestamp: now.getTime()
      });

      await db.batch(assetUpdate, movementLogCreate, syncOperation);
    });

    return clientOperationId;
  }
}
