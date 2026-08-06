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

function AdminGodModeBase({ database }: any) {
  const { userId } = useAuth();
  const [routeModal, setRouteModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const handleResolveAction = (asset: Asset, action: string) => {
    if (action === 'Re-route') {
      setSelectedAsset(asset);
      setRouteModal(true);
    } else {
      executeResolution(asset, action, null);
    }
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
              {['WRS-1', 'WRS-2', 'WRS-3', 'WRS-4', 'WRS-5'].map(shop => (
                <TouchableOpacity key={shop} style={styles.shopBtn} onPress={() => {
                  if (selectedAsset) executeResolution(selectedAsset, 'Re-route', shop);
                }}>
                  <Text style={styles.shopBtnText}>{shop}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setRouteModal(false)}>
              <Text style={styles.cancelBtnText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

export default withDatabase(AdminGodModeBase);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { padding: 20, backgroundColor: '#FFFFFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, // removed borderBottomWidth
  headerTitle: { color: '#ef4444', fontSize: 16, fontWeight: '900', letterSpacing: 1 }, // Red color for Admin God Mode
  badge: { backgroundColor: '#ef4444', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  
  content: { padding: 16 },
  card: { backgroundColor: '#FFFFFF', padding: 20, marginBottom: 16 }, // removed borders
  cardTitle: { color: '#0f172a', fontSize: 15, fontWeight: '700', marginBottom: 16 },
  subtitle: { color: '#64748b', marginBottom: 16 },
  
  exceptionCard: { backgroundColor: '#FFFFFF', padding: 16, marginBottom: 16 }, // removed border, changed background to white
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  itemTitle: { color: '#0f172a', fontSize: 15, fontWeight: '800' },
  
  statusBadgeDanger: { color: '#ef4444', fontSize: 10, fontWeight: '800', backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, overflow: 'hidden' },
  statusBadgeWarning: { color: '#f59e0b', fontSize: 10, fontWeight: '800', backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, overflow: 'hidden' },
  
  itemSub: { color: '#64748b', fontSize: 12, marginBottom: 8 },
  
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  primaryBtn: { flex: 1, backgroundColor: '#3b82f6', padding: 12, borderRadius: 4, alignItems: 'center' },
  successBtn: { flex: 1, backgroundColor: '#10b981', padding: 12, borderRadius: 4, alignItems: 'center' },
  dangerBtn: { flex: 1, backgroundColor: '#ef4444', padding: 12, borderRadius: 4, alignItems: 'center' },
  
  btnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', padding: 24, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  modalTitle: { color: '#0f172a', fontSize: 18, fontWeight: '800', marginBottom: 8 },
  shopGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  shopBtn: { backgroundColor: '#f8fafc', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 4, borderWidth: 1, borderColor: '#cbd5e1', width: '48%', alignItems: 'center' },
  shopBtnText: { color: '#0f172a', fontWeight: '700', fontSize: 14 },
  cancelBtn: { backgroundColor: '#f1f5f9', padding: 16, borderRadius: 4, alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1' },
  cancelBtnText: { color: '#0f172a', fontWeight: '700' },
});
