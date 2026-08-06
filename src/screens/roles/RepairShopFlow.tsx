import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput, Alert, Image, PermissionsAndroid, Platform } from 'react-native';
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

const Tab = createBottomTabNavigator();

const IncomingList = ({ assets, onMissing, onIntake }: { assets: Asset[], onMissing: (asset: Asset) => void, onIntake: (asset: Asset) => void }) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>Incoming Allocations</Text>
    {assets.map(asset => (
      <View key={asset.id} style={styles.itemRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.itemTitle}>{asset.asset_number}</Text>
          <Text style={styles.itemSub}>Allocated to: {asset.allocated_shop}</Text>
        </View>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.dangerBtn} onPress={() => onMissing(asset)}>
            <Text style={styles.buttonText}>MISSING</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => onIntake(asset)}>
            <Text style={styles.buttonText}>INTAKE</Text>
          </TouchableOpacity>
        </View>
      </View>
    ))}
    {assets.length === 0 && <Text style={styles.subtitle}>No incoming allocations.</Text>}
  </View>
);

const ObservableIncomingList = withObservables(['database'], ({ database }) => ({
  assets: database.collections.get('assets').query(Q.where('current_status', 'Allocated')).observe(),
}))(IncomingList);

const InShopList = ({ assets, onHold, onFinish, onReject }: { assets: Asset[], onHold: (asset: Asset) => void, onFinish: (asset: Asset) => void, onReject: (asset: Asset) => void }) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>Currently in Shop</Text>
    {assets.map(asset => (
      <View key={asset.id} style={styles.itemRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.itemTitle}>{asset.asset_number}</Text>
          <Text style={styles.itemSub}>Category: {asset.repair_category || 'N/A'}</Text>
        </View>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.dangerBtn} onPress={() => onReject(asset)}>
            <Icon name="keyboard-return" size={16} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.warningBtn} onPress={() => onHold(asset)}>
            <Text style={styles.buttonText}>HOLD</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.successBtn} onPress={() => onFinish(asset)}>
            <Text style={styles.buttonText}>FINISH / FORWARD</Text>
          </TouchableOpacity>
        </View>
      </View>
    ))}
    {assets.length === 0 && <Text style={styles.subtitle}>No wagons currently in shop.</Text>}
  </View>
);

const ObservableInShopList = withObservables(['database'], ({ database }) => ({
  assets: database.collections.get('assets').query(Q.where('current_status', 'Shop In')).observe(),
}))(InShopList);

function IncomingScreen({ database, onMissing, onIntake }: any) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ObservableIncomingList database={database} onMissing={onMissing} onIntake={onIntake} />
    </ScrollView>
  );
}

function InShopScreen({ database, onHold, onFinish, onReject }: any) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ObservableInShopList database={database} onHold={onHold} onFinish={onFinish} onReject={onReject} />
    </ScrollView>
  );
}

