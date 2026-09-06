import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../../context/AuthContext';
import { ManufacturingRepository } from '../../../database/v2/repositories/ManufacturingRepository';
import { database } from '../../../database/v2';
import Asset from '../../../database/v2/models/Asset';
import { Q } from '@nozbe/watermelondb';

const MFG_SHOPS = [
  { id: 'GIF', name: 'GIF (Foundry)' },
  { id: 'BOGIE-MFG', name: 'Bogie Assembly' },
  { id: 'WHEEL-MFG', name: 'Wheel Machining' },
  { id: 'FORGE-SHOP', name: 'Heavy Forging' },
];

const TARGET_ASSET_TYPES = [
  { id: 'BOXN', name: 'BOXN Open Freight Wagon', desc: 'Standard Bogie Open Wagon' },
  { id: 'BCNHL', name: 'BCNHL Covered Goods Wagon', desc: 'Bogie Covered High Capacity' },
  { id: 'BVZI', name: 'BVZI Guard Brake Van', desc: '8-Wheeler Air Brake Van' },
  { id: 'WHEELSET-1000MM', name: 'Wheelset 1000mm Cast', desc: 'Machined forged steel wheelset with axle' },
  { id: 'CASNUB-22W', name: 'CASNUB 22W Bogie Frame', desc: 'Cast steel freight bogie assembly' },
  { id: 'CBC-COUPLER', name: 'CBC Coupler & Draft Gear', desc: 'Tight-lock automatic coupler assembly' },
];

