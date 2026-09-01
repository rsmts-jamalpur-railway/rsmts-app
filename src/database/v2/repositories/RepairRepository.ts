import { database } from '../index';
import RepairCycle from '../models/RepairCycle';
import Asset from '../models/Asset';
import MovementLog from '../models/MovementLog';
import RepairHold from '../models/RepairHold';
import { uuidv4, prepareSyncOperation } from './utils';

let db = database;

export class RepairRepository {
  static setDatabase(testDb: any) {
    db = testDb;
  }
  
  /**
   * Starts a repair cycle atomically offline, generating an outbox entry.
   */
  static async startRepair(params: {
    assetId: string;
    shopId: string;
    repairCategoryId: string;
    userId: string;
  }) {
    const clientOperationId = uuidv4();
    const now = new Date();

    await database.write(async () => {
      const asset = await database.collections.get<Asset>('assets').find(params.assetId);
      
      if (!asset.serverId) {
        throw new Error('Cannot start repair: Asset has not yet been synchronized with the server.');
      }
      const assetServerId = asset.serverId; // Cache to preserve TS narrowing

      if (asset.currentStatus === 'IN_REPAIR' || asset.currentStatus === 'DISPATCHED') {
        throw new Error(`Cannot start repair: Asset is currently ${asset.currentStatus}`);
      }

      const assetUpdate = asset.prepareUpdate(a => {
        a.currentStatus = 'IN_REPAIR';
        a.currentLocationId = params.shopId;
      });

      const repairCycleCreate = db.collections.get<RepairCycle>('repair_cycles').prepareCreate(cycle => {
        cycle.clientOperationId = clientOperationId;
        cycle.assetId = params.assetId;
        cycle.repairShopId = params.shopId;
        cycle.repairCategoryId = params.repairCategoryId;
        cycle.status = 'IN_PROGRESS';
        cycle.startedAt = now;
      });

      const movementLogCreate = db.collections.get<MovementLog>('movement_logs').prepareCreate(log => {
        log.clientOperationId = clientOperationId;
        log.assetId = params.assetId;
        log.fromLocationId = asset.currentLocationId;
        log.toLocationId = params.shopId;
        log.previousStatus = asset.currentStatus;
        log.newStatus = 'IN_REPAIR';
        log.repairCycleId = repairCycleCreate.id; 

      });

      const syncOperation = prepareSyncOperation(db, clientOperationId, 'REPAIR_START', {
        client_operation_id: clientOperationId,
        asset_id: assetServerId,
        shop_id: params.shopId,
        repair_category_id: params.repairCategoryId,
        offline_timestamp: now.getTime()
      });

      await database.batch(assetUpdate, repairCycleCreate, movementLogCreate, syncOperation);
    });

    return clientOperationId;
  }

  /**
   * Places a repair cycle on hold.
   */
  static async holdRepair(params: {
    repairCycleId: string;
    reason: string;
    userId: string;
  }) {
    const clientOperationId = uuidv4();
    const now = new Date();

    await database.write(async () => {
      const cycle = await database.collections.get<RepairCycle>('repair_cycles').find(params.repairCycleId);
      
      if (!cycle.serverId) {
        throw new Error('Cannot hold repair: Repair cycle has not yet been synchronized with the server.');
      }
      const cycleServerId = cycle.serverId; // Cache to preserve TS narrowing

      if (cycle.status !== 'IN_PROGRESS') {
        throw new Error(`Cannot hold repair: Cycle is currently ${cycle.status}, must be IN_PROGRESS.`);
      }

      const asset = await database.collections.get<Asset>('assets').find(cycle.assetId);

      const assetUpdate = asset.prepareUpdate(a => {
        a.currentStatus = 'REPAIR_ON_HOLD';
      });

      const cycleUpdate = cycle.prepareUpdate(c => {
        c.status = 'ON_HOLD';
      });

      const holdCreate = database.collections.get<RepairHold>('repair_holds').prepareCreate(hold => {
        hold.clientOperationId = clientOperationId;
        hold.repairCycleId = cycle.id;
        hold.holdReason = params.reason;
        hold.holdStart = now;
      });

      const movementLogCreate = database.collections.get<MovementLog>('movement_logs').prepareCreate(log => {
        log.clientOperationId = clientOperationId;
        log.assetId = asset.id;
        log.fromLocationId = asset.currentLocationId;
        log.toLocationId = asset.currentLocationId;
        log.previousStatus = asset.currentStatus;
        log.newStatus = 'REPAIR_ON_HOLD';
        log.repairCycleId = cycle.id;
        log.remarks = `Repair placed on hold. Reason: ${params.reason}`;
      });

      const syncOperation = prepareSyncOperation(db, clientOperationId, 'REPAIR_HOLD', {
        client_operation_id: clientOperationId,
        cycle_id: cycleServerId, 
        reason: params.reason,
        offline_timestamp: now.getTime()
      });

      await database.batch(assetUpdate, cycleUpdate, holdCreate, movementLogCreate, syncOperation);
    });

    return clientOperationId;
  }

