// @ts-nocheck
import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import schema from './src/database/v2/schema';
import Asset from './src/database/v2/models/Asset';
import SyncOperation from './src/database/v2/models/SyncOperation';
import RepairCycle from './src/database/v2/models/RepairCycle';
import { SyncEngine } from './src/database/v2/sync';
import uuid from 'react-native-uuid';
import { Q } from '@nozbe/watermelondb';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 1. Setup Node Adapter
const adapter = new LokiJSAdapter({
  schema,
  useWebWorker: false,
  useIncrementalIndexedDB: false,
});

// 2. Setup Database
const database = new Database({
  adapter,
  modelClasses: [Asset, SyncOperation, RepairCycle],
});

// Mock AsyncStorage
(AsyncStorage as any).getItem = async (key: string) => {
  if (key === '@Auth:token') return 'dummy-token';
  return null;
};
(AsyncStorage as any).setItem = async () => {};

// Mock fetch to simulate the backend
(global as any).fetch = async (url: string, options: any) => {
  if (url.includes('pull')) {
    return {
      ok: true,
      json: async () => ({ changes: { assets: { created: [], updated: [], deleted: [] }, repair_cycles: { created: [], updated: [], deleted: [] } }, next_revision: 1 })
    };
  }
  
  if (url.includes('push')) {
    const body = JSON.parse(options.body);
    const ops = body.changes.sync_operations.created;
    
    // Simulate responses based on command_type
    const results: any[] = [];
    const errors: any[] = [];
    let is401 = false;
    let is500 = false;
    
    for (const op of ops) {
      if (op.command_type === 'TEST_500') {
        is500 = true;
      } else if (op.command_type === 'TEST_401') {
        is401 = true;
      } else if (op.command_type === 'TEST_400_STATE') {
        errors.push({ client_operation_id: op.client_operation_id, code: 'INVALID_STATE_TRANSITION', status: 'ERROR', message: 'Simulated 400' });
      } else if (op.command_type === 'TEST_409_CAPACITY') {
        errors.push({ client_operation_id: op.client_operation_id, code: 'CAPACITY_EXCEEDED', status: 'ERROR', message: 'Simulated 409' });
      } else if (op.command_type === 'TEST_409_IDEMPOTENCY') {
        results.push({ client_operation_id: op.client_operation_id, status: 'ALREADY_PROCESSED', server_id: 'simulated-uuid-999', entity: 'REPAIR_CYCLE' });
      }
    }
    
    if (is401) return { status: 401, ok: false };
    if (is500) return { status: 500, ok: false };
    
    return {
      ok: true,
      json: async () => ({ results, errors })
    };
  }
  
  throw new Error('Unknown URL: ' + url);
};

// Override the database instance inside SyncEngine using require cache trick or just pass it in?
// Actually, SyncEngine imports database from './index'. We can't easily override it unless we mutate the exported database.
// Let's mutate it!
const dbIndex = require('./src/database/v2/index');
Object.assign(dbIndex, { database });

async function runTests() {
  console.log('--- STARTING 10 FAILURE-MODE NATIVE TESTS ---');
  
  const insertOp = async (cmd: string, payload: any = {}) => {
    const cid = uuid.v4() as string;
    await database.write(async () => {
      await database.collections.get<SyncOperation>('sync_operations').create(op => {
        op.clientOperationId = cid;
        op.commandType = cmd;
        op.payload = JSON.stringify(payload);
        op.status = 'PENDING';
      });
    });
    return cid;
  };
  
  // Test 1: Network Timeout / 500
  const id500 = await insertOp('TEST_500');
  await SyncEngine.sync().catch(e => console.log('Sync threw expected 500 error'));
  let op500 = await database.collections.get<SyncOperation>('sync_operations').query(Q.where('client_operation_id', id500)).fetch();
  console.log('Test 1 (500) -> Status:', op500[0].status, '| Attempt:', op500[0].attemptCount, '| NextRetry:', op500[0].nextRetryAt ? 'Populated' : 'Missing');
  
  // Clear ops for next test
  await database.write(async () => await database.batch(...op500.map(o => o.prepareDestroyPermanently())));
  
  // Test 2: 401
  const id401 = await insertOp('TEST_401');
  await SyncEngine.sync().catch(e => console.log('Sync threw expected 401 error'));
  let op401 = await database.collections.get<SyncOperation>('sync_operations').query(Q.where('client_operation_id', id401)).fetch();
  console.log('Test 4 (401) -> Status:', op401[0].status, '(queue paused)');
  await database.write(async () => await database.batch(...op401.map(o => o.prepareDestroyPermanently())));

  // Test 3: 400 State Conflict
  const id400 = await insertOp('TEST_400_STATE');
  await SyncEngine.sync();
  let op400 = await database.collections.get<SyncOperation>('sync_operations').query(Q.where('client_operation_id', id400)).fetch();
  console.log('Test 5 (400) -> Status:', op400[0].status, '| Code:', op400[0].errorCode);
  
  // Test 4: 409 Capacity
  const idCap = await insertOp('TEST_409_CAPACITY');
  await SyncEngine.sync();
  let opCap = await database.collections.get<SyncOperation>('sync_operations').query(Q.where('client_operation_id', idCap)).fetch();
  console.log('Test 7 (409 Cap) -> Status:', opCap[0].status, '| Code:', opCap[0].errorCode);

  // Test 5: 409 Idempotency & Offline-Created Record
  const cidIdemp = uuid.v4() as string;
  const localRepairId = uuid.v4() as string;
  await database.write(async () => {
    await database.collections.get<RepairCycle>('repair_cycles').create(r => {
      r._raw.id = localRepairId;
      r.clientOperationId = cidIdemp;
      r.assetId = 'dummy-asset';
      r.repairShopId = 'dummy-shop';
      r.repairCategoryId = 'dummy-cat';
      r.status = 'ACTIVE';
    });
    await database.collections.get<SyncOperation>('sync_operations').create(op => {
      op.clientOperationId = cidIdemp;
      op.commandType = 'TEST_409_IDEMPOTENCY';
      op.payload = JSON.stringify({ repairId: localRepairId });
      op.status = 'PENDING';
    });
  });
  
  await SyncEngine.sync();
  let opIdemp = await database.collections.get<SyncOperation>('sync_operations').query(Q.where('client_operation_id', cidIdemp)).fetch();
  let repairObj = await database.collections.get<RepairCycle>('repair_cycles').find(localRepairId);
  
  console.log('Test 8/10 (Idempotency) -> Status:', opIdemp[0].status);
  console.log('Test 8/10 (Idempotency) -> local id unchanged:', repairObj.id === localRepairId);
  console.log('Test 8/10 (Idempotency) -> server_id mapped:', repairObj.serverId);
  
  process.exit(0);
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
