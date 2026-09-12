import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, Image, PermissionsAndroid, Platform } from 'react-native';
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
import { useLocations } from '../../hooks/useLocations';
import { QARepository } from '../../database/v2/repositories/QARepository';

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

const QAList = ({ assets, onVerdict }: { assets: Asset[], onVerdict: (asset: Asset, status: string) => void }) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>Awaiting Final Inspection: {assets.length}</Text>
    
    {assets.map(asset => (
      <View key={asset.id} style={styles.itemCard}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemTitle}>{asset.asset_number}</Text>
          <Text style={styles.itemBadge}>From: {asset.allocated_shop || 'Unknown'}</Text>
        </View>
        <Text style={styles.itemSub}>Repaired Category: {asset.repair_category || 'Unknown'}</Text>

        <Text style={styles.label}>Inspection Verdict</Text>
        <View style={styles.verdictGrid}>
          <TouchableOpacity style={styles.successBtn} onPress={() => onVerdict(asset, 'Fit')}>
            <Text style={styles.btnIcon}>✅</Text>
            <Text style={styles.btnText}>FIT</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.warningBtn} onPress={() => onVerdict(asset, 'Minor Fix')}>
            <Text style={styles.btnIcon}>🔧</Text>
            <Text style={styles.btnText}>MINOR FIX</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.dangerBtn} onPress={() => onVerdict(asset, 'Not Fit')}>
            <Text style={styles.btnIcon}>🚨</Text>
            <Text style={styles.btnText}>NOT FIT</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.condemnedBtn} onPress={() => onVerdict(asset, 'Condemned')}>
            <Text style={styles.btnIcon}>❌</Text>
            <Text style={[styles.btnText, { color: '#ef4444' }]}>CONDEMNED</Text>
          </TouchableOpacity>
        </View>
      </View>
    ))}
    {assets.length === 0 && <Text style={styles.subtitle}>No wagons awaiting inspection.</Text>}
  </View>
);

const ObservableQAList = withObservables(['database'], ({ database }) => ({
  assets: database.collections.get('assets').query(Q.where('current_status', 'Pending QA')).observe(),
}))(QAList);

function InspectionScreen({ database, handleVerdictTap }: any) {
  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.container}>
      <ObservableQAList database={database} onVerdict={handleVerdictTap} />
    </ScrollView>
  );
}

