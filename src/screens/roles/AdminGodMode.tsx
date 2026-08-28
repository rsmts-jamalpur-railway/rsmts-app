import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal } from 'react-native';
import { withDatabase } from '@nozbe/watermelondb/DatabaseProvider';
import withObservables from '@nozbe/with-observables';
import { Q } from '@nozbe/watermelondb';
import Asset from '../../database/models/Asset';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Header from '../../components/Header';
import SearchWagon from '../common/SearchWagon';
import { useAuth } from '../../context/AuthContext';
import { useLocations } from '../../hooks/useLocations';

const Tab = createBottomTabNavigator();

const ExceptionsList = ({ assets, onResolve }: { assets: Asset[], onResolve: (asset: Asset, status: string) => void }) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>Action Required</Text>
    
    {assets.map(asset => (
      <View key={asset.id} style={styles.exceptionCard}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemTitle}>{asset.asset_number}</Text>
          <Text style={asset.current_status === 'Missing' ? styles.statusBadgeDanger : styles.statusBadgeWarning}>
            {asset.current_status.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.itemSub}>Last Known Shop: {asset.allocated_shop || 'N/A'}</Text>
        <Text style={styles.itemSub}>Repair Category: {asset.repair_category || 'Unknown'}</Text>

        <View style={styles.buttonRow}>
          {asset.current_status === 'Missing' ? (
            <>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => onResolve(asset, 'Re-route')}>
                <Text style={styles.btnText}>FORCE RE-ROUTE</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.successBtn} onPress={() => onResolve(asset, 'Shop In')}>
                <Text style={styles.btnText}>MARK FOUND (SHOP)</Text>
              </TouchableOpacity>
            </>
          ) : asset.current_status === 'Condemned' ? (
            <TouchableOpacity style={styles.dangerBtn} onPress={() => onResolve(asset, 'Scrapped')}>
              <Text style={styles.btnText}>APPROVE CONDEMNATION</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.successBtn} onPress={() => onResolve(asset, 'Shop In')}>
              <Text style={styles.btnText}>RELEASE HOLD</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    ))}
    {assets.length === 0 && <Text style={styles.subtitle}>No exceptions found. System is healthy.</Text>}
  </View>
);

const ObservableExceptionsList = withObservables(['database'], ({ database }) => ({
  assets: database.collections.get('assets').query(Q.where('current_status', Q.oneOf(['Missing', 'Condemned', 'Hold']))).observe(),
}))(ExceptionsList);

function AdminExceptionsScreen({ database, handleResolve }: any) {
  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.container}>
      <ObservableExceptionsList database={database} onResolve={handleResolve} />
    </ScrollView>
  );
}

