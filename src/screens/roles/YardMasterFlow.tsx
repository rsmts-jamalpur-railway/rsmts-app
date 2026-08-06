import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Image, Modal, PermissionsAndroid, Platform, Alert } from 'react-native';
import { launchCamera } from 'react-native-image-picker';
import { withDatabase } from '@nozbe/watermelondb/DatabaseProvider';
import withObservables from '@nozbe/with-observables';
import { Q } from '@nozbe/watermelondb';
import Asset from '../../database/models/Asset';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Header from '../../components/Header';
import { queuePhotosForUpload } from '../../services/api/PhotoUploader';
import { useAuth } from '../../context/AuthContext';
import SearchWagon from '../common/SearchWagon';

const Tab = createBottomTabNavigator();

const requestCameraPermission = async () => {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'App needs camera permission to capture proofs.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn(err);
      return false;
    }
  }
  return true;
};

// --- COMPONENTS ---

const AllocateItem = ({ asset, onAllocatePress, onCancel }: { asset: Asset, onAllocatePress: (asset: Asset) => void, onCancel: (asset: Asset) => void }) => (
  <View style={styles.itemRow}>
    <View>
      <Text style={styles.itemTitle}>{asset.asset_number}</Text>
      <Text style={styles.itemSub}>Since: {asset.nsy_in_date ? new Date(asset.nsy_in_date).toLocaleTimeString() : 'N/A'}</Text>
    </View>
    <View style={styles.buttonRow}>
      <TouchableOpacity style={styles.primaryButtonSmall} onPress={() => onAllocatePress(asset)}>
        <Text style={styles.buttonText}>ALLOCATE</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.dangerBtn} onPress={() => onCancel(asset)}>
        <Icon name="delete" size={20} color="#FFF" />
      </TouchableOpacity>
    </View>
  </View>
);

const ObservableAllocateList = withObservables(['database'], ({ database }) => ({
  assets: database.collections.get('assets').query(Q.where('current_status', 'NSY IN')).observe(),
}))(({ assets, onAllocatePress, onCancel }: any) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>Unassigned Wagons ({assets.length})</Text>
    {assets.map((asset: Asset) => <AllocateItem key={asset.id} asset={asset} onAllocatePress={onAllocatePress} onCancel={onCancel} />)}
    {assets.length === 0 && <Text style={styles.subtitle}>No wagons waiting for allocation.</Text>}
  </View>
));

const ObservableTransitList = withObservables(['database'], ({ database }) => ({
  assets: database.collections.get('assets').query(Q.where('current_status', 'Allocated')).observe(),
}))(({ assets, onReallocate }: any) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>Wagons in Transit to Shop ({assets.length})</Text>
    {assets.map((asset: Asset) => (
      <View key={asset.id} style={styles.itemRow}>
        <View>
          <Text style={styles.itemTitle}>{asset.asset_number}</Text>
          <Text style={styles.itemSub}>To: {asset.allocated_shop}</Text>
        </View>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.warningBtn} onPress={() => onReallocate(asset)}>
            <Text style={styles.buttonText}>RE-ROUTE</Text>
          </TouchableOpacity>
        </View>
      </View>
    ))}
    {assets.length === 0 && <Text style={styles.subtitle}>No wagons in transit.</Text>}
  </View>
));

const ObservableDispatchList = withObservables(['database'], ({ database }) => ({
  assets: database.collections.get('assets').query(Q.where('current_status', 'Fit')).observe(),
}))(({ assets, onDispatch }: any) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>Ready for Dispatch ({assets.length})</Text>
    {assets.map((asset: Asset) => (
      <View key={asset.id} style={styles.itemRow}>
        <View>
          <Text style={styles.itemTitle}>{asset.asset_number}</Text>
          <Text style={styles.itemSub}>Status: {asset.current_status} ({asset.allocated_shop || 'N/A'})</Text>
        </View>
        <TouchableOpacity style={styles.successBtn} onPress={() => onDispatch(asset)}>
          <Text style={styles.buttonText}>DISPATCH</Text>
        </TouchableOpacity>
      </View>
    ))}
    {assets.length === 0 && <Text style={styles.subtitle}>No wagons ready for dispatch.</Text>}
  </View>
));

