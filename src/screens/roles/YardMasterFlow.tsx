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
import { useAssetConfig } from '../../hooks/useAssetConfig';
import { useLocations } from '../../hooks/useLocations';
import { YardRepository } from '../../database/v2/repositories/YardRepository';

// Removed hardcoded getShopsForCategory

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
  const [assetCategory, setAssetCategory] = useState<'WAGON' | 'LOCO' | 'CRANE' | 'TOWER_CAR'>('WAGON');
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [allocModal, setAllocModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const { userId, assignedLocationId } = useAuth();
  const { config, getShopsForCategory, loading } = useAssetConfig();

  if (loading) {
    return <Text style={{ padding: 20 }}>Loading configuration...</Text>;
  }

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

    // Validation
    const length = wagonNo.trim().length;
    if (assetCategory === 'WAGON' && length !== 11) {
      Alert.alert('Validation Error', 'Wagon number must be exactly 11 digits.');
      return;
    }
    if (assetCategory === 'LOCO' && length !== 5) {
      Alert.alert('Validation Error', 'Locomotive number must be exactly 5 digits.');
      return;
    }
    if (assetCategory === 'CRANE' && length !== 6) {
      Alert.alert('Validation Error', 'Crane number must be exactly 6 digits.');
      return;
    }
    if (assetCategory === 'TOWER_CAR' && (length !== 3 && length !== 6)) {
      Alert.alert('Validation Error', 'Tower Car number must be exactly 3 or 6 digits.');
      return;
    }

    try {
      await YardRepository.recordArrival({
        assetNumber: wagonNo,
        category: assetCategory,
        userId: userId,
        photoCount: photoUris.length,
        assignedLocationId: assignedLocationId
      });

      setWagonNo('');
      if (photoUris.length > 0) { queuePhotosForUpload(wagonNo, photoUris); }
      setPhotoUris([]);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', 'Failed to record arrival.');
    }
  };

  const handleAllocatePress = (asset: Asset) => {
    setSelectedAsset(asset);
    setAllocModal(true);
  };

  const executeAllocation = async (shop: string) => {
    if (!userId || !selectedAsset) return;
    try {
      await YardRepository.allocateAsset({
        assetId: selectedAsset.id,
        shopId: shop,
        userId: userId
      });

      setAllocModal(false);
      setSelectedAsset(null);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', 'Failed to allocate asset.');
    }
  };

  const handleCancelArrival = async (asset: Asset) => {
    if (!userId) return;
    try {
      await YardRepository.cancelArrival({
        assetId: asset.id,
        userId: userId
      });
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', 'Failed to cancel arrival.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={[styles.card, { marginBottom: 16 }]}>
        <Text style={styles.cardTitle}>Record Arrival</Text>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {Object.keys(config.categoryDestinations).map(cat => (
            <TouchableOpacity 
              key={cat} 
              onPress={() => setAssetCategory(cat as any)}
              style={{
                flex: 1, padding: 8, borderRadius: 4, alignItems: 'center',
                backgroundColor: assetCategory === cat ? '#0A74DA' : '#f1f5f9'
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '700', color: assetCategory === cat ? '#fff' : '#64748b' }}>
                {cat.replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput 
          style={styles.input} 
          placeholder={`Enter ${assetCategory.replace('_', ' ')} Number`} 
          placeholderTextColor="#94a3b8"
          value={wagonNo}
          onChangeText={setWagonNo}
          keyboardType="numeric"
          maxLength={
            assetCategory === 'WAGON' ? 11 : 
            assetCategory === 'CRANE' ? 6 : 
            assetCategory === 'TOWER_CAR' ? 6 : 5
          }
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
              {getShopsForCategory(selectedAsset?.asset_category).map(shop => (
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
  const { getShopsForCategory } = useAssetConfig();
  const [routeModal, setRouteModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const handleReallocatePress = (asset: Asset) => {
    setSelectedAsset(asset);
    setRouteModal(true);
  };

  const executeReallocate = async (newShop: string) => {
    if (!userId || !selectedAsset) return;
    try {
      await YardRepository.reallocateAsset({
        assetId: selectedAsset.id,
        newShopId: newShop,
        userId: userId
      });

      setRouteModal(false);
      setSelectedAsset(null);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', 'Failed to re-route asset.');
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
              {getShopsForCategory(selectedAsset?.asset_category).map(shop => (
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
      await YardRepository.dispatchAsset({
        assetId: asset.id,
        userId: userId,
        toRailway: 'OUT' // Replace with a real prompt if needed
      });
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', 'Failed to dispatch asset.');
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
        tabBarActiveTintColor: '#0F172A',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
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
        {() => <SearchWagon />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default withDatabase(YardMasterFlowBase);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 16 },
  card: { backgroundColor: '#FFFFFF', padding: 20, marginBottom: 16, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { color: '#0F172A', fontSize: 16, fontWeight: '700', marginBottom: 16 },
  subtitle: { color: '#64748B', marginBottom: 16, fontSize: 13 },
  input: { backgroundColor: '#FFFFFF', color: '#0F172A', padding: 12, borderRadius: 6, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16, fontSize: 13 },
  primaryButton: { backgroundColor: '#0F172A', padding: 12, alignItems: 'center', borderRadius: 6 },
  buttonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  itemTitle: { color: '#0F172A', fontSize: 14, fontWeight: '600' },
  itemSub: { color: '#64748B', fontSize: 12, marginTop: 4 },
  buttonRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  actionBtnText: { color: '#0F172A', fontWeight: '500', fontSize: 13 },
  successBtn: { backgroundColor: '#22C55E', paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'center', borderRadius: 6 },
  warningBtn: { backgroundColor: '#F59E0B', paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'center', borderRadius: 6 },
  dangerBtn: { backgroundColor: '#EF4444', paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'center', borderRadius: 6 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  cameraBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', padding: 12, borderRadius: 6, borderWidth: 1, borderColor: '#E2E8F0', gap: 8 },
  cameraBtnText: { color: '#0F172A', fontWeight: '500', fontSize: 13 },
  thumbnail: { width: 44, height: 44, borderRadius: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  primaryButtonSmall: { backgroundColor: '#0F172A', paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'center', borderRadius: 6 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', padding: 24, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  modalTitle: { color: '#0F172A', fontSize: 18, fontWeight: '700', marginBottom: 16 },
  shopGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  shopBtn: { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 6, width: '48%', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  shopBtnText: { color: '#0F172A', fontWeight: '600', fontSize: 13 },
  cancelBtn: { backgroundColor: '#FFFFFF', padding: 12, borderRadius: 6, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  cancelBtnText: { color: '#0F172A', fontWeight: '600', fontSize: 13 },
});
