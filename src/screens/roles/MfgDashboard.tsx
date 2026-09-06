import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import withObservables from '@nozbe/with-observables';
import { Q } from '@nozbe/watermelondb';
import { database } from '../../database/v2';
import ManufacturingOrder from '../../database/v2/models/ManufacturingOrder';
import Asset from '../../database/v2/models/Asset';
import MovementLog from '../../database/v2/models/MovementLog';
import { useAuth } from '../../context/AuthContext';

const MFG_SHOPS = [
  { id: 'ALL', name: 'All Mfg Units' },
  { id: 'GIF', name: 'GIF (Foundry)' },
  { id: 'BOGIE-MFG', name: 'Bogie Shop' },
  { id: 'WHEEL-MFG', name: 'Wheel Machining' },
  { id: 'FORGE-SHOP', name: 'Heavy Forging' },
];

interface MfgDashboardProps {
  navigation: any;
  orders: ManufacturingOrder[];
  assets: Asset[];
  recentLogs: MovementLog[];
}

function MfgDashboardComponent({ navigation, orders = [], assets = [], recentLogs = [] }: MfgDashboardProps) {
  const { employeeId, assignedLocationId, can } = useAuth();
  const [selectedShop, setSelectedShop] = useState<string>(assignedLocationId || 'GIF');

  const filterShop = selectedShop === 'ALL' ? null : selectedShop;

  // Active in-progress orders
  const inProductionOrders = orders.filter(
    o => o.orderStatus === 'IN_PROGRESS' && (!filterShop || o.manufacturingShopId === filterShop)
  );
  const inProductionCount = inProductionOrders.length;

  // Completed today orders
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const completedTodayCount = orders.filter(
    o => o.orderStatus === 'COMPLETED' && (!filterShop || o.manufacturingShopId === filterShop)
  ).length;

  // Incoming stock allocated to manufacturing shop
  const incomingOrdersCount = assets.filter(
    a => (a.currentStatus === 'Allocated' || a.currentStatus === 'ALLOCATED') &&
         (!filterShop || a.currentLocationId === filterShop)
  ).length;

  // Pending QA assets
  const pendingQACount = assets.filter(
    a => (a.currentStatus === 'PENDING_QA' || a.currentStatus === 'Pending QA') &&
         (!filterShop || a.currentLocationId === filterShop)
  ).length;

  // Relevant movement logs
  const mfgLogs = recentLogs.filter(
    log => log.newStatus === 'IN_MANUFACTURING' || log.newStatus === 'PENDING_QA' ||
           log.newStatus === 'Allocated' || log.newStatus === 'FIT'
  ).slice(0, 5);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Top Officer Banner */}
      <View style={styles.banner}>
        <View>
          <Text style={styles.greeting}>OFFLINE MANUFACTURING CONTROL</Text>
          <Text style={styles.officerName}>
            Supervisor: <Text style={styles.officerNameBold}>{employeeId || 'MFG-SUP'}</Text>
          </Text>
        </View>
        <View style={styles.shopBadge}>
          <Icon name="factory" size={14} color="#059669" />
          <Text style={styles.shopBadgeText}>{selectedShop}</Text>
        </View>
      </View>

      {/* Mfg Shop Selector Chips */}
      <View style={styles.shopSelectorContainer}>
        <Text style={styles.selectorLabel}>MANUFACTURING SHOP / FOUNDRY UNIT</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shopScroll}>
          {MFG_SHOPS.map(shop => {
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
      <Text style={styles.sectionTitle}>[ LIVE PRODUCTION TELEMETRY - {selectedShop} ]</Text>
      <View style={styles.kpiRow}>
        <TouchableOpacity 
          style={[styles.kpiCard, styles.kpiActive]} 
          onPress={() => navigation.navigate('Orders')}
        >
          <View style={styles.kpiHeader}>
            <Icon name="clipboard-list-outline" size={20} color="#0284c7" />
            <Text style={styles.kpiLabel}>Incoming Orders</Text>
          </View>
          <Text style={styles.kpiValue}>{incomingOrdersCount}</Text>
          <Text style={styles.kpiSub}>Awaiting intake</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.kpiCard, styles.kpiProduction]} 
          onPress={() => navigation.navigate('ActiveOrders')}
        >
          <View style={styles.kpiHeader}>
            <Icon name="cog-clockwise" size={20} color="#059669" />
            <Text style={styles.kpiLabel}>In Production</Text>
          </View>
          <Text style={[styles.kpiValue, { color: '#059669' }]}>{inProductionCount}</Text>
          <Text style={styles.kpiSub}>Active fabrication</Text>
        </TouchableOpacity>
      </View>
      
      <View style={[styles.kpiRow, { marginTop: 12 }]}>
        <View style={[styles.kpiCard, styles.kpiCompleted]}>
          <View style={styles.kpiHeader}>
            <Icon name="check-decagram-outline" size={20} color="#16a34a" />
            <Text style={styles.kpiLabel}>Completed Orders</Text>
          </View>
          <Text style={[styles.kpiValue, { color: '#16a34a' }]}>{completedTodayCount}</Text>
          <Text style={styles.kpiSub}>Total closed batch</Text>
        </View>

        <TouchableOpacity 
          style={[styles.kpiCard, styles.kpiQA]} 
          onPress={() => navigation.navigate('PendingQA')}
        >
          <View style={styles.kpiHeader}>
            <Icon name="shield-search" size={20} color="#7c3aed" />
            <Text style={styles.kpiLabel}>Pending QA</Text>
          </View>
          <Text style={[styles.kpiValue, { color: '#7c3aed' }]}>{pendingQACount}</Text>
          <Text style={styles.kpiSub}>Awaiting inspection</Text>
        </TouchableOpacity>
      </View>

      {/* Action Controls */}
      <Text style={styles.sectionTitle}>PRODUCTION FLOOR ACTIONS</Text>
      <View style={styles.actionGrid}>
        {can('mfg:start') && (
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: '#0284c7' }]} 
            onPress={() => navigation.navigate('Orders')}
          >
            <Icon name="factory" size={22} color="#FFFFFF" />
            <View>
              <Text style={styles.actionText}>NEW FABRICATION ORDERS</Text>
              <Text style={styles.actionDesc}>Intake stock & configure specifications</Text>
            </View>
          </TouchableOpacity>
        )}
        
        {can('mfg:start') && (
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: '#059669' }]} 
            onPress={() => navigation.navigate('ActiveOrders')}
          >
            <Icon name="cog" size={22} color="#FFFFFF" />
            <View>
              <Text style={styles.actionText}>ACTIVE PRODUCTION WORK</Text>
              <Text style={styles.actionDesc}>Assembly monitoring & completion</Text>
            </View>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={[styles.actionBtn, { backgroundColor: '#7c3aed' }]} 
          onPress={() => navigation.navigate('PendingQA')}
        >
          <Icon name="shield-check-outline" size={22} color="#FFFFFF" />
          <View>
            <Text style={styles.actionText}>QA INSPECTION HANDOVER</Text>
            <Text style={styles.actionDesc}>Quality clearance certificates</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionBtn, { backgroundColor: '#e11d48' }]} 
          onPress={() => navigation.navigate('ReportException')}
        >
          <Icon name="alert-decagram" size={22} color="#FFFFFF" />
          <View>
            <Text style={styles.actionText}>REPORT PRODUCTION DEFECT</Text>
            <Text style={styles.actionDesc}>Casting blowhole, dimension error or scrap</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Recent Production Movements */}
      <Text style={styles.sectionTitle}>RECENT PRODUCTION LOGS</Text>
      {mfgLogs.length === 0 ? (
        <View style={styles.emptyState}>
          <Icon name="clipboard-text-clock" size={32} color="#cbd5e1" />
          <Text style={styles.emptyText}>No recent production operations recorded.</Text>
        </View>
      ) : (
        <View style={styles.logCard}>
          {mfgLogs.map((log, index) => (
            <View key={log.id} style={[styles.logItem, index !== mfgLogs.length - 1 && styles.logItemBorder]}>
              <View style={styles.logIconCol}>
                <Icon
                  name={
                    log.newStatus === 'IN_MANUFACTURING' ? 'cog' :
                    log.newStatus === 'PENDING_QA' ? 'shield-search' : 'factory'
                  }
                  size={18}
                  color="#059669"
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
                  {log.remarks || `Moved to ${log.toLocationId || 'Manufacturing'}`}
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
  orders: database.collections.get<ManufacturingOrder>('manufacturing_orders').query().observe(),
  assets: database.collections.get<Asset>('assets').query().observe(),
  recentLogs: database.collections.get<MovementLog>('movement_logs')
    .query(Q.sortBy('created_at', Q.desc), Q.take(15))
    .observe(),
}));

export default enhance(MfgDashboardComponent);

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
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  shopBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
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
  kpiProduction: { borderLeftWidth: 4, borderLeftColor: '#10b981' },
  kpiCompleted: { borderLeftWidth: 4, borderLeftColor: '#16a34a' },
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
    elevation: 1,
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
