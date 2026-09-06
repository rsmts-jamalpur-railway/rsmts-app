import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, TextInput, Modal } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../../context/AuthContext';
import { YardRepository } from '../../../database/v2/repositories/YardRepository';
import { database } from '../../../database/v2';
import Asset from '../../../database/v2/models/Asset';
import { Q } from '@nozbe/watermelondb';

const DESTINATION_RAILWAYS = [
  { code: 'ER', name: 'Eastern Railway (ER)' },
  { code: 'ECR', name: 'East Central Railway (ECR)' },
  { code: 'NR', name: 'Northern Railway (NR)' },
  { code: 'SER', name: 'South Eastern Railway (SER)' },
  { code: 'NCR', name: 'North Central Railway (NCR)' },
  { code: 'CR', name: 'Central Railway (CR)' },
  { code: 'WR', name: 'Western Railway (WR)' },
  { code: 'SR', name: 'Southern Railway (SR)' },
];

export default function NSYOutScreen({ navigation }: any) {
  const { employeeId } = useAuth();
  
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dispatchingAsset, setDispatchingAsset] = useState<Asset | null>(null);
  
  // Modal form states
  const [selectedDestination, setSelectedDestination] = useState('ER');
  const [trainNumber, setTrainNumber] = useState('');
  const [rakeNumber, setRakeNumber] = useState('');
  const [dispatchRemarks, setDispatchRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadFitAssets();
  }, []);

  const loadFitAssets = async () => {
    try {
      setIsLoading(true);
      // Query assets ready for dispatch (marked FIT by QA Inspector or completed overhaul)
      const fitAssets = await database.collections.get<Asset>('assets')
        .query(
          Q.where('current_status', Q.oneOf(['FIT', 'QA_PASSED', 'READY_FOR_DISPATCH', 'Fit']))
        )
        .fetch();
        
      setAssets(fitAssets);
    } catch (error) {
      console.error('Error loading fit assets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openDispatchModal = (asset: Asset) => {
    setDispatchingAsset(asset);
    setSelectedDestination('ER');
    setTrainNumber('');
    setRakeNumber('');
    setDispatchRemarks('');
  };

  const closeDispatchModal = () => {
    if (isSubmitting) return;
    setDispatchingAsset(null);
  };

  const handleConfirmDispatch = async () => {
    if (!dispatchingAsset) return;

    setIsSubmitting(true);
    try {
      await YardRepository.dispatchAsset({
        assetId: dispatchingAsset.id,
        userId: employeeId || 'UNKNOWN',
        toRailway: selectedDestination,
        trainNumber: trainNumber.trim() || undefined,
        rakeNumber: rakeNumber.trim() || undefined,
        remarks: dispatchRemarks.trim() || undefined,
      });

      Alert.alert(
        'Dispatched Successfully',
        `Asset ${dispatchingAsset.assetNumber} has been dispatched to ${selectedDestination}. Transaction saved to offline outbox.`
      );
      setDispatchingAsset(null);
      loadFitAssets();
    } catch (error: any) {
      console.error('Dispatch error:', error);
      Alert.alert('Dispatch Error', error?.message || 'Failed to dispatch asset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>NSY OUTBOUND DISPATCH</Text>
      </View>

      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>FIT ASSETS READY</Text>
          <Text style={styles.summaryValue}>{assets.length}</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadFitAssets}>
          <Icon name="refresh" size={20} color="#0A74DA" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#0A74DA" style={{ marginTop: 32 }} />
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {assets.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="check-decagram-outline" size={56} color="#94a3b8" />
              <Text style={styles.emptyTitle}>No Assets Awaiting Outbound Dispatch</Text>
              <Text style={styles.emptyText}>
                Assets certified as "FIT" by the QA Inspection shop will appear here automatically.
              </Text>
            </View>
          ) : (
            assets.map(asset => (
              <View key={asset.id} style={styles.assetCard}>
                <View style={styles.assetInfo}>
                  <View style={styles.assetHeader}>
                    <Icon
                      name={asset.assetCategory === 'LOCO' ? 'train' : 'train-car'}
                      size={18}
                      color="#0369a1"
                    />
                    <Text style={styles.assetTitle}>{asset.assetNumber}</Text>
                  </View>
                  <View style={styles.badgeRow}>
                    <View style={styles.fitBadge}>
                      <Icon name="check-circle" size={12} color="#166534" />
                      <Text style={styles.fitBadgeText}>QA FIT CERTIFIED</Text>
                    </View>
                    <Text style={styles.assetSub}>Loc: {asset.currentLocationId}</Text>
                  </View>
                </View>
                
                <TouchableOpacity 
                  style={styles.dispatchBtn} 
                  onPress={() => openDispatchModal(asset)}
                >
                  <Icon name="train-car" size={16} color="#FFFFFF" />
                  <Text style={styles.dispatchBtnText}>DISPATCH</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Dispatch Modal Form */}
      <Modal
        visible={!!dispatchingAsset}
        transparent
        animationType="slide"
        onRequestClose={closeDispatchModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>CONFIRM NSY DISPATCH</Text>
                <Text style={styles.modalSub}>{dispatchingAsset?.assetNumber}</Text>
              </View>
              <TouchableOpacity onPress={closeDispatchModal} style={styles.closeBtn}>
                <Icon name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              {/* Destination Railway */}
              <Text style={styles.inputLabel}>Destination Railway Zone *</Text>
              <View style={styles.railwayGrid}>
                {DESTINATION_RAILWAYS.map(r => {
                  const isSel = selectedDestination === r.code;
                  return (
                    <TouchableOpacity
                      key={r.code}
                      style={[styles.railwayChip, isSel && styles.railwayChipActive]}
                      onPress={() => setSelectedDestination(r.code)}
                    >
                      <Text style={[styles.railwayCode, isSel && styles.railwayTextActive]}>{r.code}</Text>
                      <Text style={[styles.railwayName, isSel && styles.railwayTextActive]}>{r.name.split(' ')[0]}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Outbound Train Number */}
              <Text style={styles.inputLabel}>Outbound Train Number (Optional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. TR-13401 / GOODS-SPL-08"
                placeholderTextColor="#94a3b8"
                value={trainNumber}
                onChangeText={setTrainNumber}
                autoCapitalize="characters"
              />

              {/* Outbound Rake Number */}
              <Text style={styles.inputLabel}>Outbound Rake ID (Optional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. RAKE-SER-449"
                placeholderTextColor="#94a3b8"
                value={rakeNumber}
                onChangeText={setRakeNumber}
                autoCapitalize="characters"
              />

              {/* Inspection / Handover Remarks */}
              <Text style={styles.inputLabel}>Handover & Waybill Remarks</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                placeholder="Brake test certificates verified, train crew handover notes..."
                placeholderTextColor="#94a3b8"
                value={dispatchRemarks}
                onChangeText={setDispatchRemarks}
                multiline
                numberOfLines={3}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.cancelBtn} 
                onPress={closeDispatchModal}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelBtnText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.confirmBtn, isSubmitting && styles.btnDisabled]} 
                onPress={handleConfirmDispatch}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Icon name="check-bold" size={16} color="#FFFFFF" />
                    <Text style={styles.confirmBtnText}>DISPATCH OUT</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backBtn: {
    padding: 8,
    marginRight: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.3,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#059669',
  },
  refreshBtn: {
    padding: 6,
  },
  list: {
    flex: 1,
  },
  assetCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assetInfo: {
    flex: 1,
    marginRight: 12,
  },
  assetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  assetTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  fitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  fitBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  assetSub: {
    fontSize: 12,
    color: '#64748b',
  },
  dispatchBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dispatchBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 36,
    marginTop: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#334155',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    marginTop: 6,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '85%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  modalSub: {
    fontSize: 13,
    color: '#0A74DA',
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    marginTop: 10,
  },
  railwayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  railwayChip: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 64,
  },
  railwayChipActive: {
    backgroundColor: '#0A74DA',
    borderColor: '#0A74DA',
  },
  railwayCode: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#334155',
  },
  railwayName: {
    fontSize: 9,
    color: '#64748b',
  },
  railwayTextActive: {
    color: '#FFFFFF',
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  modalTextArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#475569',
    fontWeight: 'bold',
    fontSize: 13,
  },
  confirmBtn: {
    flex: 2,
    backgroundColor: '#059669',
    padding: 14,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
