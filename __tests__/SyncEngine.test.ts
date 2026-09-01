import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import schema from '../src/database/v2/schema';
import Asset from '../src/database/v2/models/Asset';
import SyncOperation from '../src/database/v2/models/SyncOperation';
import RepairCycle from '../src/database/v2/models/RepairCycle';
import { SyncEngine } from '../src/database/v2/sync';
import uuid from 'react-native-uuid';
import { Q } from '@nozbe/watermelondb';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

// Mock the native DB initialization so JSI doesn't crash in Node
jest.mock('../src/database/v2/index', () => ({
  database: null,
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('SyncEngine Native Harness', () => {
  let database: Database;
  let adapter: LokiJSAdapter;

  beforeEach(() => {
    adapter = new LokiJSAdapter({
      schema,
      migrations: schemaMigrations({
        migrations: [
          {
            toVersion: 6,
            steps: [],
          },
        ],
      }),
      useWebWorker: false,
      useIncrementalIndexedDB: false,
    });
    database = new Database({
      adapter,
      modelClasses: [Asset, SyncOperation, RepairCycle],
    });
    
    // Inject the DB into the sync engine module via require cache trick or global
    const dbIndex = require('../src/database/v2/index');
    dbIndex.database = database;
    
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('dummy-token');
  });

  const mockBackendPush = (handler: (op: any) => any) => {
    globalThis.fetch = jest.fn().mockImplementation(async (url: string, options: any) => {
      if (url.includes('pull')) {
        return { ok: true, json: async () => ({ changes: { assets: { created: [], updated: [], deleted: [] }, repair_cycles: { created: [], updated: [], deleted: [] } }, next_revision: 1 }) };
      }
      if (url.includes('push')) {
        const body = JSON.parse(options.body);
        const ops = body.changes.sync_operations.created;
        return handler(ops);
      }
    });
  };

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

  it('1. 500 / timeout -> RETRY, increment attempt, next_retry_at', async () => {
    mockBackendPush(() => ({ status: 500, ok: false }));
    const id = await insertOp('TEST_500');
    
    await SyncEngine.sync();
    
    const [op] = await database.collections.get<SyncOperation>('sync_operations').query(Q.where('client_operation_id', id)).fetch();
    console.log('[LOG] 500 Test: Status=' + op.status + ' | Attempts=' + op.attemptCount + ' | RetryAt=' + op.nextRetryAt + ' | OP=' + op.clientOperationId);
    
    expect(op.status).toBe('RETRY');
    expect(op.attemptCount).toBe(1);
    expect(op.nextRetryAt).toBeDefined();
    expect(op.clientOperationId).toBe(id);
  });

  it('2. 401 -> queue halted, operation preserved', async () => {
    mockBackendPush(() => ({ status: 401, ok: false }));
    const id = await insertOp('TEST_401');
    
    await expect(SyncEngine.sync()).rejects.toThrow();
    
    const [op] = await database.collections.get<SyncOperation>('sync_operations').query(Q.where('client_operation_id', id)).fetch();
    console.log('[LOG] 401 Test: Status=' + op.status + ' | OP=' + op.clientOperationId);
    
    expect(op.status).toBe('PENDING');
  });

  it('3. 400 state conflict -> CONFLICT, INVALID_STATE_TRANSITION', async () => {
    mockBackendPush((ops) => ({
      ok: true,
      json: async () => ({ results: [], errors: [{ client_operation_id: ops[0].client_operation_id, code: 'INVALID_STATE_TRANSITION' }] })
    }));
    const id = await insertOp('TEST_400');
    
    await SyncEngine.sync();
    
    const [op] = await database.collections.get<SyncOperation>('sync_operations').query(Q.where('client_operation_id', id)).fetch();
    console.log('[LOG] 400 Test: Status=' + op.status + ' | ErrorCode=' + op.errorCode);
    
    expect(op.status).toBe('CONFLICT');
    expect(op.errorCode).toBe('INVALID_STATE_TRANSITION');
  });

  it('4. 409 capacity -> CONFLICT, CAPACITY_EXCEEDED', async () => {
    mockBackendPush((ops) => ({
      ok: true,
      json: async () => ({ results: [], errors: [{ client_operation_id: ops[0].client_operation_id, code: 'CAPACITY_EXCEEDED' }] })
    }));
    const id = await insertOp('TEST_409');
    
    await SyncEngine.sync();
    
    const [op] = await database.collections.get<SyncOperation>('sync_operations').query(Q.where('client_operation_id', id)).fetch();
    console.log('[LOG] 409 Cap Test: Status=' + op.status + ' | ErrorCode=' + op.errorCode);
    
    expect(op.status).toBe('CONFLICT');
    expect(op.errorCode).toBe('CAPACITY_EXCEEDED');
  });

  it('5. 409 idempotency -> server_id populated, local id unchanged', async () => {
    const localId = uuid.v4() as string;
    const cid = uuid.v4() as string;
    
    await database.write(async () => {
      await database.collections.get<RepairCycle>('repair_cycles').create(r => {
        r._raw.id = localId;
        r.clientOperationId = cid;
        r.assetId = 'dummy-asset';
        r.repairShopId = 'dummy';
        r.repairCategoryId = 'dummy';
        r.status = 'ACTIVE';
      });
      await database.collections.get<SyncOperation>('sync_operations').create(op => {
        op.clientOperationId = cid;
        op.commandType = 'TEST_IDEMP';
        op.payload = JSON.stringify({ repairId: localId });
        op.status = 'PENDING';
      });
    });

    mockBackendPush((ops) => ({
      ok: true,
      json: async () => ({ results: [{ client_operation_id: ops[0].client_operation_id, status: 'ALREADY_PROCESSED', server_id: 'uuid-999', entity: 'REPAIR_CYCLE' }], errors: [] })
    }));
    
    await SyncEngine.sync();
    
    const [op] = await database.collections.get<SyncOperation>('sync_operations').query(Q.where('client_operation_id', cid)).fetch();
    const repair = await database.collections.get<RepairCycle>('repair_cycles').find(localId);
    
    console.log('[LOG] 409 Idempotency Test: Status=' + op.status + ' | LocalID=' + repair.id + ' | ServerID=' + repair.serverId);
    
    expect(op.status).toBe('SYNCED');
    expect(repair.id).toBe(localId);
    expect(repair.serverId).toBe('uuid-999');
  });
});
