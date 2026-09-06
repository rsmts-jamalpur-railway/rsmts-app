import { SyncEngine } from './v2/sync';

export async function syncDatabase() {
  return await SyncEngine.sync();
}

export { SyncEngine };

