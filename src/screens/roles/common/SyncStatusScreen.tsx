import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Header from '../../../components/Header';
import { database } from '../../../database/v2';
import SyncOperation from '../../../database/v2/models/SyncOperation';
import { SyncEngine } from '../../../database/v2/sync';
import { Q } from '@nozbe/watermelondb';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SyncStatusScreen({ navigation }: any) {
  const [operations, setOperations] = useState<SyncOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastPullTime, setLastPullTime] = useState<string>('Never');
  const [stats, setStats] = useState({ pending: 0, retrying: 0, conflicts: 0, synced: 0 });

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Poll every 5s for live updates
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const ops = await database.collections.get<SyncOperation>('sync_operations').query(
        Q.sortBy('created_at', Q.desc),
        Q.take(50)
      ).fetch();
      
      const counts = await database.collections.get<SyncOperation>('sync_operations').query().fetch();
      
      setOperations(ops);
      setStats({
        pending: counts.filter(o => o.status === 'PENDING').length,
        retrying: counts.filter(o => o.status === 'RETRY').length,
        conflicts: counts.filter(o => o.status === 'CONFLICT').length,
        synced: counts.filter(o => o.status === 'SYNCED').length,
      });

      const cursor = await AsyncStorage.getItem('@rsmts_sync_cursor');
      if (cursor && cursor !== '0') {
        const date = new Date(parseInt(cursor));
        setLastPullTime(date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await SyncEngine.sync();
      await loadData();
    } catch (err) {
      console.error('Manual sync failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'PENDING': return '#f59e0b';
      case 'SYNCED': return '#10b981';
      case 'CONFLICT': return '#ef4444';
      case 'RETRY': return '#f97316';
      default: return '#64748b';
    }
  };

  const parseError = (op: SyncOperation) => {
    if (!op.errorCode) return 'Unknown Error';
    return op.errorCode; // We preserve the machine-readable code as requested
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="SYNC MONITOR" />
      <View style={styles.container}>
        
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Pending</Text>
            <Text style={[styles.kpiValue, { color: '#f59e0b' }]}>{stats.pending}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Retrying</Text>
            <Text style={[styles.kpiValue, { color: '#f97316' }]}>{stats.retrying}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Conflicts</Text>
            <Text style={[styles.kpiValue, { color: '#ef4444' }]}>{stats.conflicts}</Text>
          </View>
        </View>

        <View style={styles.toolbar}>
          <View>
            <Text style={styles.lastSyncText}>Last Pull: {lastPullTime}</Text>
            <Text style={styles.lastSyncText}>Synced Today: {stats.synced}</Text>
          </View>
          <TouchableOpacity 
            style={[styles.syncBtn, syncing && styles.syncBtnDisabled]} 
            onPress={handleSync}
            disabled={syncing}
          >
            {syncing ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="sync" size={20} color="#fff" />}
            <Text style={styles.syncBtnText}>{syncing ? 'SYNCING...' : 'SYNC NOW'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Recent Queue Operations</Text>
        
        {loading ? (
          <ActivityIndicator size="large" color="#0A74DA" style={{ marginTop: 32 }} />
        ) : (
          <ScrollView style={styles.list}>
            {operations.map(op => (
              <View key={op.id} style={styles.opCard}>
                <View style={styles.opHeader}>
                  <Text style={styles.opTitle}>{op.commandType}</Text>
                  <View style={[styles.badge, { backgroundColor: getStatusColor(op.status) }]}>
                    <Text style={styles.badgeText}>{op.status}</Text>
                  </View>
                </View>
                
                <Text style={styles.opTime}>{new Date(op.createdAt).toLocaleString()}</Text>
                
                {op.status === 'CONFLICT' && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorTitle}>Error Code:</Text>
                    <Text style={styles.errorCode}>{parseError(op)}</Text>
                  </View>
                )}
                
                {op.status === 'RETRY' && op.nextRetryAt && (
                  <Text style={styles.retryText}>
                    Attempt {op.attemptCount}. Next retry: {new Date(op.nextRetryAt).toLocaleTimeString()}
                  </Text>
                )}
              </View>
            ))}
            {operations.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Outbox is empty.</Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f1f5f9' },
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  kpiRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  kpiCard: { flex: 1, backgroundColor: '#fff', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  kpiLabel: { fontSize: 12, color: '#64748b', fontWeight: 'bold', marginBottom: 4 },
  kpiValue: { fontSize: 24, fontWeight: '900' },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 24 },
  lastSyncText: { fontSize: 12, color: '#475569', marginBottom: 2 },
  syncBtn: { flexDirection: 'row', backgroundColor: '#0A74DA', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 6, alignItems: 'center', gap: 8 },
  syncBtnDisabled: { backgroundColor: '#94a3b8' },
  syncBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginBottom: 12 },
  list: { flex: 1 },
  opCard: { backgroundColor: '#fff', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
  opHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  opTitle: { fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  badgeText: { fontSize: 10, fontWeight: 'bold', color: '#fff' },
  opTime: { fontSize: 11, color: '#94a3b8', marginBottom: 8 },
  errorBox: { backgroundColor: '#fef2f2', padding: 8, borderRadius: 4, marginTop: 4, borderWidth: 1, borderColor: '#fecaca' },
  errorTitle: { fontSize: 10, color: '#ef4444', fontWeight: 'bold' },
  errorCode: { fontSize: 12, color: '#b91c1c', fontFamily: 'monospace', marginTop: 2 },
  retryText: { fontSize: 11, color: '#f97316', marginTop: 8, fontStyle: 'italic' },
  emptyState: { padding: 32, alignItems: 'center' },
  emptyText: { color: '#94a3b8' }
});