function QAFlowBase({ database }: any) {
  const { userId } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [pendingVerdict, setPendingVerdict] = useState<string | null>(null);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [selectedShop, setSelectedShop] = useState<string>('WRS-1');
  const { locations } = useLocations({ is_parking_line: false });
  const { locations: qaLocations } = useLocations({ zone: 'QA' });
  const qaLocation = qaLocations.length > 0 ? qaLocations[0].location_id : 'QA-LINE';

  const takePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Camera permission is required to capture proofs.');
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

  const handleVerdictTap = (asset: Asset, status: string) => {
    if (status === 'Fit') {
      processVerdict(asset, status, 0, null);
      processVerdict(asset, status, 0, null);
    } else {
      setSelectedAsset(asset);
      setPendingVerdict(status);
      setSelectedShop(asset.allocated_shop || 'WRS-1');
      if (photoUris.length > 0 && selectedAsset) { queuePhotosForUpload(selectedAsset.asset_number, photoUris); }
      setPhotoUris([]);
      setModalVisible(true);
    }
  };

  const processVerdict = async (asset: Asset, verdict: string, photoCount: number, targetShop: string | null) => {
    if (!userId) return;
    try {
      await QARepository.processVerdict({
        assetId: asset.id,
        verdict: verdict,
        userId: userId,
        targetShopId: targetShop,
        photoCount: photoCount,
        qaLocationId: qaLocation
      });
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', 'Failed to process QA verdict.');
    }
  };

  const submitNegativeVerdict = () => {
    if (photoUris.length === 0) {
      Alert.alert('Required', 'At least one photo proof is required for rejecting or condemning a wagon.');
      return;
    }
    if (selectedAsset && pendingVerdict) {
      processVerdict(selectedAsset, pendingVerdict, photoUris.length, pendingVerdict !== 'Condemned' ? selectedShop : null);
      setModalVisible(false);
      setSelectedAsset(null);
      setPendingVerdict(null);
      if (photoUris.length > 0 && selectedAsset) { queuePhotosForUpload(selectedAsset.asset_number, photoUris); }
      setPhotoUris([]);
    }
  };

  return (
    <>
      <Tab.Navigator
      screenOptions={({ route }) => ({
        header: () => <Header role="QA Testing" />,
        tabBarIcon: ({ color, size }) => {
          let iconName = 'magnify-scan';
          if (route.name === 'Inspection') iconName = 'clipboard-check-outline';
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#10b981',
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
      <Tab.Screen name="Inspection">
        {() => <InspectionScreen database={database} handleVerdictTap={handleVerdictTap} />}
      </Tab.Screen>
    </Tab.Navigator>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Proof Required for: {pendingVerdict}</Text>
            <Text style={styles.subtitle}>You must attach a photo of the defect before returning wagon {selectedAsset?.asset_number}.</Text>
            
        <View style={styles.photoRow}>
          <TouchableOpacity style={styles.cameraBtn} onPress={takePhoto}>
            <Icon name="camera" size={20} color="#0f172a" />
            <Text style={styles.cameraBtnText}>Capture Proof (Required)</Text>
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

            {pendingVerdict !== 'Condemned' && (
              <>
                <Text style={styles.label}>Redirect to Shop</Text>
                <View style={styles.shopGrid}>
                  {locations.filter(s => s.location_id !== qaLocation).map(shop => (
                    <TouchableOpacity 
                      key={shop.location_id} 
                      style={[styles.shopBtn, selectedShop === shop.location_id && styles.activeShopBtn]} 
                      onPress={() => setSelectedShop(shop.location_id)}
                    >
                      <Text style={[styles.shopBtnText, selectedShop === shop.location_id && styles.activeShopBtnText]}>{shop.location_id}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <View style={[styles.verdictGrid, { marginTop: 20 }]}>
              <TouchableOpacity style={[styles.actionBtn, { flex: 1 }]} onPress={() => setModalVisible(false)}>
                <Text style={styles.actionBtnText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={submitNegativeVerdict}>
                <Text style={styles.buttonText}>SUBMIT VERDICT</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

export default withDatabase(QAFlowBase);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 16 },
  card: { backgroundColor: '#FFFFFF', padding: 20, marginBottom: 16, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { color: '#0F172A', fontSize: 16, fontWeight: '700', marginBottom: 16 },
  subtitle: { color: '#64748B', marginBottom: 16, fontSize: 13 },
  
  itemCard: { backgroundColor: '#FFFFFF', padding: 16, marginBottom: 16, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' }, 
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  itemTitle: { color: '#0F172A', fontSize: 14, fontWeight: '600' },
  itemBadge: { color: '#64748B', fontSize: 10, backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, overflow: 'hidden' }, 
  itemSub: { color: '#64748B', fontSize: 12, marginBottom: 24 },
  
  label: { color: '#64748B', fontSize: 11, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  verdictGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  
  successBtn: { flex: 1, minWidth: '45%', backgroundColor: '#22C55E', padding: 12, borderRadius: 6, alignItems: 'center' },
  warningBtn: { flex: 1, minWidth: '45%', backgroundColor: '#F59E0B', padding: 12, borderRadius: 6, alignItems: 'center' },
  dangerBtn: { flex: 1, minWidth: '45%', backgroundColor: '#EF4444', padding: 12, borderRadius: 6, alignItems: 'center' },
  condemnedBtn: { flex: 1, minWidth: '45%', backgroundColor: '#FFFFFF', padding: 12, borderRadius: 6, alignItems: 'center', borderWidth: 1, borderColor: '#EF4444' }, 
  
  btnIcon: { fontSize: 20, marginBottom: 4 },
  btnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 12 },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', padding: 24, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  modalTitle: { color: '#0F172A', fontSize: 18, fontWeight: '700', marginBottom: 16 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  cameraBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', padding: 12, borderRadius: 6, borderWidth: 1, borderColor: '#E2E8F0', gap: 8 },
  cameraBtnText: { color: '#0F172A', fontWeight: '500', fontSize: 13 },
  thumbnail: { width: 44, height: 44, borderRadius: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  actionBtn: { backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  actionBtnText: { color: '#0F172A', fontWeight: '600', fontSize: 13 },
  primaryBtn: { backgroundColor: '#0F172A', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
  
  shopGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  shopBtn: { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 6, width: '48%', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  activeShopBtn: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  shopBtnText: { color: '#0F172A', fontWeight: '600', fontSize: 13 },
  activeShopBtnText: { color: '#FFFFFF' },
});
