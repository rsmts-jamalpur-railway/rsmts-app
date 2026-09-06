import { Q } from '@nozbe/watermelondb';
import { database } from '../index';
import Asset from '../models/Asset';
import MovementLog from '../models/MovementLog';
import { uuidv4, prepareSyncOperation } from './utils';

let db = database;

export class YardRepository {
  static setDatabase(testDb: any) {
    db = testDb;
  }

  constructor(customDb?: any) {
    if (customDb) {
      db = customDb;
    }
  }

  recordArrival(...args: any[]) {
    if (typeof args[0] === 'string') {
      return YardRepository.recordArrival({
        assetNumber: args[0],
        category: args[1] || 'WAGON',
        userId: 'offline-user',
        photoCount: 0,
        assignedLocationId: args[2] || 'YARD'
      });
    }
    return YardRepository.recordArrival(args[0]);
  }

  allocateAsset(...args: any[]) {
    if (typeof args[0] === 'string') {
      return YardRepository.allocateAsset({
        assetNumber: args[0],
        targetLocationId: args[1],
        userId: 'offline-user'
      });
    }
    return YardRepository.allocateAsset(args[0]);
  }

  dispatchAsset(...args: any[]) {
    if (typeof args[0] === 'string') {
      return YardRepository.dispatchAsset({
        assetNumber: args[0],
        destination: args[1],
        userId: 'offline-user'
      });
    }
    return YardRepository.dispatchAsset(args[0]);
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
    fromRailway?: string;
    trackLine?: string;
    remarks?: string;
  }) {
    const clientOperationId = uuidv4();
    const now = new Date();
    const intakeLocation = params.trackLine || params.assignedLocationId || 'YARD';

    await db.write(async () => {
      // Create local asset first (it will not have a server_id yet)
      const assetCreate = db.collections.get<Asset>('assets').prepareCreate(a => {
        a.assetNumber = params.assetNumber.toUpperCase().trim();
        a.assetCategory = params.category;
        a.assetType = params.category;
        a.currentStatus = 'RECEIVED_IN_YARD';
        a.currentLocationId = intakeLocation;
      });

      const movementLogCreate = db.collections.get<MovementLog>('movement_logs').prepareCreate(log => {
        log.clientOperationId = clientOperationId;
        log.assetId = assetCreate.id;
        log.toLocationId = intakeLocation;
        log.newStatus = 'RECEIVED_IN_YARD';

        log.remarks = params.remarks
          ? `${params.remarks} ${params.photoCount > 0 ? `[${params.photoCount}x PHOTO_PROOF_ATTACHED]` : ''}`.trim()
          : `Intake from ${params.fromRailway || 'External'}. ${params.photoCount > 0 ? `[${params.photoCount}x PHOTO_PROOF_ATTACHED]` : ''}`.trim();
      });

      const syncOperation = prepareSyncOperation(db, clientOperationId, 'YARD_INTAKE', {
        client_operation_id: clientOperationId,
        asset_number: params.assetNumber.toUpperCase().trim(),
        category_id: params.category,
        from_railway: params.fromRailway || 'EXTERNAL',
        track_line: params.trackLine || 'NSY',
        remarks: params.remarks || '',
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
    assetId?: string;
    assetNumber?: string;
    shopId?: string;
    targetLocationId?: string;
    userId: string;
  }) {
    const clientOperationId = uuidv4();
    const now = new Date();
    const shop = params.shopId || params.targetLocationId || 'WRS-1';

    await db.write(async () => {
      let asset: Asset;
      if (params.assetId) {
        asset = await db.collections.get<Asset>('assets').find(params.assetId);
      } else if (params.assetNumber) {
        const assets = await db.collections.get<Asset>('assets')
          .query(Q.where('asset_number', params.assetNumber))
          .fetch();
        if (assets.length === 0) throw new Error(`Asset ${params.assetNumber} not found.`);
        asset = assets[0];
      } else {
        throw new Error('Must provide assetId or assetNumber');
      }
      
      const assetUpdate = asset.prepareUpdate(a => {
        a.currentStatus = 'Allocated';
        a.currentLocationId = shop;
      });

      const movementLogCreate = db.collections.get<MovementLog>('movement_logs').prepareCreate(log => {
        log.clientOperationId = clientOperationId;
        log.assetId = asset.id;
        log.fromLocationId = 'YARD';
        log.toLocationId = shop;
        log.previousStatus = asset.currentStatus;
        log.newStatus = 'Allocated';
        log.remarks = `Allocated to ${shop}`;
      });

      const syncOperation = prepareSyncOperation(db, clientOperationId, 'YARD_ALLOCATE', {
        client_operation_id: clientOperationId,
        asset_number: asset.assetNumber,
        asset_id: asset.serverId || null,
        target_location_id: shop,
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
    assetId?: string;
    assetNumber?: string;
    userId: string;
    toRailway?: string;
    destination?: string;
    rakeNumber?: string;
    trainNumber?: string;
    remarks?: string;
  }) {
    const clientOperationId = uuidv4();
    const now = new Date();
    const toRail = params.toRailway || params.destination || 'EXTERNAL_RAILWAY';
    const extraDetails = [
      params.trainNumber ? `Train: ${params.trainNumber}` : '',
      params.rakeNumber ? `Rake: ${params.rakeNumber}` : '',
      params.remarks || ''
    ].filter(Boolean).join(' | ');

    await db.write(async () => {
      let asset: Asset;
      if (params.assetId) {
        asset = await db.collections.get<Asset>('assets').find(params.assetId);
      } else if (params.assetNumber) {
        const assets = await db.collections.get<Asset>('assets')
          .query(Q.where('asset_number', params.assetNumber))
          .fetch();
        if (assets.length === 0) throw new Error(`Asset ${params.assetNumber} not found.`);
        asset = assets[0];
      } else {
        throw new Error('Must provide assetId or assetNumber');
      }
      
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

        log.remarks = `Dispatched out of yard to ${toRail}${extraDetails ? ` (${extraDetails})` : ''}`;
      });

      const syncOperation = prepareSyncOperation(db, clientOperationId, 'YARD_DISPATCH', {
        client_operation_id: clientOperationId,
        asset_number: asset.assetNumber,
        asset_id: asset.serverId || null,
        to_railway: toRail,
        rake_number: params.rakeNumber || null,
        train_number: params.trainNumber || null,
        remarks: params.remarks || '',
        offline_timestamp: now.getTime()
      });

      await db.batch(assetUpdate, movementLogCreate, syncOperation);
    });

    return clientOperationId;
  }
}
