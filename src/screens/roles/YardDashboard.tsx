import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../context/AuthContext';
import { withDatabase } from '@nozbe/watermelondb/DatabaseProvider';
import withObservables from '@nozbe/with-observables';
import { Q } from '@nozbe/watermelondb';
import Asset from '../../database/v2/models/Asset';
import Location from '../../database/v2/models/Location';
import MovementLog from '../../database/v2/models/MovementLog';
import { SyncEngine } from '../../database/v2/sync';

interface YardDashboardProps {
  navigation: any;
  assets?: Asset[];
  nsyLocation?: Location[];
  recentLogs?: MovementLog[];
}

function YardDashboardBase({ navigation, assets = [], nsyLocation = [], recentLogs = [] }: YardDashboardProps) {
  const { employeeId, can } = useAuth();
  const [refreshing, setRefreshing] = React.useState(false);
  const [expandedLogId, setExpandedLogId] = React.useState<string | null>(null);

  const nsyCap = nsyLocation.length > 0 ? nsyLocation[0].maxCapacity : 500;
  const inYardCount = assets.filter(a => a.currentLocationId === 'NSY' || a.currentLocationId === 'YARD').length;
  const awaitingAllocation = assets.filter(a => a.currentStatus === 'RECEIVED_IN_YARD').length;
  const readyForDispatch = assets.filter(a => a.currentStatus === 'FIT').length;
  const inRepairCount = assets.filter(a => a.currentStatus === 'IN_REPAIR').length;

  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await SyncEngine.sync();
    } catch (error) {
      console.error('Manual sync failed:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      {/* Yard Status Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Yard Status</Text>
        <View style={styles.realtimeBadge}>
          <View style={styles.activeDot} />
          <Text style={styles.realtimeText}>Real-time</Text>
        </View>
      </View>

      {/* Yard Status 2x2 Metric Grid */}
      <View style={styles.grid}>
        {/* Metric 1: NSY Occupancy */}
        <View style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <Text style={styles.metricTitle}>NSY OCCUPANCY</Text>
            <View style={styles.metricIconBoxPrimary}>
              <Icon name="warehouse" size={18} color="#003c90" />
            </View>
          </View>
          <View>
            <Text style={styles.metricValue}>{inYardCount} <Text style={styles.metricValueLight}>/ {nsyCap}</Text></Text>
            <Text style={styles.metricSub}>{Math.round((inYardCount / (nsyCap || 1)) * 100)}% capacity used</Text>
          </View>
        </View>

        {/* Metric 2: Awaiting Allocation */}
        <View style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <Text style={[styles.metricTitle, { color: '#78350f' }]}>AWAITING ALLOCATION</Text>
            <View style={styles.metricIconBoxAmber}>
              <Icon name="tray-arrow-down" size={18} color="#d97706" />
            </View>
          </View>
          <View>
            <Text style={[styles.metricValue, { color: '#d97706' }]}>{awaitingAllocation}</Text>
            <Text style={styles.metricSub}>In NSY intake</Text>
          </View>
        </View>

        {/* Metric 3: Ready for Dispatch */}
        <View style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <Text style={[styles.metricTitle, { color: '#006a63' }]}>READY FOR DISPATCH</Text>
            <View style={styles.metricIconBoxSecondary}>
              <Icon name="check-circle" size={18} color="#006a63" />
            </View>
          </View>
          <View>
            <Text style={[styles.metricValue, { color: '#006a63' }]}>{readyForDispatch}</Text>
            <Text style={styles.metricSub}>QA cleared (FIT)</Text>
          </View>
        </View>

        {/* Metric 4: In Workshop */}
        <View style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <Text style={[styles.metricTitle, { color: '#003c90' }]}>IN WORKSHOP</Text>
            <View style={styles.metricIconBoxPrimary}>
              <Icon name="wrench" size={18} color="#003c90" />
            </View>
          </View>
          <View>
            <Text style={[styles.metricValue, { color: '#003c90' }]}>{inRepairCount}</Text>
            <Text style={styles.metricSub}>Active in shops</Text>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live Yard Active</Text>
        </View>
      </View>

      <View style={styles.actionList}>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#0f52ba' }]} onPress={() => navigation.navigate('NSYIn')}>
          <View style={styles.actionIconOuter}>
            <Icon name="train" size={28} color="#ffffff" />
          </View>
          <View style={styles.actionTextCol}>
            <Text style={styles.actionTitle}>NSY IN</Text>
            <Text style={styles.actionSub}>Record new arrival</Text>
          </View>
          <Icon name="chevron-right" size={24} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#006a63' }]} onPress={() => navigation.navigate('Allocate')}>
          <View style={styles.actionIconOuter}>
            <Icon name="swap-horizontal" size={28} color="#ffffff" />
          </View>
          <View style={styles.actionTextCol}>
            <Text style={styles.actionTitle}>ALLOCATE</Text>
            <Text style={styles.actionSub}>Send to repair shop</Text>
          </View>
          <Icon name="chevron-right" size={24} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#003c90' }]} onPress={() => navigation.navigate('NSYOut')}>
          <View style={styles.actionIconOuter}>
            <Icon name="arrow-up-circle" size={28} color="#ffffff" />
          </View>
          <View style={styles.actionTextCol}>
            <Text style={styles.actionTitle}>NSY OUT</Text>
            <Text style={styles.actionSub}>Dispatch FIT assets</Text>
          </View>
          <Icon name="chevron-right" size={24} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#b20033' }]} onPress={() => navigation.navigate('ReportException')}>
          <View style={styles.actionIconOuter}>
            <Icon name="alert-circle" size={28} color="#ffffff" />
          </View>
          <View style={styles.actionTextCol}>
            <Text style={styles.actionTitle}>EXCEPTION</Text>
            <Text style={styles.actionSub}>Report defect or issue</Text>
          </View>
          <Icon name="chevron-right" size={24} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>

      {/* Recent Yard Activity */}
      <View style={styles.sectionHeader}>
        <View style={styles.infoTextRow}>
          <Text style={styles.sectionTitle}>Recent Yard Activity</Text>
          <View style={styles.autoRefreshDot} />
          <Text style={styles.autoRefreshText}>Auto-refresh</Text>
        </View>
        <TouchableOpacity style={styles.viewLogBtn} onPress={handleRefresh}>
          <Icon name="history" size={14} color="#003c90" />
          <Text style={styles.viewLogText}>View Log</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.activityList}>
        {recentLogs.length === 0 ? (
           <View style={{ padding: 20, alignItems: 'center' }}>
             <Text style={{ color: '#737784', fontStyle: 'italic' }}>No recent movements recorded yet.</Text>
           </View>
        ) : (
          recentLogs.map((log, index) => {
            const asset = assets.find(a => a.id === log.assetId);
            const assetDisplay = asset ? asset.assetNumber : log.assetId;
            return (
            <View key={log.id}>
              <TouchableOpacity style={styles.activityItem} onPress={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}>
                <View style={styles.activityIconBox}>
                  <Icon name="swap-horizontal" size={20} color="#003c90" />
                </View>
                <View style={styles.activityTextCol}>
                  <View style={styles.activityItemHeader}>
                    <Text style={styles.activityItemTitle} numberOfLines={1}>Asset {assetDisplay}: {log.previousStatus || 'Yard'} to {log.newStatus}</Text>
                    <Text style={styles.activityItemTime}>{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                  <Text style={styles.activityItemSub} numberOfLines={1}>{log.fromLocationId || 'YARD'} to {log.toLocationId}</Text>
                  
                  <View style={styles.activityTagRow}>
                    <View style={styles.activityTag}>
                      <View style={styles.activeDot} />
                      <Text style={styles.activityTagText}>{log.newStatus}</Text>
                    </View>
                    <Text style={styles.activitySynced}>Synced</Text>
                    <Icon name={expandedLogId === log.id ? "chevron-up" : "chevron-down"} size={16} color="#434653" style={{marginLeft: 'auto'}} />
                  </View>
                </View>
              </TouchableOpacity>
              
              {expandedLogId === log.id && (
                <View style={styles.expandedDetails}>
                  {asset ? (
                    <>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Asset Category:</Text>
                        <Text style={styles.detailValue}>{asset.assetCategory || 'WAGON'}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Current Track:</Text>
                        <Text style={styles.detailValue}>{asset.currentLocationId}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Current Status:</Text>
                        <Text style={styles.detailValue}>{asset.currentStatus}</Text>
                      </View>
                    </>
                  ) : (
                    <Text style={styles.detailLabel}>Asset details currently unavailable.</Text>
                  )}
                  {log.remarks ? (
                    <View style={[styles.detailRow, { marginTop: 8 }]}>
                      <Text style={styles.detailLabel}>Remarks:</Text>
                      <Text style={styles.detailValue}>{log.remarks}</Text>
                    </View>
                  ) : null}
                </View>
              )}
              {index < recentLogs.length - 1 && <View style={styles.divider} />}
            </View>
            );
          })
        )}
      </View>
      
      <View style={{ height: 40 }} />
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
  container: { flex: 1, backgroundColor: '#faf8ff' },
  content: { padding: 16, paddingTop: 16 },
  
  infoCard: { backgroundColor: '#ffffff', borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(195,198,213,0.3)', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  infoIconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#e2e7ff', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  infoTextCol: { flex: 1 },
  infoTextRow: { flexDirection: 'row', alignItems: 'center' },
  infoLabel: { fontSize: 11, fontWeight: '700', color: '#434653', letterSpacing: 0.8 },
  infoDot: { color: '#c3c6d5', fontSize: 11, marginHorizontal: 4 },
  infoRole: { fontSize: 11, fontWeight: '700', color: '#006a63' },
  infoUUID: { fontSize: 11, fontWeight: '600', color: '#131b2e', fontFamily: 'monospace', marginLeft: 4 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#99efe5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#006a63', marginRight: 4 },
  activeBadgeText: { fontSize: 11, fontWeight: '700', color: '#006f67' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#434653', letterSpacing: 0.8, textTransform: 'uppercase' },
  realtimeBadge: { flexDirection: 'row', alignItems: 'center' },
  realtimeText: { fontSize: 11, fontWeight: '500', color: '#434653', textTransform: 'uppercase', letterSpacing: -0.2 },
  
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 },
  metricCard: { width: '48%', backgroundColor: '#ffffff', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(195,198,213,0.2)', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1, minHeight: 104, justifyContent: 'space-between' },
  metricHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  metricTitle: { fontSize: 11, fontWeight: '700', color: '#434653', flex: 1, marginRight: 4 },
  metricIconBoxPrimary: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#e2e7ff', alignItems: 'center', justifyContent: 'center' },
  metricIconBoxAmber: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center' },
  metricIconBoxSecondary: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#99efe5', alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontSize: 22, fontWeight: '700', color: '#131b2e' },
  metricValueLight: { fontSize: 12, fontWeight: '400', color: '#434653' },
  metricSub: { fontSize: 11, color: '#434653', marginTop: 2 },

  liveBadge: { flexDirection: 'row', alignItems: 'center' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#80d5cb', marginRight: 4 },
  liveText: { fontSize: 11, fontWeight: '700', color: '#003c90', textTransform: 'uppercase', letterSpacing: -0.2 },

  actionList: { marginBottom: 24, gap: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', height: 76, paddingHorizontal: 16, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2, marginBottom: 10 },
  actionIconOuter: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  actionTextCol: { flex: 1 },
  actionTitle: { fontSize: 18, fontWeight: '700', color: '#ffffff', letterSpacing: 0.36 },
  actionSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },

  autoRefreshDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#c3c6d5', marginHorizontal: 6 },
  autoRefreshText: { fontSize: 11, fontWeight: '500', color: '#434653' },
  viewLogBtn: { flexDirection: 'row', alignItems: 'center' },
  viewLogText: { fontSize: 11, fontWeight: '700', color: '#003c90', textTransform: 'uppercase', marginLeft: 4 },

  activityList: { backgroundColor: '#ffffff', borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  activityItem: { flexDirection: 'row', alignItems: 'flex-start', padding: 14 },
  activityIconBox: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#e2e7ff', alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 },
  activityTextCol: { flex: 1 },
  activityItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 },
  activityItemTitle: { fontSize: 15, fontWeight: '600', color: '#131b2e', flex: 1 },
  activityItemTime: { fontSize: 11, fontWeight: '500', color: '#434653' },
  activityItemSub: { fontSize: 12, color: '#434653' },
  activityTagRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  activityTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e2e7ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginRight: 6 },
  activityTagText: { fontSize: 11, fontWeight: '600', color: '#434653' },
  activitySynced: { fontSize: 10, fontWeight: '700', color: '#434653', textTransform: 'uppercase', letterSpacing: 0.8 },
  divider: { height: 1, backgroundColor: '#eaedff', marginHorizontal: 14 },
  expandedDetails: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    marginLeft: 48,
    marginTop: -4,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748b',
    width: 100,
  },
  detailValue: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '500',
    flex: 1,
  }
});