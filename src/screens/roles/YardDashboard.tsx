import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../context/AuthContext';
import { withDatabase } from '@nozbe/watermelondb/DatabaseProvider';
import withObservables from '@nozbe/with-observables';
import { Q } from '@nozbe/watermelondb';
import Asset from '../../database/v2/models/Asset';
import Location from '../../database/v2/models/Location';
import MovementLog from '../../database/v2/models/MovementLog';

interface YardDashboardProps {
  navigation: any;
  assets?: Asset[];
  nsyLocation?: Location[];
  recentLogs?: MovementLog[];
}

function YardDashboardBase({ navigation, assets = [], nsyLocation = [], recentLogs = [] }: YardDashboardProps) {
  const { employeeId, can } = useAuth();

  const nsyCap = nsyLocation.length > 0 ? nsyLocation[0].maxCapacity : 500;
  const inYardCount = assets.filter(a => a.currentLocationId === 'NSY' || a.currentLocationId === 'YARD').length;
  const awaitingAllocation = assets.filter(a => a.currentStatus === 'RECEIVED_IN_YARD').length;
  const readyForDispatch = assets.filter(a => a.currentStatus === 'FIT').length;
  const inRepairCount = assets.filter(a => a.currentStatus === 'IN_REPAIR').length;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.banner}>
        <View>
          <Text style={styles.bannerRole}>YARD OPERATIONS</Text>
          <Text style={styles.bannerName}>
            Yard Master: <Text style={styles.bannerNameBold}>{employeeId || 'YARD-MASTER'}</Text>
          </Text>
        </View>
        <View style={styles.badge}>
          <Icon name="map-marker-radius" size={13} color="#0369a1" />
          <Text style={styles.badgeText}>NSY</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>YARD STATUS</Text>
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <Icon name="warehouse" size={18} color="#0284c7" />
            <Text style={styles.kpiLabel}>NSY Occupancy</Text>
          </View>
          <Text style={styles.kpiValue}>{inYardCount} / {nsyCap}</Text>
          <Text style={styles.kpiSub}>{Math.round((inYardCount / (nsyCap || 1)) * 100)}% capacity used</Text>
        </View>
        <View style={[styles.kpiCard, styles.kpiWarning]}>
          <View style={styles.kpiHeader}>
            <Icon name="inbox-arrow-down" size={18} color="#d97706" />
            <Text style={styles.kpiLabel}>Awaiting Allocation</Text>
          </View>
          <Text style={[styles.kpiValue, { color: '#d97706' }]}>{awaitingAllocation}</Text>
          <Text style={styles.kpiSub}>In NSY intake</Text>
        </View>
      </View>

      <View style={[styles.kpiRow, { marginTop: 10 }]}>
        <View style={[styles.kpiCard, styles.kpiSuccess]}>
          <View style={styles.kpiHeader}>
            <Icon name="check-circle-outline" size={18} color="#16a34a" />
            <Text style={styles.kpiLabel}>Ready for Dispatch</Text>
          </View>
          <Text style={[styles.kpiValue, { color: '#16a34a' }]}>{readyForDispatch}</Text>
          <Text style={styles.kpiSub}>QA cleared (FIT)</Text>
        </View>
        <View style={[styles.kpiCard, styles.kpiBlue]}>
          <View style={styles.kpiHeader}>
            <Icon name="wrench-outline" size={18} color="#0A74DA" />
            <Text style={styles.kpiLabel}>In Workshop</Text>
          </View>
          <Text style={[styles.kpiValue, { color: '#0A74DA' }]}>{inRepairCount}</Text>
          <Text style={styles.kpiSub}>Active in shops</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
      <View style={styles.actionGrid}>
        {can('yard:receive') && (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#0A74DA' }]} onPress={() => navigation.navigate('NSYIn')}>
            <Icon name="train-variant" size={20} color="#FFFFFF" />
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionText}>NSY IN</Text>
              <Text style={styles.actionDesc}>Record new arrival</Text>
            </View>
          </TouchableOpacity>
        )}
        {can('yard:allocate') && (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#0f766e' }]} onPress={() => navigation.navigate('Allocate')}>
            <Icon name="swap-horizontal" size={20} color="#FFFFFF" />
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionText}>ALLOCATE</Text>
              <Text style={styles.actionDesc}>Send to repair shop</Text>
            </View>
          </TouchableOpacity>
        )}
        {can('yard:dispatch') && (
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#7c3aed' }]} onPress={() => navigation.navigate('NSYOut')}>
            <Icon name="arrow-up-circle-outline" size={20} color="#FFFFFF" />
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionText}>NSY OUT</Text>
              <Text style={styles.actionDesc}>Dispatch FIT assets</Text>
            </View>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#e11d48' }]} onPress={() => navigation.navigate('ReportException')}>
          <Icon name="alert-circle-outline" size={20} color="#FFFFFF" />
          <View style={styles.actionTextWrap}>
            <Text style={styles.actionText}>EXCEPTION</Text>
            <Text style={styles.actionDesc}>Report defect or issue</Text>
          </View>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>RECENT YARD ACTIVITY</Text>
      {recentLogs.length === 0 ? (
        <View style={styles.emptyState}>
          <Icon name="history" size={28} color="#cbd5e1" style={{ marginBottom: 8 }} />
          <Text style={styles.emptyText}>No recent movements recorded yet.</Text>
        </View>
      ) : (
        <View style={styles.logCard}>
          {recentLogs.map((log, index) => (
            <View key={log.id} style={[styles.logItem, index !== recentLogs.length - 1 && styles.logItemBorder]}>
              <Icon name="swap-horizontal" size={16} color="#94a3b8" style={{ marginRight: 10 }} />
              <View style={styles.logContent}>
                <View style={styles.logRow}>
                  <Text style={styles.logStatus}>{log.previousStatus || 'Yard'} to {log.newStatus}</Text>
                  <Text style={styles.logTime}>{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
                <Text style={styles.logLocation}>{log.fromLocationId || 'Yard'} to {log.toLocationId}</Text>
                {log.remarks ? <Text style={styles.logRemarks} numberOfLines={1}>{log.remarks}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      )}
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const enhance = withObservables(['database'], ({ database }: any) => ({
  assets: database.collections.get('assets').query().observe(),
  nsyLocation: database.collections.get('locations').query(Q.where('location_id', 'NSY')).observe(),
  recentLogs: database.collections.get('movement_logs').query(
    Q.sortBy('created_at', Q.desc),
    Q.take(6)
  ).observe(),
}));

export default withDatabase(enhance(YardDashboardBase));

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', padding: 16 },
  banner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#FFFFFF', padding: 14, borderRadius: 10,
    borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16,
  },
  bannerRole: { fontSize: 10, color: '#64748B', fontWeight: '700', letterSpacing: 1 },
  bannerName: { fontSize: 13, color: '#334155', marginTop: 3 },
  bannerNameBold: { fontWeight: '700', color: '#0F172A' },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 6, borderWidth: 1, borderColor: '#BFDBFE',
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#0369A1' },
  sectionTitle: {
    fontSize: 10, fontWeight: '700', color: '#94A3B8',
    letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 20, marginBottom: 10,
  },
  kpiRow: { flexDirection: 'row', gap: 10 },
  kpiCard: {
    flex: 1, backgroundColor: '#FFFFFF', padding: 14,
    borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0',
  },
  kpiWarning: { borderTopWidth: 3, borderTopColor: '#F59E0B' },
  kpiSuccess: { borderTopWidth: 3, borderTopColor: '#10B981' },
  kpiBlue: { borderTopWidth: 3, borderTopColor: '#0A74DA' },
  kpiHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  kpiLabel: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  kpiValue: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
  kpiSub: { fontSize: 11, color: '#94A3B8', marginTop: 3 },
  actionGrid: { gap: 8, marginBottom: 8 },
  actionBtn: { padding: 14, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionTextWrap: { flex: 1 },
  actionText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13, letterSpacing: 0.3 },
  actionDesc: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 1 },
  logCard: {
    backgroundColor: '#FFFFFF', borderRadius: 10,
    borderWidth: 1, borderColor: '#E2E8F0', padding: 4,
  },
  logItem: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, paddingHorizontal: 10 },
  logItemBorder: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  logContent: { flex: 1 },
  logRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logStatus: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  logTime: { fontSize: 11, color: '#94A3B8' },
  logLocation: { fontSize: 11, color: '#475569', marginTop: 2 },
  logRemarks: { fontSize: 11, color: '#94A3B8', fontStyle: 'italic', marginTop: 2 },
  emptyState: {
    backgroundColor: '#FFFFFF', padding: 24, borderRadius: 10,
    alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed',
  },
  emptyText: { color: '#94A3B8', fontSize: 12, fontStyle: 'italic' },
});