// --- SCREENS ---

function UnassignedScreen({ database }: any) {
  const [wagonNo, setWagonNo] = useState('');
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [allocModal, setAllocModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const { userId } = useAuth();

  const takePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Camera permission is required');
      return;
    }
    try {
      const response = await launchCamera({ mediaType: 'photo', cameraType: 'back', quality: 0.5 });
      if (response.assets && response.assets.length > 0) {
        const uri = response.assets[0].uri;
        if (uri) { setPhotoUris(prev => [...prev, uri]); }
      }
    } catch (e) {
      console.log('Camera error', e);
    }
  };

  const handleRecordArrival = async () => {
    if (!wagonNo || !userId) return;
    try {
      await database.write(async () => {
        await database.collections.get('assets').create((asset: any) => {
          asset.asset_number = wagonNo.toUpperCase();
          asset.current_status = 'NSY IN';
          asset.nsy_in_date = new Date().getTime();
          asset.is_active = true;
        });

        await database.collections.get('movement_logs').create((log: any) => {
          log.asset_number = wagonNo.toUpperCase();
          log.to_location = 'NSY';
          log.new_status = 'NSY IN';
          log.handled_by = userId;
          log.is_offline_entry = true;
          log.timestamp = new Date().getTime();
          log.remarks = `Recorded arrival at NSY via mobile.${photoUris.length > 0 ? ' [PHOTO_PROOF_ATTACHED]' : ''}`;
        });
      });
      setWagonNo('');
      if (photoUris.length > 0) { queuePhotosForUpload(wagonNo, photoUris); }
      setPhotoUris([]);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAllocatePress = (asset: Asset) => {
    setSelectedAsset(asset);
    setAllocModal(true);
  };

  const executeAllocation = async (shop: string) => {
    if (!userId || !selectedAsset) return;
    try {
      await database.write(async () => {
        await selectedAsset.update((a: any) => {
          a.current_status = 'Allocated';
          a.allocated_shop = shop;
        });

        await database.collections.get('movement_logs').create((log: any) => {
          log.asset_number = selectedAsset.asset_number;
          log.from_location = 'NSY';
          log.to_location = shop;
          log.previous_status = 'NSY IN';
          log.new_status = 'Allocated';
          log.handled_by = userId;
          log.is_offline_entry = true;
          log.timestamp = new Date().getTime();
          log.remarks = `Allocated to ${shop}`;
        });
      });
      setAllocModal(false);
      setSelectedAsset(null);
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleCancelArrival = async (asset: Asset) => {
    if (!userId) return;
    try {
      await database.write(async () => {
        // We shouldn't physically delete the asset so we keep sync integrity, just mark as deleted or cancel status
        await asset.update((a: any) => {
          a.current_status = 'Cancelled Entry';
          a.is_active = false;
        });

        await database.collections.get('movement_logs').create((log: any) => {
          log.asset_number = asset.asset_number;
          log.from_location = 'NSY';
          log.to_location = 'NSY';
          log.previous_status = 'NSY IN';
          log.new_status = 'Cancelled Entry';
          log.handled_by = userId;
          log.is_offline_entry = true;
          log.timestamp = new Date().getTime();
          log.remarks = 'Entry cancelled by Yard Master due to error.';
        });
      });
    } catch (e: any) {
      console.error(e);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={[styles.card, { marginBottom: 16 }]}>
        <Text style={styles.cardTitle}>Record Arrival</Text>
        <TextInput 
          style={styles.input} 
          placeholder="Enter Wagon Number (e.g. BOXN-1234)" 
          placeholderTextColor="#94a3b8"
          value={wagonNo}
          onChangeText={setWagonNo}
          autoCapitalize="characters"
        />
        
        <View style={styles.photoRow}>
          <TouchableOpacity style={styles.cameraBtn} onPress={takePhoto}>
            <Icon name="camera" size={20} color="#0f172a" />
            <Text style={styles.cameraBtnText}>Capture Proof (Optional)</Text>
          </TouchableOpacity>
        </View>
        {photoUris.length > 0 && (
          <ScrollView horizontal style={{ marginBottom: 16 }} showsHorizontalScrollIndicator={false}>
            {photoUris.map((uri, idx) => (
              <View key={idx} style={{ position: 'relative', marginRight: 12 }}>
                <Image source={{ uri }} style={styles.thumbnail} />
                <TouchableOpacity 
                  style={{ position: 'absolute', top: -5, right: -5, backgroundColor: 'red', borderRadius: 12, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => setPhotoUris(prev => prev.filter((_, i) => i !== idx))}
                >
                  <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>X</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        <TouchableOpacity style={styles.primaryButton} onPress={handleRecordArrival}>
          <Text style={styles.buttonText}>RECORD NSY IN</Text>
        </TouchableOpacity>
      </View>
      <ObservableAllocateList database={database} onAllocatePress={handleAllocatePress} onCancel={handleCancelArrival} />

      <Modal visible={allocModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Allocate Wagon: {selectedAsset?.asset_number}</Text>
            <Text style={styles.subtitle}>Select the destination repair shop:</Text>
            
            <View style={styles.shopGrid}>
              {['WRS-1', 'WRS-2', 'WRS-3', 'WRS-4', 'WRS-5'].map(shop => (
                <TouchableOpacity key={shop} style={styles.shopBtn} onPress={() => executeAllocation(shop)}>
                  <Text style={styles.shopBtnText}>{shop}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setAllocModal(false)}>
              <Text style={styles.cancelBtnText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function AllocatedScreen({ database }: any) {
  const { userId } = useAuth();
  const [routeModal, setRouteModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const handleReallocatePress = (asset: Asset) => {
    setSelectedAsset(asset);
    setRouteModal(true);
  };

  const executeReallocate = async (newShop: string) => {
    if (!userId || !selectedAsset) return;
    try {
      await database.write(async () => {
        await selectedAsset.update((a: any) => {
          a.allocated_shop = newShop;
        });

        await database.collections.get('movement_logs').create((log: any) => {
          log.asset_number = selectedAsset.asset_number;
          log.from_location = 'NSY';
          log.to_location = newShop;
          log.previous_status = 'Allocated';
          log.new_status = 'Allocated';
          log.handled_by = userId;
          log.is_offline_entry = true;
          log.timestamp = new Date().getTime();
          log.remarks = `Re-allocated to ${newShop} due to error.`;
        });
      });
      setRouteModal(false);
      setSelectedAsset(null);
    } catch (e: any) {
      console.error(e);
    }
  };

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <ObservableTransitList database={database} onReallocate={handleReallocatePress} />
      </ScrollView>
      <Modal visible={routeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Re-route Wagon: {selectedAsset?.asset_number}</Text>
            <Text style={styles.subtitle}>Select the NEW destination repair shop:</Text>
            
            <View style={styles.shopGrid}>
              {['WRS-1', 'WRS-2', 'WRS-3', 'WRS-4', 'WRS-5'].map(shop => (
                <TouchableOpacity key={shop} style={styles.shopBtn} onPress={() => executeReallocate(shop)}>
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

function DispatchScreen({ database }: any) {
  const { userId } = useAuth();

  const handleDispatch = async (asset: Asset) => {
    if (!userId) return;
    try {
      await database.write(async () => {
        await asset.update((a: any) => {
          a.current_status = 'NSY OUT';
          a.nsy_out_date = new Date().getTime();
          a.is_active = false;
        });

        await database.collections.get('movement_logs').create((log: any) => {
          log.asset_number = asset.asset_number;
          log.from_location = 'WRS-5';
          log.to_location = 'OUT';
          log.previous_status = 'Fit';
          log.new_status = 'NSY OUT';
          log.handled_by = userId;
          log.is_offline_entry = true;
          log.timestamp = new Date().getTime();
          log.remarks = 'Dispatched from yard.';
        });
      });
    } catch (e: any) {
      console.error(e);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ObservableDispatchList database={database} onDispatch={handleDispatch} />
    </ScrollView>
  );
}

// --- NAVIGATOR ---

function YardMasterFlowBase({ database }: any) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        header: () => <Header role="Yard Master" />,
        tabBarIcon: ({ color, size }) => {
          let iconName = 'train';
          if (route.name === 'Unassigned') iconName = 'tray-arrow-down';
          else if (route.name === 'Allocated') iconName = 'transit-connection-variant';
          else if (route.name === 'Dispatch') iconName = 'tray-arrow-up';
          else if (route.name === 'Search') iconName = 'magnify';
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#0A74DA',
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
      <Tab.Screen name="Unassigned">
        {() => <UnassignedScreen database={database} />}
      </Tab.Screen>
      <Tab.Screen name="Allocated">
        {() => <AllocatedScreen database={database} />}
      </Tab.Screen>
      <Tab.Screen name="Dispatch">
        {() => <DispatchScreen database={database} />}
      </Tab.Screen>
      <Tab.Screen name="Search">
        {() => <SearchWagon database={database} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default withDatabase(YardMasterFlowBase);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 16 },
  card: { backgroundColor: '#FFFFFF', padding: 20, marginBottom: 16 },
  cardTitle: { color: '#0f172a', fontSize: 15, fontWeight: '700', marginBottom: 16 },
  subtitle: { color: '#64748b', marginBottom: 16 },
  input: { backgroundColor: '#f8fafc', color: '#0f172a', padding: 16, borderWidth: 1, borderColor: '#cbd5e1', marginBottom: 16 },
  primaryButton: { backgroundColor: '#0A74DA', padding: 16, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  itemTitle: { color: '#0f172a', fontSize: 14, fontWeight: '700' },
  itemSub: { color: '#64748b', fontSize: 10, marginTop: 4 },
  buttonRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { backgroundColor: '#f1f5f9', paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: '#cbd5e1', justifyContent: 'center' },
  actionBtnText: { color: '#0f172a', fontWeight: '600' },
  successBtn: { backgroundColor: '#10b981', paddingHorizontal: 16, paddingVertical: 8, justifyContent: 'center' },
  warningBtn: { backgroundColor: '#f59e0b', paddingHorizontal: 16, paddingVertical: 8, justifyContent: 'center', borderRadius: 4 },
  dangerBtn: { backgroundColor: '#ef4444', paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'center', borderRadius: 4 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  cameraBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', padding: 12, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 4, gap: 8 },
  cameraBtnText: { color: '#0f172a', fontWeight: '600' },
  thumbnail: { width: 44, height: 44, borderRadius: 4 },
  primaryButtonSmall: { backgroundColor: '#0A74DA', paddingHorizontal: 16, paddingVertical: 8, justifyContent: 'center', borderRadius: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', padding: 24, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  modalTitle: { color: '#0f172a', fontSize: 18, fontWeight: '800', marginBottom: 8 },
  shopGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  shopBtn: { backgroundColor: '#f8fafc', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 4, borderWidth: 1, borderColor: '#cbd5e1', width: '48%', alignItems: 'center' },
  shopBtnText: { color: '#0f172a', fontWeight: '700', fontSize: 14 },
  cancelBtn: { backgroundColor: '#f1f5f9', padding: 16, borderRadius: 4, alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1' },
  cancelBtnText: { color: '#0f172a', fontWeight: '700' },
});
