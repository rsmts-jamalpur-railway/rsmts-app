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
  const awaitingAllocation = assets.filter(a => a.currentStatus === 'RECEIVED_IN_YARD' || a.currentStatus === 'NSY IN').length;
  const readyForDispatch = assets.filter(a => a.currentStatus === 'FIT').length;
  const inRepairCount = assets.filter(a => a.currentStatus === 'IN_REPAIR' || a.currentStatus === 'Allocated').length;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.greeting}>GOOD DAY, {employeeId || 'YARD MASTER'}</Text>
      <Text style={styles.sectionTitle}>[ YARD OPERATIONS - NSY ]</Text>

      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>NSY Occupancy</Text>
          <Text style={styles.kpiValue}>{inYardCount} / {nsyCap}</Text>
          <Text style={styles.kpiSub}>{Math.round((inYardCount / (nsyCap || 1)) * 100)}% Capacity Used</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Awaiting Allocation</Text>
          <Text style={[styles.kpiValue, { color: '#f59e0b' }]}>{awaitingAllocation}</Text>
          <Text style={styles.kpiSub}>In NSY Intake</Text>
        </View>
      </View>

      <View style={[styles.kpiRow, { marginTop: 12 }]}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Ready for Dispatch</Text>
          <Text style={[styles.kpiValue, { color: '#10b981' }]}>{readyForDispatch}</Text>
          <Text style={styles.kpiSub}>QA Cleared (Fit)</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>In Workshop / Repair</Text>
          <Text style={[styles.kpiValue, { color: '#0A74DA' }]}>{inRepairCount}</Text>
          <Text style={styles.kpiSub}>Active in Shops</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
      <View style={styles.actionGrid}>
        {can('yard:receive') && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('NSYIn')}>
            <Icon name="train" size={24} color="#FFFFFF" />
            <Text style={styles.actionText}>NSY IN</Text>
          </TouchableOpacity>
        )}
        
        {can('yard:allocate') && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Allocate')}>
            <Icon name="swap-horizontal" size={24} color="#FFFFFF" />
            <Text style={styles.actionText}>ALLOCATE</Text>
          </TouchableOpacity>
        )}

        {can('yard:dispatch') && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('NSYOut')}>
            <Icon name="arrow-up-circle-outline" size={24} color="#FFFFFF" />
            <Text style={styles.actionText}>NSY OUT</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#ef4444' }]} onPress={() => navigation.navigate('ReportException')}>
          <Icon name="alert-circle-outline" size={24} color="#FFFFFF" />
          <Text style={styles.actionText}>EXCEPTION</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>RECENT YARD ACTIVITY</Text>
      {recentLogs.length === 0 ? (
        <View style={styles.emptyState}>
          <Icon name="history" size={32} color="#cbd5e1" style={{ marginBottom: 8 }} />
          <Text style={styles.emptyText}>No recent movements recorded yet.</Text>
        </View>
      ) : (
        recentLogs.map((log) => (
          <View key={log.id} style={styles.activityCard}>
            <View style={styles.activityHeader}>
              <Text style={styles.activityStatus}>{log.previousStatus || 'Yard'} ➜ {log.newStatus}</Text>
              <Text style={styles.activityTime}>{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
            <Text style={styles.activityLocation}>{log.fromLocationId || 'Yard'} ➜ {log.toLocationId}</Text>
            {log.remarks ? <Text style={styles.activityRemarks}>{log.remarks}</Text> : null}
          </View>
        ))
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
    Q.take(5)
  ).observe(),
}));

export default withDatabase(enhance(YardDashboardBase));

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    padding: 16,
  },
  greeting: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 24,
    marginBottom: 12,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  kpiLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  kpiSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionBtn: {
    backgroundColor: '#0A74DA',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 140,
  },
  actionText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  emptyText: {
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  activityCard: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  activityStatus: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  activityTime: {
    fontSize: 11,
    color: '#94a3b8',
  },
  activityLocation: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  activityRemarks: {
    fontSize: 11,
    color: '#64748b',
    fontStyle: 'italic',
    marginTop: 4,
  },
});