const TimelineList = ({ logs }: { logs: any[] }) => {
  if (logs.length === 0) {
    return <Text style={styles.subtitle}>No movement history found.</Text>;
  }
  return (
    <ScrollView style={{ maxHeight: 400 }}>
      {logs.map((log, index) => (
        <View key={log.id} style={{ flexDirection: 'row', marginBottom: 16 }}>
          <View style={{ width: 2, backgroundColor: '#E2E8F0', marginRight: 16, alignItems: 'center' }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#3B82F6', marginTop: 4, transform: [{ translateX: -5 }] }} />
          </View>
          <View style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 6, borderWidth: 1, borderColor: '#E2E8F0' }}>
            <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>{new Date(log.timestamp).toLocaleString()}</Text>
            <Text style={{ fontSize: 14, color: '#0F172A', fontWeight: '600' }}>{log.previous_status || 'Start'} ➜ {log.new_status}</Text>
            <Text style={{ fontSize: 13, color: '#334155', marginTop: 4 }}>{log.from_location || 'Unknown'} ➜ {log.to_location}</Text>
            {log.remarks && <Text style={{ fontSize: 12, color: '#64748B', marginTop: 8, fontStyle: 'italic' }}>"{log.remarks}"</Text>}
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

const ObservableTimelineList = withObservables(['assetNumber', 'database'], ({ assetNumber, database }) => ({
  logs: database.collections.get('movement_logs').query(
    Q.where('asset_number', assetNumber),
    Q.sortBy('timestamp', Q.desc)
  ).observe()
}))(TimelineList);

const AllAssetsList = ({ assets, openTimeline }: { assets: Asset[], openTimeline: (asset: Asset) => void }) => (
  <View style={styles.resultsContainer}>
    {assets.map(asset => (
      <TouchableOpacity key={asset.id} style={styles.resultCard} onPress={() => openTimeline(asset)}>
        <View style={styles.resultHeader}>
          <Text style={styles.resultTitle}>{asset.asset_number}</Text>
          <View style={[styles.badge, asset.is_active ? styles.badgeActive : styles.badgeInactive]}>
            <Text style={styles.badgeText}>{asset.is_active ? 'ACTIVE' : 'DISPATCHED'}</Text>
          </View>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Location:</Text>
          <Text style={styles.detailValue}>{asset.current_location}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Status:</Text>
          <Text style={styles.detailValue}>{asset.current_status}</Text>
        </View>
        <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 8, textAlign: 'right' }}>Tap to view timeline</Text>
      </TouchableOpacity>
    ))}
    {assets.length === 0 && <Text style={styles.subtitle}>No assets found in system.</Text>}
  </View>
);

const ObservableAllAssets = withObservables(['database'], ({ database }) => ({
  assets: database.collections.get('assets').query(Q.sortBy('updatedAt', Q.desc)).observe(),
}))(AllAssetsList);

function AdminAllAssetsScreen({ database, openTimeline }: any) {
  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.container}>
      <Text style={styles.cardTitle}>Global Asset Directory</Text>
      <ObservableAllAssets database={database} openTimeline={openTimeline} />
    </ScrollView>
  );
}

