import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../../context/AuthContext';
import { RepairRepository } from '../../../database/v2/repositories/RepairRepository';
import { database } from '../../../database/v2';
import Asset from '../../../database/v2/models/Asset';
import { Q } from '@nozbe/watermelondb';

const SHOPS = [
  { id: 'WRS-1', name: 'WRS-1 (POH)' },
  { id: 'WRS-2', name: 'WRS-2 (Rehab)' },
  { id: 'WRS-3', name: 'WRS-3 (Underframe)' },
  { id: 'WRS-4', name: 'WRS-4 (Bogie)' },
  { id: 'DPS', name: 'DPS (Loco POH)' },
];

const REPAIR_CATEGORIES = [
  { id: 'POH', name: 'POH - Periodic Overhaul', desc: 'Complete teardown, wheel turning & air brake overhaul' },
  { id: 'ROH', name: 'ROH - Routine Overhaul', desc: 'Intermediate schedule bogie & bearing inspection' },
  { id: 'NPOH', name: 'NPOH - Non-Periodic Repair', desc: 'Unscheduled repairs, spring replacements & weld fixes' },
  { id: 'SPECIAL_REPAIR', name: 'Special Repair / Accident', desc: 'Derailment repair, chassis alignment & heavy body fab' },
];

export default function IncomingScreen({ navigation }: any) {
  const { employeeId, assignedLocationId } = useAuth();
  
  const [currentShop, setCurrentShop] = useState(assignedLocationId || 'WRS-1');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Category Selection Modal State
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('POH');

  useEffect(() => {
    loadIncomingAssets();
  }, [currentShop]);

  const loadIncomingAssets = async () => {
    try {
      setIsLoading(true);
      // Query assets allocated to this specific shop
      const incoming = await database.collections.get<Asset>('assets')
        .query(
          Q.where('current_location_id', currentShop),
          Q.where('current_status', Q.oneOf(['Allocated', 'ALLOCATED']))
        )
        .fetch();
        
      setAssets(incoming);
    } catch (error) {
      console.error('Error loading incoming assets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openCategoryModal = (asset: Asset) => {
    setSelectedAsset(asset);
    setSelectedCategory('POH');
  };

  const handleConfirmStartRepair = async () => {
    if (!selectedAsset) return;

    setProcessingId(selectedAsset.id);
    const assetNum = selectedAsset.assetNumber;
    setSelectedAsset(null);

    try {
      await RepairRepository.startRepair({
        assetId: selectedAsset.id,
        shopId: currentShop,
        repairCategoryId: selectedCategory,
        userId: employeeId || 'UNKNOWN',
      });

      Alert.alert('Success', `Repair started for ${assetNum} under ${selectedCategory}. Saved offline.`);
      loadIncomingAssets();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to start repair.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectToYard = async (asset: Asset) => {
    Alert.alert(
      'Reject Stock to Yard',
      `Reject ${asset.assetNumber} back to NSY Yard Master?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reject to NSY', 
          style: 'destructive',
          onPress: async () => {
            setProcessingId(asset.id);
            try {
              await RepairRepository.rejectRepair({
                assetId: asset.id,
                userId: employeeId || 'UNKNOWN',
              });

              Alert.alert('Returned to Yard', `Asset ${asset.assetNumber} returned to NSY intake queue.`);
              loadIncomingAssets();
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Failed to reject asset.');
            } finally {
              setProcessingId(null);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>INCOMING ALLOCATIONS</Text>
      </View>

      {/* Shop Selector */}
      <View style={styles.shopSelector}>
        <Text style={styles.shopLabel}>SHOP QUEUE:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shopScroll}>
          {SHOPS.map(s => {
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

      {/* Summary Banner */}
      <View style={styles.summaryBar}>
        <Text style={styles.summaryText}>
          Awaiting intake in <Text style={styles.summaryBold}>{currentShop}</Text>: {assets.length}
        </Text>
        <TouchableOpacity onPress={loadIncomingAssets} style={styles.refreshBtn}>
          <Icon name="refresh" size={18} color="#0A74DA" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#0A74DA" style={{ marginTop: 32 }} />
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {assets.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="inbox-arrow-down" size={48} color="#94a3b8" />
              <Text style={styles.emptyTitle}>No Incoming Allocations</Text>
              <Text style={styles.emptyText}>
                Wagons or stock allocated to {currentShop} by the Yard Master will appear here.
              </Text>
            </View>
          ) : (
            assets.map(asset => (
              <View key={asset.id} style={styles.assetCard}>
                <View style={styles.assetInfo}>
                  <View style={styles.assetTitleRow}>
                    <Icon
                      name={asset.assetCategory === 'LOCO' ? 'train' : 'train-car'}
                      size={18}
                      color="#0284c7"
                    />
                    <Text style={styles.assetTitle}>{asset.assetNumber}</Text>
                  </View>
                  <Text style={styles.assetSub}>Category: {asset.assetCategory || 'WAGON'}</Text>
                  <Text style={styles.assetSub}>Allocated To: {asset.currentLocationId}</Text>
                </View>
                
                <View style={styles.actionCol}>
                  <TouchableOpacity 
                    style={[styles.startBtn, processingId === asset.id && styles.btnDisabled]} 
                    onPress={() => openCategoryModal(asset)}
                    disabled={processingId === asset.id}
                  >
                    {processingId === asset.id ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Icon name="wrench" size={14} color="#FFFFFF" />
                        <Text style={styles.startBtnText}>START</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.rejectBtn, processingId === asset.id && styles.btnDisabled]} 
                    onPress={() => handleRejectToYard(asset)}
                    disabled={processingId === asset.id}
                  >
                    <Icon name="arrow-u-left-top" size={14} color="#b91c1c" />
                    <Text style={styles.rejectBtnText}>REJECT</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Category Selection Modal */}
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
                <Text style={styles.modalTitle}>SELECT REPAIR CATEGORY</Text>
                <Text style={styles.modalSub}>{selectedAsset?.assetNumber} - {currentShop}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedAsset(null)}>
                <Icon name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {REPAIR_CATEGORIES.map(cat => {
                const isSel = selectedCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.catCard, isSel && styles.catCardActive]}
                    onPress={() => setSelectedCategory(cat.id)}
                  >
                    <View style={styles.catHeader}>
                      <Icon
                        name={isSel ? 'radiobox-marked' : 'radiobox-blank'}
                        size={18}
                        color={isSel ? '#0A74DA' : '#64748b'}
                      />
                      <Text style={[styles.catName, isSel && styles.catNameActive]}>{cat.name}</Text>
                    </View>
                    <Text style={styles.catDesc}>{cat.desc}</Text>
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
                onPress={handleConfirmStartRepair}
              >
                <Icon name="check-bold" size={16} color="#FFFFFF" />
                <Text style={styles.modalConfirmText}>BEGIN OVERHAUL</Text>
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
  shopChipActive: { backgroundColor: '#0A74DA', borderColor: '#0A74DA' },
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
  assetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  assetTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
  assetSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  actionCol: { gap: 6 },
  startBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'center',
    minWidth: 80,
  },
  startBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
  rejectBtn: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'center',
    minWidth: 80,
  },
  rejectBtnText: { color: '#b91c1c', fontWeight: 'bold', fontSize: 11 },
  btnDisabled: { opacity: 0.6 },
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
  modalSub: { fontSize: 12, color: '#0A74DA', fontWeight: '600', marginTop: 2 },
  modalBody: { marginBottom: 16 },
  catCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  catCardActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#0A74DA',
  },
  catHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  catName: { fontSize: 14, fontWeight: '700', color: '#334155' },
  catNameActive: { color: '#0A74DA' },
  catDesc: { fontSize: 12, color: '#64748b', marginLeft: 26 },
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
    backgroundColor: '#0284c7',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  modalConfirmText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },
});
