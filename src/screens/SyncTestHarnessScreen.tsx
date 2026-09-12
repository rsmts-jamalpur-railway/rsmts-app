import React, { useEffect, useState } from 'react';
import { View, Text, Button, ScrollView, StyleSheet } from 'react-native';
import { database } from '../database/v2';
import SyncOperation from '../database/v2/models/SyncOperation';
import { SyncEngine } from '../database/v2/sync';
import uuid from 'react-native-uuid';
import { Q } from '@nozbe/watermelondb';
import RepairCycle from '../database/v2/models/RepairCycle';

export const SYNC_TEST_HARNESS_ENABLED = true;

export default function SyncTestHarnessScreen() {
  const [operations, setOperations] = useState<SyncOperation[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [repairCycles, setRepairCycles] = useState<RepairCycle[]>([]);

  const loadData = async () => {
    const ops = await database.collections.get<SyncOperation>('sync_operations').query().fetch();
    const cycles = await database.collections.get<RepairCycle>('repair_cycles').query(Q.take(10)).fetch();
    setOperations(ops);
    setRepairCycles(cycles);
  };

  useEffect(() => {
    loadData();
    const sub = database.collections.get('sync_operations').changes.subscribe(() => {
      loadData();
    });
    return () => sub.unsubscribe();
  }, []);

  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  const insertTestOp = async (commandType: string) => {
    try {
      const clientOpId = uuid.v4() as string;
      await database.write(async () => {
        
        // 1. Create a dummy record if we are testing offline-created record idempotency (Test #10)
        let repairId: string | null = null;
        if (commandType === 'TEST_409_IDEMPOTENCY' || commandType === 'TEST_CREATE_REPAIR') {
          repairId = uuid.v4() as string;
          await database.collections.get<any>('repair_cycles').create((r: any) => {
            r._raw.id = repairId;
            r.clientOperationId = clientOpId;
            r.assetId = 'dummy-asset';
            r.repairShopId = 'dummy-shop';
            r.repairCategoryId = 'dummy-category';
            r.status = 'ACTIVE';
          });
        }

        // 2. Create the operation
        await database.collections.get<SyncOperation>('sync_operations').create(op => {
          op.clientOperationId = clientOpId;
          op.commandType = commandType;
          op.payload = JSON.stringify({ test: true, repairId });
          op.status = 'PENDING';
        });
      });
      addLog(`Inserted ${commandType} op: ${clientOpId.slice(0,8)}`);
    } catch (e: any) {
      addLog(`Error inserting: ${e.message}`);
    }
  };

  const triggerSync = async () => {
    addLog('Starting SyncEngine.sync()...');
    try {
      await SyncEngine.sync();
      addLog('Sync finished successfully.');
    } catch (e: any) {
      addLog(`Sync error: ${e.message}`);
    }
  };

  const clearQueue = async () => {
    await database.write(async () => {
      const ops = await database.collections.get('sync_operations').query().fetch();
      const deletions = ops.map(op => op.prepareDestroyPermanently());
      await database.batch(...deletions);
    });
    addLog('Queue cleared.');
  };

  if (!__DEV__ || !SYNC_TEST_HARNESS_ENABLED) {
    return <View><Text>Harness Disabled</Text></View>;
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Offline Sync Test Harness (Step 8)</Text>
      
      <View style={styles.buttonRow}>
        <Button title="Test 500 (Timeout/Server Error)" onPress={() => insertTestOp('TEST_500')} />
        <Button title="Test 401 (Auth)" onPress={() => insertTestOp('TEST_401')} />
      </View>
      <View style={styles.buttonRow}>
        <Button title="Test 400 (State Conflict)" onPress={() => insertTestOp('TEST_400_STATE')} />
        <Button title="Test 409 (Capacity Lock)" onPress={() => insertTestOp('TEST_409_CAPACITY')} />
      </View>
      <View style={styles.buttonRow}>
        <Button title="Test 409 Idempotency (Server UUID Map)" onPress={() => insertTestOp('TEST_409_IDEMPOTENCY')} />
      </View>
      
      <View style={styles.actionRow}>
        <Button title="Trigger Sync" color="green" onPress={triggerSync} />
        <Button title="Clear DB Queue" color="red" onPress={clearQueue} />
      </View>

      <Text style={styles.subtitle}>Queue Status ({operations.length})</Text>
      {operations.map(op => (
        <View key={op.id} style={styles.card}>
          <Text style={styles.bold}>{op.commandType} - {op.status}</Text>
          <Text style={styles.small}>ID: {op.clientOperationId}</Text>
          <Text style={styles.small}>Attempts: {op.attemptCount || 0}</Text>
          <Text style={styles.small}>Next Retry: {op.nextRetryAt ? new Date(op.nextRetryAt).toLocaleTimeString() : 'N/A'}</Text>
          {op.errorCode && <Text style={{ color: 'red', fontSize: 10 }}>Error: {op.errorCode}</Text>}
          {op.serverResponse && <Text style={styles.small}>Response: {op.serverResponse.slice(0, 50)}...</Text>}
        </View>
      ))}

      <Text style={styles.subtitle}>Mapped Repair Cycles</Text>
      {repairCycles.map(r => (
        <View key={r.id} style={styles.card}>
          <Text style={styles.bold}>Local ID: {r.id}</Text>
          <Text style={{ color: 'blue', fontSize: 10 }}>Server ID: {r.serverId || 'NULL'}</Text>
          <Text style={styles.small}>Op ID: {r.clientOperationId}</Text>
        </View>
      ))}

      <Text style={styles.subtitle}>Logs</Text>
      {logs.map((l, i) => <Text key={i} style={styles.log}>{l}</Text>)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#FFFFFF' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  subtitle: { fontSize: 16, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 16 },
  card: { backgroundColor: 'white', padding: 8, marginBottom: 8, borderRadius: 4, borderWidth: 1, borderColor: '#ddd' },
  bold: { fontWeight: 'bold' },
  small: { fontSize: 10, color: '#666' },
  log: { fontSize: 10, fontFamily: 'monospace', marginVertical: 2 }
});