export default function OrdersScreen({ navigation }: any) {
  const { employeeId, assignedLocationId } = useAuth();
  
  const [currentShop, setCurrentShop] = useState(assignedLocationId || 'GIF');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Target Spec Modal
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [targetType, setTargetType] = useState('BOXN');

  useEffect(() => {
    loadIncomingOrders();
  }, [currentShop]);

  const loadIncomingOrders = async () => {
    try {
      setIsLoading(true);
      // Query assets allocated to this specific manufacturing shop
      const incoming = await database.collections.get<Asset>('assets')
        .query(
          Q.where('current_location_id', currentShop),
          Q.where('current_status', Q.oneOf(['Allocated', 'ALLOCATED']))
        )
        .fetch();
        
      setAssets(incoming);
    } catch (error) {
      console.error('Error loading incoming orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openStartModal = (asset: Asset) => {
    setSelectedAsset(asset);
    setTargetType('BOXN');
  };

  const handleConfirmStart = async () => {
    if (!selectedAsset) return;

    setProcessingId(selectedAsset.id);
    const assetNum = selectedAsset.assetNumber;
    setSelectedAsset(null);

    try {
      await ManufacturingRepository.startOrder({
        assetId: selectedAsset.id,
        shopId: currentShop,
        targetAssetType: targetType,
        userId: employeeId || 'UNKNOWN',
      });
      
      Alert.alert('Success', `Manufacturing order started for ${assetNum} (${targetType}). Transaction queued offline.`);
      loadIncomingOrders();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to start order.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>FABRICATION ORDERS</Text>
      </View>

      {/* Shop Selector */}
      <View style={styles.shopSelector}>
        <Text style={styles.shopLabel}>MANUFACTURING SHOP:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shopScroll}>
          {MFG_SHOPS.map(s => {
            const isSel = currentShop === s.id;
            return (
              <TouchableOpacity
                key={s.id}
                style={[styles.shopChip, isSel && styles.shopChipActive]}
                onPress={() => setCurrentShop(s.id)}
              >
                <Text style={[styles.shopChipText, isSel && styles.shopChipTextActive]}>{s.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Summary Bar */}
      <View style={styles.summaryBar}>
        <Text style={styles.summaryText}>
          Pending intake in <Text style={styles.summaryBold}>{currentShop}</Text>: {assets.length}
        </Text>
        <TouchableOpacity onPress={loadIncomingOrders} style={styles.refreshBtn}>
          <Icon name="refresh" size={18} color="#0A74DA" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#0A74DA" style={{ marginTop: 32 }} />
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {assets.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="factory" size={48} color="#94a3b8" />
              <Text style={styles.emptyTitle}>No Pending Production Orders</Text>
              <Text style={styles.emptyText}>
                Assets allocated to {currentShop} for fabrication will appear here.
              </Text>
            </View>
          ) : (
            assets.map(asset => (
              <View key={asset.id} style={styles.assetCard}>
                <View style={styles.assetInfo}>
                  <View style={styles.titleRow}>
                    <Icon name="cube-outline" size={18} color="#059669" />
                    <Text style={styles.assetTitle}>{asset.assetNumber}</Text>
                  </View>
                  <Text style={styles.assetSub}>Raw Type: {asset.assetType || 'WAGON'}</Text>
                  <Text style={styles.assetSub}>Category: {asset.assetCategory || 'WAGON'}</Text>
                </View>
                
                <TouchableOpacity 
                  style={[styles.actionBtn, processingId === asset.id && styles.actionBtnDisabled]} 
                  onPress={() => openStartModal(asset)}
                  disabled={processingId === asset.id}
                >
                  {processingId === asset.id ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Icon name="play" size={14} color="#FFFFFF" />
                      <Text style={styles.actionBtnText}>START FAB</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Target Spec Modal */}
      <Modal
        visible={!!selectedAsset}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedAsset(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>CONFIGURE PRODUCTION TARGET</Text>
                <Text style={styles.modalSub}>{selectedAsset?.assetNumber} - {currentShop}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedAsset(null)}>
                <Icon name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {TARGET_ASSET_TYPES.map(type => {
                const isSel = targetType === type.id;
                return (
                  <TouchableOpacity
                    key={type.id}
                    style={[styles.typeCard, isSel && styles.typeCardActive]}
                    onPress={() => setTargetType(type.id)}
                  >
                    <View style={styles.typeHeader}>
                      <Icon
                        name={isSel ? 'radiobox-marked' : 'radiobox-blank'}
                        size={18}
                        color={isSel ? '#059669' : '#64748b'}
                      />
                      <Text style={[styles.typeName, isSel && styles.typeNameActive]}>{type.name}</Text>
                    </View>
                    <Text style={styles.typeDesc}>{type.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.modalCancelBtn} 
                onPress={() => setSelectedAsset(null)}
              >
                <Text style={styles.modalCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalConfirmBtn} 
                onPress={handleConfirmStart}
              >
                <Icon name="check-bold" size={16} color="#FFFFFF" />
                <Text style={styles.modalConfirmText}>LAUNCH ORDER</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  backBtn: { padding: 8, marginRight: 8, marginLeft: -8 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  shopSelector: { marginBottom: 12 },
  shopLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 6, letterSpacing: 0.4 },
  shopScroll: { flexDirection: 'row' },
  shopChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  shopChipActive: { backgroundColor: '#059669', borderColor: '#059669' },
  shopChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  shopChipTextActive: { color: '#FFFFFF' },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  summaryText: { fontSize: 13, color: '#475569' },
  summaryBold: { fontWeight: 'bold', color: '#0f172a' },
  refreshBtn: { padding: 4 },
  list: { flex: 1 },
  assetCard: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assetInfo: { flex: 1, marginRight: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  assetTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
  assetSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  actionBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 96,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionBtnDisabled: { opacity: 0.7 },
  actionBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 36,
    marginTop: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyTitle: { fontSize: 15, fontWeight: 'bold', color: '#334155', marginTop: 10 },
  emptyText: { color: '#94a3b8', marginTop: 4, fontSize: 12, textAlign: 'center' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 14,
  },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  modalSub: { fontSize: 12, color: '#059669', fontWeight: '600', marginTop: 2 },
  modalBody: { marginBottom: 16 },
  typeCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  typeCardActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#059669',
  },
  typeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  typeName: { fontSize: 14, fontWeight: '700', color: '#334155' },
  typeNameActive: { color: '#059669' },
  typeDesc: { fontSize: 12, color: '#64748b', marginLeft: 26 },
  modalFooter: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
  },
  modalCancelText: { color: '#475569', fontWeight: 'bold', fontSize: 13 },
  modalConfirmBtn: {
    flex: 2,
    backgroundColor: '#059669',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  modalConfirmText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },
});
