import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Image } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { database } from '../../../database/v2';
import SyncOperation from '../../../database/v2/models/SyncOperation';
import { SyncEngine } from '../../../database/v2/sync';
import { Q } from '@nozbe/watermelondb';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../../context/AuthContext';

export default function SyncStatusScreen({ navigation }: any) {
  const [operations, setOperations] = useState<SyncOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastPullTime, setLastPullTime] = useState<string>('Never');
  const [stats, setStats] = useState({ pending: 0, retrying: 0, conflicts: 0, synced: 0 });

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
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
        const today = new Date();
        const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
        setLastPullTime(isToday ? `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : date.toLocaleString());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (syncing) return;
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

  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'PENDING': return { bg: '#fef3c7', text: '#92400e', icon: 'clock-outline', iconColor: '#d97706' };
      case 'SYNCED': return { bg: '#ecfdf5', text: '#065f46', icon: 'check-circle-outline', iconColor: '#10b981' };
      case 'CONFLICT': return { bg: '#fef2f2', text: '#991b1b', icon: 'alert-circle-outline', iconColor: '#ef4444' };
      case 'RETRY': return { bg: '#fffbeb', text: '#b45309', icon: 'refresh', iconColor: '#f59e0b' };
      default: return { bg: '#f1f5f9', text: '#475569', icon: 'help-circle-outline', iconColor: '#64748b' };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Top Operational Banner */}
        <View style={styles.bannerCard}>
          <View style={styles.bannerHeader}>
            <View style={styles.bannerHeaderLeft}>
              <Icon name="cellphone-wireless" size={20} color="#003c90" style={{ marginRight: 6 }} />
              <Text style={styles.bannerTitle}>EDGE TELEMETRY • NSY YARD</Text>
            </View>
            <View style={styles.activeBadge}>
              <View style={[styles.activeDot, { marginRight: 4 }]} />
              <Text style={styles.activeBadgeText}>Store & Forward Active</Text>
            </View>
          </View>
          
          <View style={styles.bannerBody}>
            <Image 
              source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBlPwZ8Ov4GJINu41BLhnwcYeR-ZyBsSpYH0xKFw1PrGLQFIAbDtF2OCVqNgPzUgQ3CQEgcBguegtiCWvnAgATptwyL8HcBEcExK5WUqpFn9To3M0efbTaCbpa-gA_3n8T83b-tWXfYlzPMKdRyG7qhnDgWf-R5G8Fhxdn1x8BuWTJLsnA3YtyqWl63vLdcw4nCK9lEa9uSDkVM8fMuBrrXWxKxRWw6Dbx0kIL2MlMCBdXeUl_c_TcK' }} 
              style={[styles.bannerImage, { marginRight: 12 }]}
            />
            <View style={styles.bannerTextCol}>
              <Text style={styles.bannerMainText}>Offline Buffer Synchronizer</Text>
              <Text style={styles.bannerSubText}>Terminal Queue: efcb8bb9-1980-453f</Text>
            </View>
          </View>
        </View>

        <View style={styles.screenHeader}>
          <Text style={styles.screenTitle}>SYNC MONITOR</Text>
          <View style={[styles.pendingBadge, stats.pending === 0 && { backgroundColor: '#ccfbf1' }]}>
            {stats.pending > 0 && <View style={[styles.pendingDot, { marginRight: 6 }]} />}
            <Text style={[styles.pendingText, stats.pending === 0 && { color: '#115e59' }]}>{stats.pending} PENDING</Text>
          </View>
        </View>

        {/* KPI Row */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Pending</Text>
            <Text style={[styles.kpiValue, { color: '#d97706' }]}>{stats.pending}</Text>
            <Text style={[styles.kpiSub, { color: 'rgba(217, 119, 6, 0.8)' }]}>QUEUED</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Retrying</Text>
            <Text style={[styles.kpiValue, { color: '#434653' }]}>{stats.retrying}</Text>
            <Text style={[styles.kpiSub, { color: 'rgba(67, 70, 83, 0.7)' }]}>{stats.retrying > 0 ? 'ACTIVE' : 'CLEAR'}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Conflicts</Text>
            <Text style={[styles.kpiValue, { color: '#006a63' }]}>{stats.conflicts}</Text>
            <Text style={[styles.kpiSub, { color: 'rgba(0, 106, 99, 0.7)' }]}>{stats.conflicts > 0 ? 'NEEDS REVIEW' : 'ZERO'}</Text>
          </View>
        </View>

        {/* Sync Status Bar & Action Banner */}
        <View style={styles.actionBar}>
          <View style={styles.actionStats}>
            <Text style={styles.actionStatRow}>
              <Text style={styles.actionStatLabel}>Last Pull: </Text>
              <Text style={styles.actionStatValue}>{lastPullTime}</Text>
            </Text>
            <Text style={styles.actionStatRow}>
              <Text style={styles.actionStatLabel}>Synced Today: </Text>
              <Text style={styles.actionStatValue}>{stats.synced}</Text>
            </Text>
          </View>
          <TouchableOpacity 
            style={[styles.syncBtn, syncing && styles.syncBtnActive]} 
            onPress={handleSync}
            activeOpacity={0.8}
          >
            <Icon name="sync" size={20} color="#ffffff" style={[syncing ? styles.spinIcon : {}, { marginRight: 8 }]} />
            <Text style={styles.syncBtnText}>{syncing ? 'SYNCING...' : 'SYNC NOW'}</Text>
          </TouchableOpacity>
        </View>

        {/* Bandwidth Visualizer */}
        <View style={styles.bandwidthCard}>
          <View style={styles.bandwidthHeader}>
            <Text style={styles.bandwidthTitle}>BANDWIDTH & RAIL SIGNAL HEALTH</Text>
            <View style={styles.signalBadge}>
              <Icon name="access-point-network" size={16} color="#006a63" style={{ marginRight: 4 }} />
              <Text style={styles.signalText}>98.4% LTE-M</Text>
            </View>
          </View>
          <View style={styles.sparklineRow}>
            {[30, 40, 30, 60, 70, 50, 80, 60, 40, 20].map((h, i) => (
              <View key={i} style={[styles.sparklineBar, { height: h, backgroundColor: i === 4 || i === 5 ? '#0f52ba' : i === 6 || i === 7 ? '#006a63' : '#dae2fd' }]} />
            ))}
          </View>
        </View>

        {/* Queue Operations Section */}
        <View style={styles.queueHeader}>
          <Text style={styles.queueTitle}>Recent Queue Operations</Text>
          <Text style={styles.queueSubtitle}>FIFO LOG</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#003c90" style={{ marginTop: 24 }} />
        ) : (
          <View style={styles.queueList}>
            {operations.map(op => {
              const opStyle = getStatusStyle(op.status);
              
              // Guessing icon/color based on commandType
              let opIcon = 'database-sync';
              let opIconColor = '#0f52ba';
              let opIconBg = '#e2e7ff';
              
              if (op.commandType === 'REPORT_EXCEPTION') {
                opIcon = 'alert';
                opIconColor = '#ba1a1a';
                opIconBg = '#ffdad6';
              } else if (op.commandType.includes('ALLOCATE') || op.commandType.includes('UPDATE')) {
                opIcon = 'forklift';
                opIconColor = '#003c90';
                opIconBg = '#eaedff';
              } else if (op.commandType.includes('INBOUND') || op.commandType.includes('RECEIVE')) {
                opIcon = 'login';
                opIconColor = '#006a63';
                opIconBg = '#ccfbf1';
              }

              let targetId = 'N/A';
              try {
                const p = JSON.parse(op.payload);
                targetId = p.assetNumber || p.targetId || p.exceptionId || 'N/A';
              } catch (e) {}

              return (
                <View key={op.id} style={[styles.queueCard, { marginBottom: 8 }]}>
                  <View style={styles.queueCardLeft}>
                    <View style={[styles.queueIconBox, { backgroundColor: opIconBg, marginRight: 12 }]}>
                      <Icon name={opIcon} size={20} color={opIconColor} />
                    </View>
                    <View style={styles.queueDetails}>
                      <Text style={styles.queueCommand}>{op.commandType}</Text>
                      <Text style={styles.queueTime}>{new Date(op.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' })}</Text>
                      <Text style={styles.queueTarget}>TARGET: {targetId}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.queueCardRight}>
                    <View style={[styles.queueStatusPill, { backgroundColor: opStyle.bg }]}>
                      <Text style={[styles.queueStatusText, { color: opStyle.text }]}>{op.status}</Text>
                    </View>
                    {op.status === 'RETRY' && (
                      <Text style={styles.queueAttempt}>ATTEMPT {op.attemptCount}</Text>
                    )}
                  </View>
                </View>
              );
            })}
            
            {operations.length === 0 && (
              <View style={styles.emptyState}>
                <Icon name="check-all" size={48} color="#cbd5e1" />
                <Text style={styles.emptyText}>Outbox is empty.</Text>
              </View>
            )}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footerNote}>
          <View style={styles.footerNoteLeft}>
            <Icon name="shield-check" size={18} color="#737784" style={{ marginRight: 8 }} />
            <Text style={styles.footerNoteText}>Automatic retry active: backoff every 45s</Text>
          </View>
          <TouchableOpacity>
            <Text style={styles.purgeBtnText}>PURGE STALE</Text>
          </TouchableOpacity>
        </View>

        <View style={{height: 40}} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#faf8ff' },
  container: { flex: 1 },
  content: { padding: 16 },

  bannerCard: { backgroundColor: '#ffffff', borderRadius: 12, padding: 12, marginBottom: 24, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  bannerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  bannerHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  bannerTitle: { fontSize: 11, fontWeight: '700', color: '#737784', letterSpacing: 0.5 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ccfbf1', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#006a63' },
  activeBadgeText: { fontSize: 10, fontWeight: '700', color: '#006f67', textTransform: 'uppercase' },
  bannerBody: { flexDirection: 'row', alignItems: 'center' },
  bannerImage: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#f1f5f9' },
  bannerTextCol: { flex: 1 },
  bannerMainText: { fontSize: 17, fontWeight: '600', color: '#131b2e' },
  bannerSubText: { fontSize: 12, color: '#434653', marginTop: 2 },

  screenHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  screenTitle: { fontSize: 22, fontWeight: '700', color: '#131b2e', letterSpacing: -0.5 },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, shadowColor: '#000', shadowOffset:{width:0, height:1}, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  pendingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#d97706' },
  pendingText: { fontSize: 11, fontWeight: '800', color: '#92400e', letterSpacing: 0.5 },

  kpiRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  kpiCard: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', paddingVertical: 12, borderRadius: 12, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1, marginHorizontal: 4 },
  kpiLabel: { fontSize: 12, fontWeight: '600', color: '#434653', marginBottom: 4 },
  kpiValue: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  kpiSub: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: 4 },

  actionBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff', padding: 16, borderRadius: 12, marginBottom: 24, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  actionStats: { flex: 1 },
  actionStatRow: { marginBottom: 4 },
  actionStatLabel: { fontSize: 12, fontWeight: '500', color: '#434653' },
  actionStatValue: { fontSize: 12, fontWeight: '600', color: '#131b2e' },
  syncBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f52ba', paddingHorizontal: 20, height: 48, borderRadius: 8, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  syncBtnActive: { backgroundColor: '#006a63' },
  syncBtnText: { fontSize: 14, fontWeight: '700', color: '#ffffff', letterSpacing: 0.5, textTransform: 'uppercase' },
  spinIcon: { transform: [{ rotate: '180deg' }] }, // simple stub for rotation

  bandwidthCard: { backgroundColor: '#f2f3ff', borderRadius: 12, padding: 16, marginBottom: 24 },
  bandwidthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  bandwidthTitle: { fontSize: 11, fontWeight: '700', color: '#737784', letterSpacing: 0.5 },
  signalBadge: { flexDirection: 'row', alignItems: 'center' },
  signalText: { fontSize: 12, fontWeight: '600', color: '#006a63' },
  sparklineRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 32 },
  sparklineBar: { flex: 1, borderRadius: 2, marginHorizontal: 2 },

  queueHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  queueTitle: { fontSize: 17, fontWeight: '700', color: '#131b2e' },
  queueSubtitle: { fontSize: 11, fontWeight: '700', color: '#737784', letterSpacing: 0.5, fontFamily: 'monospace' },

  queueList: { marginBottom: 24 },
  queueCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff', padding: 12, borderRadius: 12, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  queueCardLeft: { flexDirection: 'row', alignItems: 'flex-start', flex: 1 },
  queueIconBox: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  queueDetails: { flex: 1 },
  queueCommand: { fontSize: 15, fontWeight: '700', color: '#131b2e' },
  queueTime: { fontSize: 12, color: '#434653', fontFamily: 'monospace', marginTop: 2, marginBottom: 4 },
  queueTarget: { fontSize: 10, color: '#737784', fontFamily: 'monospace', textTransform: 'uppercase' },
  
  queueCardRight: { alignItems: 'flex-end', marginLeft: 8 },
  queueStatusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 4 },
  queueStatusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  queueAttempt: { fontSize: 9, color: '#737784', fontFamily: 'monospace' },

  emptyState: { padding: 32, alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 12 },
  emptyText: { color: '#94a3b8', marginTop: 8, fontSize: 14, fontWeight: '500' },

  footerNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(242, 243, 255, 0.6)', padding: 12, borderRadius: 12 },
  footerNoteLeft: { flexDirection: 'row', alignItems: 'center' },
  footerNoteText: { fontSize: 12, fontWeight: '500', color: '#737784' },
  purgeBtnText: { fontSize: 11, fontWeight: '700', color: '#003c90', textTransform: 'uppercase' },
});
