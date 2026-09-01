import { database } from '../index';
import Asset from '../models/Asset';
import RepairCycle from '../models/RepairCycle';
import ManufacturingOrder from '../models/ManufacturingOrder';
import QAInspection from '../models/QAInspection';
import FitCertificate from '../models/FitCertificate';
import Exception from '../models/Exception';
import MovementLog from '../models/MovementLog';
import { uuidv4, prepareSyncOperation } from './utils';

let db = database;

export class QARepository {
  static setDatabase(testDb: any) {
    db = testDb;
  }
  
  /**
   * Submits a QA Inspection result atomically.
   */
  static async submitInspection(params: {
    assetId: string;
    repairCycleId?: string;
    manufacturingOrderId?: string;
    result: 'FIT' | 'MINOR_FIX' | 'NOT_FIT' | 'CONDEMNATION_REQUEST';
    remarks?: string;
    userId: string;
  }) {
    // Enforce XOR constraint
    if (params.repairCycleId && params.manufacturingOrderId) {
      throw new Error('Inspection must belong to EITHER a Repair Cycle OR a Manufacturing Order, not both.');
    }
    if (!params.repairCycleId && !params.manufacturingOrderId) {
      throw new Error('Inspection must belong to an active operation.');
    }

    const clientOperationId = uuidv4();
    const now = new Date();

    await db.write(async () => {
      const asset = await db.collections.get<Asset>('assets').find(params.assetId);
      
      let repairCycle = null;
      if (params.repairCycleId) {
        repairCycle = await db.collections.get<RepairCycle>('repair_cycles').find(params.repairCycleId);
      }

      let mfgOrder = null;
      if (params.manufacturingOrderId) {
        mfgOrder = await db.collections.get<ManufacturingOrder>('manufacturing_orders').find(params.manufacturingOrderId);
      }

      // Prepare QA Inspection
      const inspectionCreate = db.collections.get<QAInspection>('qa_inspections').prepareCreate(insp => {
        insp.clientOperationId = clientOperationId;
        insp.assetId = asset.id;
        insp.repairCycleId = params.repairCycleId || null;
        insp.manufacturingOrderId = params.manufacturingOrderId || null;
        insp.status = 'COMPLETED';
        insp.verdict = params.result;
        insp.remarks = params.remarks;
      });

      const batchOps: any[] = [inspectionCreate];

      let newAssetStatus = asset.currentStatus;
      let newLocation = asset.currentLocationId;
      
      if (params.result === 'FIT') {
        newAssetStatus = 'FIT';
        newLocation = 'YARD';

        const fitCertCreate = db.collections.get<FitCertificate>('fit_certificates').prepareCreate(cert => {
          cert.clientOperationId = clientOperationId;
          cert.inspectionId = inspectionCreate.id;
          cert.certificateNumber = `FC-${clientOperationId.substring(0, 8).toUpperCase()}-${Date.now()}`;
        });
        batchOps.push(fitCertCreate);

      } else if (params.result === 'MINOR_FIX' || params.result === 'NOT_FIT') {
        if (params.repairCycleId && repairCycle) {
          newAssetStatus = 'IN_REPAIR';
          const cycleUpdate = repairCycle.prepareUpdate(c => {
            c.status = 'IN_PROGRESS';
            c.completedAt = null;
          });
          batchOps.push(cycleUpdate);
        } else if (params.manufacturingOrderId && mfgOrder) {
          newAssetStatus = 'IN_MANUFACTURING';
          const orderUpdate = mfgOrder.prepareUpdate(o => {
            o.orderStatus = 'ACTIVE';
          });
          batchOps.push(orderUpdate);
        }
      } else if (params.result === 'CONDEMNATION_REQUEST') {
        newAssetStatus = 'CONDEMNATION_REQUESTED';
        const exceptionCreate = db.collections.get<Exception>('exceptions').prepareCreate(exc => {
          exc.clientOperationId = clientOperationId;
          exc.assetId = asset.id;
          exc.exceptionType = 'CONDEMNATION_APPROVAL_REQUIRED';
          exc.status = 'OPEN';
          exc.severity = 'CRITICAL';
        });
        batchOps.push(exceptionCreate);
      }

      // Update Asset
      const assetUpdate = asset.prepareUpdate(a => {
        a.currentStatus = newAssetStatus;
        if (newLocation) {
          a.currentLocationId = newLocation;
        }
      });
      batchOps.push(assetUpdate);

      // Create MovementLog
      const movementLogCreate = db.collections.get<MovementLog>('movement_logs').prepareCreate(log => {
        log.clientOperationId = clientOperationId + '-qa';
        log.assetId = asset.id;
        log.fromLocationId = asset.currentLocationId;
        log.toLocationId = newLocation || asset.currentLocationId;
        log.previousStatus = asset.currentStatus;
        log.newStatus = newAssetStatus;
        log.repairCycleId = params.repairCycleId || null;
        log.manufacturingOrderId = params.manufacturingOrderId || null;
        log.remarks = `QA Result: ${params.result}. Remarks: ${params.remarks || ''}`;
      });
      batchOps.push(movementLogCreate);

      // Prepare Sync Operation
      const syncOperation = prepareSyncOperation(db, clientOperationId, 'QA_INSPECT', {
        client_operation_id: clientOperationId,
        asset_id: asset.serverId || null,
        asset_number: asset.assetNumber, // Send assetNumber for backend identity reconciliation
        repair_cycle_id: repairCycle?.serverId || null,
        manufacturing_order_id: mfgOrder?.serverId || null,
        result: params.result,
        remarks: params.remarks,
        offline_timestamp: now.getTime()
      });
      batchOps.push(syncOperation);

      await db.batch(...batchOps);
    });

    return clientOperationId;
  }
}