function RepairShopFlowBase({ database }: any) {
  const [intakeModal, setIntakeModal] = useState(false);
  const [finishModal, setFinishModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'Light' | 'Medium' | 'Heavy'>('Medium');
  const [customTat, setCustomTat] = useState('');
  const [reason, setReason] = useState('');
  const [photoUris, setPhotoUris] = useState<string[]>([]);

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

  const handleMissing = async (asset: Asset) => {
    if (!userId) return;
    try {
      await database.write(async () => {
        await asset.update((a: any) => { a.current_status = 'Missing'; });
        await database.collections.get('movement_logs').create((log: any) => {
          log.asset_number = asset.asset_number;
          log.from_location = asset.allocated_shop || 'Unknown';
          log.to_location = 'Missing';
          log.previous_status = asset.current_status;
          log.new_status = 'Missing';
          log.handled_by = userId;
          log.is_offline_entry = true;
          log.timestamp = new Date().getTime();
          log.remarks = 'Asset reported missing from allocated shop.';
        });
      });
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const openIntakeModal = (asset: Asset) => {
    setSelectedAsset(asset);
    setSelectedCategory('Medium');
    setCustomTat('');
    setReason('');
    if (photoUris.length > 0 && selectedAsset) { queuePhotosForUpload(selectedAsset.asset_number, photoUris); }
      setPhotoUris([]);
    setIntakeModal(true);
  };

  const handleAcceptWagon = async () => {
    if (customTat !== '' && reason.trim() === '') {
      Alert.alert('Required', 'You must provide a reason for the custom TAT override.');
      return;
    }
    if (!selectedAsset || !userId) return;

    try {
      await database.write(async () => {
        await selectedAsset.update((a: any) => {
          a.current_status = 'Shop In';
          a.repair_category = selectedCategory;
          a.shop_in_date = new Date().getTime();
        });
        await database.collections.get('movement_logs').create((log: any) => {
          log.asset_number = selectedAsset.asset_number;
          log.from_location = 'NSY';
          log.to_location = selectedAsset.allocated_shop || 'Shop';
          log.previous_status = selectedAsset.current_status;
          log.new_status = 'Shop In';
          log.handled_by = userId;
          log.is_offline_entry = true;
          log.timestamp = new Date().getTime();
          log.remarks = customTat !== '' ? `Custom TAT: ${customTat} days. Reason: ${reason}` : `Category: ${selectedCategory}`;
          if (photoUris.length > 0) {
            log.remarks += ` [${photoUris.length}x PHOTO_PROOF_ATTACHED]`;
          }
        });
      });
      setIntakeModal(false);
      setSelectedAsset(null);
      if (photoUris.length > 0 && selectedAsset) { queuePhotosForUpload(selectedAsset.asset_number, photoUris); }
      setPhotoUris([]);
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const handleHold = async (asset: Asset) => {
    if (!userId) return;
    try {
      await database.write(async () => {
        await asset.update((a: any) => { a.current_status = 'Hold'; });
        await database.collections.get('movement_logs').create((log: any) => {
          log.asset_number = asset.asset_number;
          log.from_location = asset.allocated_shop || 'Shop';
          log.to_location = asset.allocated_shop || 'Shop';
          log.previous_status = asset.current_status;
          log.new_status = 'Hold';
          log.handled_by = userId;
          log.is_offline_entry = true;
          log.timestamp = new Date().getTime();
          log.remarks = 'Placed on hold.';
        });
      });
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const handleFinishPress = (asset: Asset) => {
    setSelectedAsset(asset);
    setFinishModal(true);
  };

  const executeFinish = async (destinationShop: string, isQA: boolean = false) => {
    if (!userId || !selectedAsset) return;
    try {
      await database.write(async () => {
        await selectedAsset.update((a: any) => { 
          a.current_status = isQA ? 'Pending QA' : 'Allocated';
          if (!isQA) {
            a.allocated_shop = destinationShop;
          }
        });
        await database.collections.get('movement_logs').create((log: any) => {
          log.asset_number = selectedAsset.asset_number;
          log.from_location = selectedAsset.allocated_shop || 'Shop';
          log.to_location = destinationShop;
          log.previous_status = selectedAsset.current_status;
          log.new_status = isQA ? 'Pending QA' : 'Allocated';
          log.handled_by = userId;
          log.is_offline_entry = true;
          log.timestamp = new Date().getTime();
          log.remarks = isQA ? 'Repair finished, pending QA inspection.' : `Forwarded to ${destinationShop} for further repairs.`;
        });
      });
      setFinishModal(false);
      setSelectedAsset(null);
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const handleReject = async (asset: Asset) => {
    if (!userId) return;
    try {
      await database.write(async () => {
        await asset.update((a: any) => { 
          a.current_status = 'NSY IN'; 
          a.allocated_shop = null; 
          a.repair_category = null;
        });
        await database.collections.get('movement_logs').create((log: any) => {
          log.asset_number = asset.asset_number;
          log.from_location = asset.allocated_shop || 'Shop';
          log.to_location = 'NSY';
          log.previous_status = asset.current_status;
          log.new_status = 'NSY IN';
          log.handled_by = userId;
          log.is_offline_entry = true;
          log.timestamp = new Date().getTime();
          log.remarks = 'Rejected by shop, returned to Yard Master.';
        });
      });
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  return (
    <>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          header: () => <Header role="WRS In-Charge" />,
          tabBarIcon: ({ color, size }) => {
            let iconName = 'wrench';
            if (route.name === 'Incoming') iconName = 'arrow-down-box';
            else if (route.name === 'In Shop') iconName = 'hammer-wrench';
            return <Icon name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#f59e0b',
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
        <Tab.Screen name="Incoming">
          {() => <IncomingScreen database={database} onMissing={handleMissing} onIntake={openIntakeModal} />}
        </Tab.Screen>
        <Tab.Screen name="In Shop">
          {() => <InShopScreen database={database} onHold={handleHold} onFinish={handleFinishPress} onReject={handleReject} />}
        </Tab.Screen>
      </Tab.Navigator>

      <Modal visible={intakeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Intake Analysis: {selectedAsset?.asset_number}</Text>
            
            <Text style={styles.label}>Repair Category</Text>
            <View style={styles.categoryRow}>
              {['Light', 'Medium', 'Heavy'].map((cat) => (
                <TouchableOpacity 
                  key={cat} 
                  style={[styles.catBtn, selectedCategory === cat && styles.activeCatBtn]}
                  onPress={() => setSelectedCategory(cat as any)}
                >
                  <Text style={[styles.catBtnText, selectedCategory === cat && styles.activeCatBtnText]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Custom TAT Override (Days)</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Leave blank for standard TAT"
              placeholderTextColor="#64748b"
              keyboardType="number-pad"
              value={customTat}
              onChangeText={setCustomTat}
            />

            {customTat !== '' && (
              <>
                <Text style={styles.label}>Reason for Extended TAT (Mandatory)</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="e.g. Heavy chassis structural damage..."
                  placeholderTextColor="#64748b"
                  value={reason}
                  onChangeText={setReason}
                />
              </>
            )}

            <View style={styles.photoRow}>
              <TouchableOpacity style={styles.cameraBtn} onPress={takePhoto}>
                <Icon name="camera" size={20} color="#0f172a" />
                <Text style={styles.cameraBtnText}>{photoUris.length > 0 ? 'Retake Proof' : 'Capture Proof (Optional)'}</Text>
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

            <View style={[styles.buttonRow, { marginTop: 20 }]}>
              <TouchableOpacity style={[styles.actionBtn, { flex: 1 }]} onPress={() => setIntakeModal(false)}>
                <Text style={styles.actionBtnText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={handleAcceptWagon}>
                <Text style={styles.buttonText}>ACCEPT WAGON</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={finishModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Finish & Route: {selectedAsset?.asset_number}</Text>
            
            <Text style={styles.label}>Forward to Another Shop</Text>
            <View style={styles.shopGrid}>
              {['WRS-1', 'WRS-2', 'WRS-3', 'WRS-4'].map(shop => (
                <TouchableOpacity key={shop} style={styles.shopBtn} onPress={() => executeFinish(shop, false)}>
                  <Text style={styles.shopBtnText}>{shop}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Or Complete Repair</Text>
            <TouchableOpacity style={styles.qaBtn} onPress={() => executeFinish('WRS-5', true)}>
              <Text style={styles.buttonText}>SEND TO WRS-5 (QA TESTING)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionBtn, { marginTop: 20 }]} onPress={() => setFinishModal(false)}>
              <Text style={styles.actionBtnText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

export default withDatabase(RepairShopFlowBase);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 16 },
  card: { backgroundColor: '#FFFFFF', padding: 20, marginBottom: 16 },
  cardTitle: { color: '#0f172a', fontSize: 15, fontWeight: '700', marginBottom: 16 },
  subtitle: { color: '#64748b', marginBottom: 16 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  itemTitle: { color: '#0f172a', fontSize: 14, fontWeight: '700' },
  itemSub: { color: '#64748b', fontSize: 10, marginTop: 4 },
  buttonRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { backgroundColor: '#f1f5f9', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 4, alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1' },
  actionBtnText: { color: '#0f172a', fontWeight: '600' },
  primaryBtn: { backgroundColor: '#f59e0b', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 4, alignItems: 'center' },
  successBtn: { backgroundColor: '#10b981', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 4, alignItems: 'center' },
  warningBtn: { backgroundColor: '#eab308', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 4, alignItems: 'center' },
  dangerBtn: { backgroundColor: '#ef4444', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 4, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '800' },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', padding: 24, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  modalTitle: { color: '#0f172a', fontSize: 18, fontWeight: '800', marginBottom: 20 },
  label: { color: '#64748b', fontSize: 10, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  categoryRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  catBtn: { flex: 1, padding: 12, borderRadius: 4, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center' },
  activeCatBtn: { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
  catBtnText: { color: '#64748b', fontWeight: '600' },
  activeCatBtnText: { color: '#FFFFFF' },
  input: { backgroundColor: '#f8fafc', color: '#0f172a', padding: 16, borderRadius: 4, borderWidth: 1, borderColor: '#cbd5e1', marginBottom: 16 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  cameraBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', padding: 12, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 4, gap: 8 },
  cameraBtnText: { color: '#0f172a', fontWeight: '600' },
  thumbnail: { width: 44, height: 44, borderRadius: 4 },
  
  shopGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  shopBtn: { backgroundColor: '#f8fafc', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 4, borderWidth: 1, borderColor: '#cbd5e1', width: '48%', alignItems: 'center' },
  shopBtnText: { color: '#0f172a', fontWeight: '700', fontSize: 14 },
  qaBtn: { backgroundColor: '#10b981', padding: 16, borderRadius: 4, alignItems: 'center' },
});