function AdminGodModeBase({ database }: any) {
  const { userId } = useAuth();
  const [routeModal, setRouteModal] = useState(false);
  const [timelineModal, setTimelineModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const { locations } = useLocations({ is_parking_line: false });

  const handleResolveAction = (asset: Asset, action: string) => {
    if (action === 'Re-route') {
      setSelectedAsset(asset);
      setRouteModal(true);
    } else {
      executeResolution(asset, action, null);
    }
  };

  const openTimeline = (asset: Asset) => {
    setSelectedAsset(asset);
    setTimelineModal(true);
  };

  const executeResolution = async (asset: Asset, action: string, targetShop: string | null) => {
    if (!userId) return;
    try {
      await database.write(async () => {
        let newStatus = action;
        if (action === 'Re-route' && targetShop) {
           newStatus = 'Allocated';
        }

        const previousStatus = asset.current_status;

        await asset.update((a: any) => { 
          a.current_status = newStatus;
          if (newStatus === 'Allocated' && targetShop) {
            a.allocated_shop = targetShop;
          }
        });

        await database.collections.get('movement_logs').create((log: any) => {
          log.asset_number = asset.asset_number;
          log.from_location = asset.allocated_shop || 'Unknown';
          log.to_location = (newStatus === 'Allocated' && targetShop) ? targetShop : (newStatus === 'Scrapped' ? 'Scrapped' : (asset.allocated_shop || 'Shop'));
          log.previous_status = previousStatus;
          log.new_status = newStatus;
          log.handled_by = userId;
          log.is_offline_entry = true;
          log.timestamp = new Date().getTime();
          log.remarks = action === 'Re-route' ? `Admin Force Re-Routed to ${targetShop}` : `Admin Resolved Exception: ${previousStatus} -> ${newStatus}`;
        });
      });
      if (action === 'Re-route') {
        setRouteModal(false);
        setSelectedAsset(null);
      }
      Alert.alert('Success', `Action taken. Status updated.`);
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  return (
    <>
      <Tab.Navigator
        screenOptions={({ route }) => ({
        header: () => <Header role="Administrator" />,
        tabBarIcon: ({ color, size }) => {
          let iconName = 'shield-account';
          if (route.name === 'Exceptions') iconName = 'alert-octagon';
          else if (route.name === 'All Assets') iconName = 'view-list';
          else if (route.name === 'Search') iconName = 'magnify';
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#ef4444',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0',
          paddingBottom: 8,
          paddingTop: 8,
          height: 70,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarLabelStyle: {
          fontWeight: '700',
        }
      })}
    >
      <Tab.Screen name="Exceptions">
        {() => <AdminExceptionsScreen database={database} handleResolve={handleResolveAction} />}
      </Tab.Screen>
      <Tab.Screen name="All Assets">
        {() => <AdminAllAssetsScreen database={database} openTimeline={openTimeline} />}
      </Tab.Screen>
      <Tab.Screen name="Search">
        {() => <SearchWagon database={database} />}
      </Tab.Screen>
    </Tab.Navigator>

      <Modal visible={routeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Force Re-route: {selectedAsset?.asset_number}</Text>
            <Text style={styles.subtitle}>Select the NEW destination repair shop for this missing wagon:</Text>
            
            <View style={styles.shopGrid}>
              {locations.map(shop => (
                <TouchableOpacity key={shop.location_id} style={styles.shopBtn} onPress={() => {
                  if (selectedAsset) executeResolution(selectedAsset, 'Re-route', shop.location_id);
                }}>
                  <Text style={styles.shopBtnText}>{shop.location_id}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setRouteModal(false)}>
              <Text style={styles.cancelBtnText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={timelineModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Timeline: {selectedAsset?.asset_number}</Text>
            {selectedAsset ? (
              <ObservableTimelineList database={database} assetNumber={selectedAsset.asset_number} />
            ) : null}
            <TouchableOpacity style={[styles.cancelBtn, { marginTop: 16 }]} onPress={() => setTimelineModal(false)}>
              <Text style={styles.cancelBtnText}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

export default withDatabase(AdminGodModeBase);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { padding: 16, backgroundColor: '#FFFFFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }, 
  headerTitle: { color: '#EF4444', fontSize: 16, fontWeight: '700', letterSpacing: 1 }, 
  badge: { backgroundColor: '#EF4444', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  
  content: { padding: 16 },
  card: { backgroundColor: '#FFFFFF', padding: 20, marginBottom: 16, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' }, 
  cardTitle: { color: '#0F172A', fontSize: 16, fontWeight: '700', marginBottom: 16 },
  subtitle: { color: '#64748B', marginBottom: 16, fontSize: 13 },
  
  exceptionCard: { backgroundColor: '#FFFFFF', padding: 16, marginBottom: 16, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' }, 
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  itemTitle: { color: '#0F172A', fontSize: 14, fontWeight: '600' },
  
  statusBadgeDanger: { color: '#EF4444', fontSize: 10, fontWeight: '600', backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, overflow: 'hidden' },
  statusBadgeWarning: { color: '#F59E0B', fontSize: 10, fontWeight: '600', backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, overflow: 'hidden' },
  
  itemSub: { color: '#64748B', fontSize: 12, marginBottom: 8 },
  
  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  primaryBtn: { flex: 1, backgroundColor: '#0F172A', padding: 12, borderRadius: 6, alignItems: 'center' },
  successBtn: { flex: 1, backgroundColor: '#22C55E', padding: 12, borderRadius: 6, alignItems: 'center' },
  dangerBtn: { flex: 1, backgroundColor: '#EF4444', padding: 12, borderRadius: 6, alignItems: 'center' },
  
  btnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', padding: 24, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  modalTitle: { color: '#0F172A', fontSize: 18, fontWeight: '700', marginBottom: 16 },
  shopGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  shopBtn: { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 6, width: '48%', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  shopBtnText: { color: '#0F172A', fontWeight: '600', fontSize: 13 },
  cancelBtn: { backgroundColor: '#FFFFFF', padding: 12, borderRadius: 6, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  cancelBtnText: { color: '#0F172A', fontWeight: '600', fontSize: 13 },
  
  resultsContainer: { gap: 12 },
  resultCard: { backgroundColor: '#f8fafc', padding: 16, borderRadius: 4, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  resultTitle: { color: '#0f172a', fontSize: 16, fontWeight: '800' },
  badgeActive: { backgroundColor: '#dcfce7' },
  badgeInactive: { backgroundColor: '#f1f5f9' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  detailLabel: { color: '#64748b', fontSize: 12 },
  detailValue: { color: '#0f172a', fontSize: 12, fontWeight: '600' },
});
