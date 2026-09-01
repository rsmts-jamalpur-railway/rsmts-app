import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import schema from '../src/database/v2/schema';
import Asset from '../src/database/v2/models/Asset';
import SyncOperation from '../src/database/v2/models/SyncOperation';
import RepairCycle from '../src/database/v2/models/RepairCycle';
import MovementLog from '../src/database/v2/models/MovementLog';
import Exception from '../src/database/v2/models/Exception';
import QAInspection from '../src/database/v2/models/QAInspection';
import RepairHold from '../src/database/v2/models/RepairHold';
import ManufacturingOrder from '../src/database/v2/models/ManufacturingOrder';
import { SyncEngine } from '../src/database/v2/sync';
import { YardRepository } from '../src/database/v2/repositories/YardRepository';
import { RepairRepository } from '../src/database/v2/repositories/RepairRepository';
import { QaRepository } from '../src/database/v2/repositories/QaRepository';
import uuid from 'react-native-uuid';
import { Q } from '@nozbe/watermelondb';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

jest.mock('../src/database/v2/index', () => ({
  database: null,
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('Full Offline Journey (e2e with isolated backend)', () => {
  let database: Database;
  let adapter: LokiJSAdapter;
  let yardRepo: YardRepository;
  let repairRepo: RepairRepository;
  let qaRepo: QaRepository;
  let jwtToken: string;

  beforeAll(async () => {
    // 1. Get real JWT from localhost:3005
    const loginRes = await fetch('http://127.0.0.1:3005/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'mdfarhan6873@gmail.com', password: 'password' })
    });
    const loginData = await loginRes.json();
    jwtToken = loginData.access_token;
    if (!jwtToken) throw new Error('Could not authenticate with test backend');
  });

  beforeEach(() => {
    adapter = new LokiJSAdapter({
      schema,
      migrations: schemaMigrations({
        migrations: [ { toVersion: 6, steps: [] } ],
      }),
      useWebWorker: false,
      useIncrementalIndexedDB: false,
    });
    database = new Database({
      adapter,
      modelClasses: [Asset, SyncOperation, RepairCycle, MovementLog, Exception, QAInspection, RepairHold, ManufacturingOrder],
    });
    
    const dbIndex = require('../src/database/v2/index');
    dbIndex.database = database;
    
    yardRepo = new YardRepository(database);
    repairRepo = new RepairRepository(database);
    qaRepo = new QaRepository(database);

    (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
      if (key === '@Auth:token') return Promise.resolve(jwtToken);
      return Promise.resolve(null);
    });

    // Intercept fetch to point to test backend
    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockImplementation(async (url: string, options: any) => {
      let finalUrl = url;
      if (url.includes('3001')) {
        finalUrl = url.replace('3001', '3005');
      }
      return originalFetch(finalUrl, options);
    });
  });

  it('Completes a fully offline Repair Journey', async () => {
    const assetNumber = `WAG-OFF-${Date.now()}`;
    const opIds: string[] = [];
    
    // OFFLINE STAGE
    // 1. Yard Intake
    const intakeOpId = await yardRepo.recordArrival(assetNumber, 'BOXN', 'NR');
    opIds.push(intakeOpId);

    // 2. Allocate
    const allocateOpId = await yardRepo.allocateAsset(assetNumber, 'WRS-1');
    opIds.push(allocateOpId);

    // Get asset
    const [asset] = await database.collections.get<Asset>('assets').query(Q.where('asset_number', assetNumber)).fetch();
    expect(asset.currentLocation).toBe('WRS-1');
    expect(asset.serverId).toBeFalsy(); // Server ID is null locally

    // 3. Repair Start
    const cycleId = await repairRepo.startRepair(asset.id, 'POH', 'WRS-1');
    const [cycle] = await database.collections.get<RepairCycle>('repair_cycles').query(Q.where('id', cycleId)).fetch();
    expect(cycle.serverId).toBeFalsy();
    opIds.push(cycle.clientOperationId!);

    // 4. Hold
    const holdOpId = await repairRepo.putOnHold(cycleId, 'MATERIAL_SHORTAGE', 'Need part');
    opIds.push(holdOpId);

    // 5. Resume
    const resumeOpId = await repairRepo.resumeRepair(cycleId);
    opIds.push(resumeOpId);

    // 6. Repair Close
    const closeOpId = await repairRepo.closeRepair(cycleId, 'Done');
    opIds.push(closeOpId);

    // 7. QA FIT
    const qaOpId = await qaRepo.submitRepairInspection(cycleId, asset.id, 'FIT', 'Looks good');
    opIds.push(qaOpId);

    // 8. Yard Dispatch
    const dispatchOpId = await yardRepo.dispatchAsset(assetNumber, 'SR');
    opIds.push(dispatchOpId);

    // VERIFY OFFLINE STATE
    const outbox = await database.collections.get<SyncOperation>('sync_operations').query().fetch();
    expect(outbox.length).toBe(8);
    for (const op of outbox) {
      expect(op.status).toBe('PENDING');
    }

    // ONLINE STAGE
    await SyncEngine.sync();

    // VERIFY SYNC RECONCILIATION
    const syncedOutbox = await database.collections.get<SyncOperation>('sync_operations').query().fetch();
    expect(syncedOutbox.length).toBe(8);
    for (const op of syncedOutbox) {
      expect(op.status).toBe('SYNCED');
    }

    const updatedAsset = await database.collections.get<Asset>('assets').find(asset.id);
    expect(updatedAsset.serverId).toBeTruthy(); // Hydrated!
    expect(updatedAsset.currentStatus).toBe('DISPATCHED');

    const updatedCycle = await database.collections.get<RepairCycle>('repair_cycles').find(cycleId);
    expect(updatedCycle.serverId).toBeTruthy(); // Hydrated!

    // VERIFY SERVER STATE
    const pullRes = await fetch(`http://127.0.0.1:3005/v1/sync/pull?last_revision=0`, {
      headers: { 'Authorization': `Bearer ${jwtToken}` }
    });
    const pullData = await pullRes.json();
    const serverAsset = pullData.changes.assets.created.find((a: any) => a.asset_number === assetNumber);
    expect(serverAsset).toBeDefined();
    expect(serverAsset.current_status).toBe('DISPATCHED');
    expect(serverAsset.id).toBe(updatedAsset.serverId);
  });

  it('Completes a fully offline Manufacturing Journey', async () => {
    const assetNumber = `WAG-MFG-OFF-${Date.now()}`;
    const opIds: string[] = [];
    
    // OFFLINE STAGE
    // 1. Mfg Start (Generates local Asset implicitly or directly through MfgRepo)
    // Wait, Manufacturing repository doesn't implicitly intake the asset in the mobile app, 
    // but the backend does create it.
    // Let's assume Allocate or just MfgStart is the first. 
    // In our PRD, Yard Master allocates to Mfg Shop, then Mfg Supervisor starts.
    const intakeOpId = await yardRepo.recordArrival(assetNumber, 'BOXN', 'NR');
    const allocateOpId = await yardRepo.allocateAsset(assetNumber, 'WRS-1');
    
    const [asset] = await database.collections.get<Asset>('assets').query(Q.where('asset_number', assetNumber)).fetch();
    
    // We need MfgRepo to start
    const MfgRepository = require('../src/database/v2/repositories/ManufacturingRepository').ManufacturingRepository;
    const mfgRepo = new MfgRepository(database);

    const mfgStartOpId = await mfgRepo.startOrder(assetNumber, 'WRS-1');
    const [order] = await database.collections.get<ManufacturingOrder>('manufacturing_orders').query(Q.where('client_operation_id', mfgStartOpId)).fetch();

    const mfgCloseOpId = await mfgRepo.closeOrder(order.id, 'Done built');
    
    const qaOpId = await qaRepo.submitMfgInspection(order.id, asset.id, 'FIT', 'Excellent');
    const dispatchOpId = await yardRepo.dispatchAsset(assetNumber, 'EXTERNAL_RAILWAY');
    
    // SYNC
    await SyncEngine.sync();

    const updatedAsset = await database.collections.get<Asset>('assets').find(asset.id);
    expect(updatedAsset.serverId).toBeTruthy();
    expect(updatedAsset.currentStatus).toBe('DISPATCHED');

    // VERIFY SERVER STATE
    const pullRes = await fetch(`http://127.0.0.1:3005/v1/sync/pull?last_revision=0`, {
      headers: { 'Authorization': `Bearer ${jwtToken}` }
    });
    const pullData = await pullRes.json();
    const serverAsset = pullData.changes.assets.created.find((a: any) => a.asset_number === assetNumber);
    expect(serverAsset).toBeDefined();
    expect(serverAsset.current_status).toBe('DISPATCHED');
  });
});
