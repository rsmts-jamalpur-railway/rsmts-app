import { Q } from '@nozbe/watermelondb';
import { database } from '../index';
import Asset from '../models/Asset';
import MovementLog from '../models/MovementLog';
import { uuidv4, prepareSyncOperation } from './utils';
import { SyncEngine } from '../sync';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../../config';

let db = database;

async function performRealtimePush(commandType: string, payload: any) {
  const isConnected = await NetInfo.fetch().then(s => s.isConnected);
  if (!isConnected) {
    Toast.show({
      type: 'error',
      text1: 'No internet connection',
      text2: 'Real-time updates paused.'
    });
    throw new Error('No internet connection. Real-time updates paused.');
  }

  const token = await AsyncStorage.getItem('@Auth:token');
  const changes = {
    sync_operations: {
      created: [{
        ...payload,
        client_operation_id: payload.client_operation_id || uuidv4(),
        command_type: commandType
      }],
      updated: [],
      deleted: []
    }
  };

  const response = await fetch(`${API_BASE_URL}/sync/push`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ changes })
  });

  if (!response.ok) {
    Toast.show({
      type: 'error',
      text1: 'Sync Failed',
      text2: `Backend error: ${response.statusText}`
    });
    throw new Error(`Failed to push to server: ${response.statusText}`);
  }

  // Pull latest data to update UI instantly
  await SyncEngine.sync();
}

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

    await performRealtimePush('YARD_INTAKE', {
      client_operation_id: clientOperationId,
      asset_number: params.assetNumber.toUpperCase().trim(),
      category_id: params.category,
      from_railway: params.fromRailway || 'EXTERNAL',
      track_line: params.trackLine || 'NSY',
      remarks: params.remarks || '',
      offline_timestamp: now.getTime()
    });

    return clientOperationId;
  }

  static async updateAsset(params: {
    assetId: string;
    newAssetNumber: string;
    railwayZone: string;
    trackLine: string;
    trainNumber: string;
    remarks: string;
    condition: string;
  }) {
    const clientOperationId = uuidv4();
    const asset = await db.collections.get<Asset>('assets').find(params.assetId);

    await performRealtimePush('UPDATE_ASSET', {
      client_operation_id: clientOperationId,
      asset_id: asset.serverId || asset.id,
      asset_number: params.newAssetNumber ? params.newAssetNumber.toUpperCase().trim() : undefined,
      railway_zone: params.railwayZone,
      track_line: params.trackLine,
      train_number: params.trainNumber,
      remarks: params.remarks,
      condition: params.condition
    });
  }

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

    await performRealtimePush('YARD_ALLOCATE', {
      client_operation_id: clientOperationId,
      asset_number: asset.assetNumber,
      asset_id: asset.serverId || null,
      target_location_id: shop,
      offline_timestamp: now.getTime()
    });

    return clientOperationId;
  }

  static async reallocateAsset(params: {
    assetId: string;
    newShopId: string;
    userId: string;
  }) {
    return this.allocateAsset({ ...params, shopId: params.newShopId });
  }

  static async cancelArrival(params: {
    assetId: string;
    userId: string;
  }) {
    const clientOperationId = uuidv4();
    const now = new Date();

    const asset = await db.collections.get<Asset>('assets').find(params.assetId);

    await performRealtimePush('YARD_CANCEL_INTAKE', {
      client_operation_id: clientOperationId,
      asset_id: asset.serverId || null,
      local_asset_id: asset.id,
      offline_timestamp: now.getTime()
    });

    return clientOperationId;
  }

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

    await performRealtimePush('YARD_DISPATCH', {
      client_operation_id: clientOperationId,
      asset_number: asset.assetNumber,
      asset_id: asset.serverId || null,
      to_railway: toRail,
      rake_number: params.rakeNumber || null,
      train_number: params.trainNumber || null,
      remarks: params.remarks || '',
      offline_timestamp: now.getTime()
    });

    return clientOperationId;
  }
}