  /**
   * Resumes a repair cycle.
   */
  static async resumeRepair(params: {
    repairCycleId: string;
    userId: string;
  }) {
    const clientOperationId = uuidv4();
    const now = new Date();

    await database.write(async () => {
      const cycle = await database.collections.get<RepairCycle>('repair_cycles').find(params.repairCycleId);
      
      if (!cycle.serverId) throw new Error('Cannot resume repair: Repair cycle not synced.');
      const cycleServerId = cycle.serverId;

      if (cycle.status !== 'ON_HOLD') throw new Error(`Cannot resume repair: Cycle is currently ${cycle.status}`);

      const asset = await database.collections.get<Asset>('assets').find(cycle.assetId);
      const activeHold = (await cycle.repairHolds.fetch()).find((h: RepairHold) => !h.holdEnd);

      const assetUpdate = asset.prepareUpdate(a => {
        a.currentStatus = 'IN_REPAIR';
      });

      const cycleUpdate = cycle.prepareUpdate(c => {
        c.status = 'IN_PROGRESS';
      });
      
      const movementLogCreate = database.collections.get<MovementLog>('movement_logs').prepareCreate(log => {
        log.clientOperationId = clientOperationId;
        log.assetId = asset.id;
        log.fromLocationId = asset.currentLocationId;
        log.toLocationId = asset.currentLocationId;
        log.previousStatus = asset.currentStatus;
        log.newStatus = 'IN_REPAIR';
        log.repairCycleId = cycle.id;
        log.remarks = `Repair resumed from hold.`;
      });
      
      const batches: any[] = [assetUpdate, cycleUpdate, movementLogCreate];
      
      if (activeHold) {
        batches.push(activeHold.prepareUpdate((h: RepairHold) => {
          h.holdEnd = now;
        }));
      }

      const syncOperation = prepareSyncOperation(db, clientOperationId, 'REPAIR_RESUME', {
        client_operation_id: clientOperationId,
        cycle_id: cycleServerId, 
        offline_timestamp: now.getTime()
      });

      batches.push(syncOperation);
      await database.batch(...batches);
    });

    return clientOperationId;
  }

  /**
   * Closes a repair cycle.
   */
  static async closeRepair(params: {
    repairCycleId: string;
    finalRemarks?: string;
    userId: string;
  }) {
    const clientOperationId = uuidv4();
    const now = new Date();

    await db.write(async () => {
      const cycle = await db.collections.get<RepairCycle>('repair_cycles').find(params.repairCycleId);
      
      if (!cycle.serverId) throw new Error('Cannot close repair: Repair cycle not synced.');
      const cycleServerId = cycle.serverId;

      if (cycle.status !== 'IN_PROGRESS') throw new Error(`Cannot close repair: Cycle is currently ${cycle.status}`);

      const asset = await db.collections.get<Asset>('assets').find(cycle.assetId);

      const assetUpdate = asset.prepareUpdate(a => {
        a.currentStatus = 'PENDING_QA';
      });

      const cycleUpdate = cycle.prepareUpdate(c => {
        c.status = 'COMPLETED';
        c.completedAt = now;
      });

      const movementLogCreate = db.collections.get<MovementLog>('movement_logs').prepareCreate(log => {
        log.clientOperationId = clientOperationId;
        log.assetId = cycle.assetId;
        log.fromLocationId = asset.currentLocationId;
        log.toLocationId = 'YARD';
        log.previousStatus = asset.currentStatus;
        log.newStatus = 'PENDING_QA';
        log.repairCycleId = cycle.id;

      });

      const syncOperation = prepareSyncOperation(db, clientOperationId, 'REPAIR_CLOSE', {
        client_operation_id: clientOperationId,
        cycle_id: cycleServerId, 
        final_remarks: params.finalRemarks,
        offline_timestamp: now.getTime()
      });

      await db.batch(assetUpdate, cycleUpdate, movementLogCreate, syncOperation);
    });

    return clientOperationId;
  }

  static async reportMissing(params: {
    assetId: string;
    userId: string;
  }) {
    const clientOperationId = uuidv4();
    const now = new Date();
    await db.write(async () => {
      const asset = await db.collections.get<Asset>('assets').find(params.assetId);
      const assetUpdate = asset.prepareUpdate(a => { a.currentStatus = 'Missing'; });
      const movementLogCreate = db.collections.get<MovementLog>('movement_logs').prepareCreate(log => {
        log.clientOperationId = clientOperationId;
        log.assetId = asset.id;
        log.fromLocationId = asset.currentLocationId || 'Unknown';
        log.toLocationId = 'Missing';
        log.previousStatus = asset.currentStatus;
        log.newStatus = 'Missing';
        log.remarks = 'Asset reported missing from allocated shop.';
      });
      const syncOperation = prepareSyncOperation(db, clientOperationId, 'REPAIR_MISSING', {
        client_operation_id: clientOperationId,
        asset_id: asset.serverId || null,
        local_asset_id: asset.id,
        offline_timestamp: now.getTime()
      });
      await database.batch(assetUpdate, movementLogCreate, syncOperation);
    });
    return clientOperationId;
  }

  static async rejectRepair(params: {
    assetId: string;
    userId: string;
  }) {
    const clientOperationId = uuidv4();
    const now = new Date();
    await database.write(async () => {
      const asset = await database.collections.get<Asset>('assets').find(params.assetId);
      const assetUpdate = asset.prepareUpdate(a => { 
        a.currentStatus = 'NSY IN';
        a.currentLocationId = 'NSY';
      });
      const movementLogCreate = db.collections.get<MovementLog>('movement_logs').prepareCreate(log => {
        log.clientOperationId = clientOperationId;
        log.assetId = asset.id;
        log.fromLocationId = asset.currentLocationId || 'Shop';
        log.toLocationId = 'NSY';
        log.previousStatus = asset.currentStatus;
        log.newStatus = 'NSY IN';
        log.remarks = 'Rejected by shop, returned to Yard Master.';
      });
      const syncOperation = prepareSyncOperation(db, clientOperationId, 'REPAIR_REJECT', {
        client_operation_id: clientOperationId,
        asset_id: asset.serverId || null,
        local_asset_id: asset.id,
        offline_timestamp: now.getTime()
      });
      await database.batch(assetUpdate, movementLogCreate, syncOperation);
    });
    return clientOperationId;
  }
}
