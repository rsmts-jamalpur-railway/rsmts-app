import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import withObservables from '@nozbe/with-observables';
import { Q } from '@nozbe/watermelondb';
import { database } from '../../database/v2';
import RepairCycle from '../../database/v2/models/RepairCycle';
import Asset from '../../database/v2/models/Asset';
import MovementLog from '../../database/v2/models/MovementLog';
import { useAuth } from '../../context/AuthContext';

const REPAIR_SHOPS = [
  { id: 'ALL', name: 'All Shops' },
  { id: 'WRS-1', name: 'WRS-1 (POH)' },
  { id: 'WRS-2', name: 'WRS-2 (Rehab)' },
  { id: 'WRS-3', name: 'WRS-3 (Underframe)' },
  { id: 'WRS-4', name: 'WRS-4 (Bogie)' },
  { id: 'DPS', name: 'DPS (Diesel Loco)' },
];

interface RepairDashboardProps {
  navigation: any;
  repairCycles: RepairCycle[];
  assets: Asset[];
  recentLogs: MovementLog[];
}

function RepairDashboardComponent({ navigation, repairCycles = [], assets = [], recentLogs = [] }: RepairDashboardProps) {
  const { employeeId, assignedLocationId, can, role } = useAuth();
  const [selectedShop, setSelectedShop] = useState<string>(assignedLocationId || 'WRS-1');

  const filterShop = selectedShop === 'ALL' ? null : selectedShop;

  // Filter repair cycles for selected shop
  const activeRepairsCount = repairCycles.filter(
    c => c.status === 'IN_PROGRESS' && (!filterShop || c.repairShopId === filterShop)
  ).length;

  const onHoldCount = repairCycles.filter(
    c => c.status === 'ON_HOLD' && (!filterShop || c.repairShopId === filterShop)
  ).length;

  // Filter assets for incoming and pending QA
  const incomingCount = assets.filter(
    a => (a.currentStatus === 'Allocated' || a.currentStatus === 'ALLOCATED') &&
         (!filterShop || a.currentLocationId === filterShop)
  ).length;

  const pendingQACount = assets.filter(
    a => (a.currentStatus === 'PENDING_QA' || a.currentStatus === 'Pending QA') &&
         (!filterShop || a.currentLocationId === filterShop || a.currentLocationId === 'YARD')
  ).length;

  // Filter recent logs relevant to repair (only valid backend statuses)
  const repairLogs = recentLogs.filter(
    log => log.newStatus === 'IN_REPAIR' || log.newStatus === 'REPAIR_ON_HOLD' ||
           log.newStatus === 'ALLOCATED' || log.newStatus === 'PENDING_QA'
  ).slice(0, 5);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Top Banner */}
      <View style={styles.banner}>
        <View>
          <Text style={styles.greeting}>OFFLINE REPAIR CONTROLLER</Text>
          <Text style={styles.officerName}>
            Supervisor: <Text style={styles.officerNameBold}>{employeeId || 'SUPERVISOR'}</Text>
          </Text>
        </View>
        <View style={styles.shopBadge}>
          <Icon name="wrench" size={14} color="#0369a1" />
          <Text style={styles.shopBadgeText}>{selectedShop}</Text>
        </View>
      </View>

      {/* Shop Selector Chips */}
      <View style={styles.shopSelectorContainer}>
        <Text style={styles.selectorLabel}>ACTIVE WORKSHOP NODE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shopScroll}>
          {REPAIR_SHOPS.map(shop => {
            const isSelected = selectedShop === shop.id;
            return (
              <TouchableOpacity
                key={shop.id}
                style={[styles.shopChip, isSelected && styles.shopChipActive]}
                onPress={() => setSelectedShop(shop.id)}
              >
                <Text style={[styles.shopChipText, isSelected && styles.shopChipTextActive]}>
                  {shop.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Live Operational Metrics */}
      <Text style={styles.sectionTitle}>LIVE SHOP TELEMETRY — {selectedShop}</Text>
      <View style={styles.kpiRow}>
        <TouchableOpacity 
          style={[styles.kpiCard, styles.kpiActive]} 
          onPress={() => navigation.navigate('ActiveRepairs')}
        >
          <View style={styles.kpiHeader}>
            <Icon name="wrench-clock" size={20} color="#0284c7" />
            <Text style={styles.kpiLabel}>Active Repairs</Text>
          </View>
          <Text style={styles.kpiValue}>{activeRepairsCount}</Text>
          <Text style={styles.kpiSub}>Under overhaul</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.kpiCard, styles.kpiHold]} 
          onPress={() => navigation.navigate('OnHold')}
        >
          <View style={styles.kpiHeader}>
            <Icon name="pause-circle-outline" size={20} color="#d97706" />
            <Text style={styles.kpiLabel}>On Hold</Text>
          </View>
          <Text style={[styles.kpiValue, { color: '#b45309' }]}>{onHoldCount}</Text>
          <Text style={styles.kpiSub}>Material / Parts</Text>
        </TouchableOpacity>
      </View>
      
      <View style={[styles.kpiRow, { marginTop: 12 }]}>
        <TouchableOpacity 
          style={[styles.kpiCard, styles.kpiIncoming]} 
          onPress={() => navigation.navigate('Incoming')}
        >
          <View style={styles.kpiHeader}>
            <Icon name="inbox-arrow-down" size={20} color="#059669" />
            <Text style={styles.kpiLabel}>Incoming</Text>
          </View>
          <Text style={[styles.kpiValue, { color: '#059669' }]}>{incomingCount}</Text>
          <Text style={styles.kpiSub}>Allocated by Yard</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.kpiCard, styles.kpiQA]} 
          onPress={() => navigation.navigate('PendingQA')}
        >
          <View style={styles.kpiHeader}>
            <Icon name="shield-search" size={20} color="#7c3aed" />
            <Text style={styles.kpiLabel}>Pending QA</Text>
          </View>
          <Text style={[styles.kpiValue, { color: '#7c3aed' }]}>{pendingQACount}</Text>
          <Text style={styles.kpiSub}>Awaiting verdict</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Action Grid */}
      <Text style={styles.sectionTitle}>SHOP FLOOR CONTROLS</Text>
      <View style={styles.actionGrid}>
        {can('repair:start') && (
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: '#0284c7' }]} 
            onPress={() => navigation.navigate('Incoming')}
          >
            <Icon name="inbox-arrow-down" size={22} color="#FFFFFF" />
            <View>
              <Text style={styles.actionText}>INCOMING ALLOCATIONS</Text>
              <Text style={styles.actionDesc}>Accept stock & assign category</Text>
            </View>
          </TouchableOpacity>
        )}
        
        {can('repair:start') && (
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: '#0f766e' }]} 
            onPress={() => navigation.navigate('ActiveRepairs')}
          >
            <Icon name="wrench" size={22} color="#FFFFFF" />
            <View>
              <Text style={styles.actionText}>ACTIVE REPAIRS</Text>
              <Text style={styles.actionDesc}>Stage progression & completion</Text>
            </View>
          </TouchableOpacity>
        )}

        {can('repair:resume') && (
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: '#d97706' }]} 
            onPress={() => navigation.navigate('OnHold')}
          >
            <Icon name="pause-circle-outline" size={22} color="#FFFFFF" />
            <View>
              <Text style={styles.actionText}>ON-HOLD QUEUE</Text>
              <Text style={styles.actionDesc}>Review bottlenecks & resume</Text>
            </View>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={[styles.actionBtn, { backgroundColor: '#7c3aed' }]} 
          onPress={() => navigation.navigate('PendingQA')}
        >
          <Icon name="shield-check-outline" size={22} color="#FFFFFF" />
          <View>
            <Text style={styles.actionText}>QA HANDOVER STATUS</Text>
            <Text style={styles.actionDesc}>Inspect passed & rework items</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionBtn, { backgroundColor: '#e11d48' }]} 
          onPress={() => navigation.navigate('ReportException')}
        >
          <Icon name="alert-decagram" size={22} color="#FFFFFF" />
          <View>
            <Text style={styles.actionText}>REPORT SHOP EXCEPTION</Text>
            <Text style={styles.actionDesc}>Defect, missing parts or condemnation</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Live Recent Repair Activity */}
      <Text style={styles.sectionTitle}>RECENT SHOP MOVEMENTS</Text>
      {repairLogs.length === 0 ? (
        <View style={styles.emptyState}>
          <Icon name="clipboard-text-clock" size={32} color="#cbd5e1" />
          <Text style={styles.emptyText}>No recent movements recorded for this shop.</Text>
        </View>
      ) : (
        <View style={styles.logCard}>
          {repairLogs.map((log, index) => (
            <View key={log.id} style={[styles.logItem, index !== repairLogs.length - 1 && styles.logItemBorder]}>
              <View style={styles.logIconCol}>
                <Icon
                  name={
                    log.newStatus === 'IN_REPAIR' ? 'wrench' :
                    log.newStatus === 'REPAIR_ON_HOLD' ? 'pause-circle' :
                    log.newStatus === 'PENDING_QA' ? 'shield-check' : 'swap-horizontal'
                  }
                  size={18}
                  color="#0284c7"
                />
              </View>
              <View style={styles.logContent}>
                <View style={styles.logRow}>
                  <Text style={styles.logStatus}>{log.newStatus}</Text>
                  <Text style={styles.logTime}>
                    {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <Text style={styles.logRemarks} numberOfLines={1}>
                  {log.remarks || `Moved to ${log.toLocationId || 'Shop'}`}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const enhance = withObservables([], () => ({
  repairCycles: database.collections.get<RepairCycle>('repair_cycles').query().observe(),
  assets: database.collections.get<Asset>('assets').query().observe(),
  recentLogs: database.collections.get<MovementLog>('movement_logs')
    .query(Q.sortBy('created_at', Q.desc), Q.take(15))
    .observe(),
}));

export default enhance(RepairDashboardComponent);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  banner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  greeting: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  officerName: {
    fontSize: 13,
    color: '#334155',
    marginTop: 2,
  },
  officerNameBold: {
    fontWeight: '700',
    color: '#0f172a',
  },
  shopBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  shopBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369a1',
  },
  shopSelectorContainer: {
    marginBottom: 16,
  },
  selectorLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
    letterSpacing: 0.4,
  },
  shopScroll: {
    flexDirection: 'row',
  },
  shopChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
  },
  shopChipActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  shopChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  shopChipTextActive: {
    color: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 10,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  kpiActive: { borderLeftWidth: 4, borderLeftColor: '#0284c7' },
  kpiHold: { borderLeftWidth: 4, borderLeftColor: '#f59e0b' },
  kpiIncoming: { borderLeftWidth: 4, borderLeftColor: '#10b981' },
  kpiQA: { borderLeftWidth: 4, borderLeftColor: '#8b5cf6' },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  kpiLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  kpiSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  actionGrid: {
    gap: 10,
    marginBottom: 16,
  },
  actionBtn: {
    padding: 14,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  actionText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  actionDesc: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    marginTop: 2,
  },
  logCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  logItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  logIconCol: {
    marginRight: 10,
  },
  logContent: {
    flex: 1,
  },
  logRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logStatus: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  logTime: {
    fontSize: 11,
    color: '#94a3b8',
  },
  logRemarks: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 6,
    fontStyle: 'italic',
  }
});
