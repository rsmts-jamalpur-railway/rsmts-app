import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, TextInput, Modal } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../../context/AuthContext';
import { RepairRepository } from '../../../database/v2/repositories/RepairRepository';
import { database } from '../../../database/v2';
import RepairCycle from '../../../database/v2/models/RepairCycle';
import Asset from '../../../database/v2/models/Asset';
import { Q } from '@nozbe/watermelondb';

const SHOPS = [
  { id: 'WRS-1', name: 'WRS-1 (POH)' },
  { id: 'WRS-2', name: 'WRS-2 (Rehab)' },
  { id: 'WRS-3', name: 'WRS-3 (Underframe)' },
  { id: 'WRS-4', name: 'WRS-4 (Bogie)' },
  { id: 'DPS', name: 'DPS (Loco POH)' },
];

const QUICK_HOLD_REASONS = [
  'Awaiting wheelset & axle delivery from GIF',
  'Roller bearing cartridge assembly out of stock',
  'Pneumatic brake distributor valve overhaul required',
  'Heavy crane / hoist breakdown in bay',
  'Awaiting non-destructive testing (NDT) clearance',
  'Underframe structural crack detected - engineering review',
];

export default function ActiveRepairsScreen({ navigation }: any) {
  const { employeeId, assignedLocationId } = useAuth();
  
  const [currentShop, setCurrentShop] = useState(assignedLocationId || 'WRS-1');
  const [cycles, setCycles] = useState<any[]>([]); // { cycle: RepairCycle, asset: Asset }
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Hold Modal
  const [holdModalVisible, setHoldModalVisible] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);

  useEffect(() => {
    loadActiveCycles();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentShop]);

  const loadActiveCycles = async () => {
    try {
      setIsLoading(true);
      // Query active repair cycles in this shop
      const activeCycles = await database.collections.get<RepairCycle>('repair_cycles')
        .query(
          Q.where('repair_shop_id', currentShop),
          Q.where('status', 'IN_PROGRESS')
        )
        .fetch();
        
      // Fetch associated assets for display
      const cycleData = await Promise.all(activeCycles.map(async (cycle) => {
        const asset = await cycle.asset.fetch();
        return { cycle, asset };
      }));

      setCycles(cycleData);
    } catch (error) {
      console.error('Error loading active repairs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleHoldPress = (cycleId: string) => {
    setSelectedCycleId(cycleId);
    setHoldReason(QUICK_HOLD_REASONS[0]);
    setHoldModalVisible(true);
  };

  const submitHold = async () => {
    if (!holdReason.trim() || !selectedCycleId) {
      Alert.alert('Validation Error', 'Hold reason is required.');
      return;
    }

    setProcessingId(selectedCycleId);
    setHoldModalVisible(false);

    try {
      await RepairRepository.holdRepair({
        repairCycleId: selectedCycleId,
        reason: holdReason.trim(),
        userId: employeeId || 'UNKNOWN',
      });
      
      Alert.alert('Success', 'Repair placed on hold (Offline).');
      loadActiveCycles();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to hold repair.');
    } finally {
      setProcessingId(null);
      setSelectedCycleId(null);
    }
  };

  const handleComplete = async (cycleId: string, assetNumber: string) => {
    Alert.alert(
      'Complete Overhaul Cycle',
      `Complete overhaul for ${assetNumber} and submit to QA Inspection?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Send to QA', 
          onPress: async () => {
            setProcessingId(cycleId);
            try {
              await RepairRepository.closeRepair({
                repairCycleId: cycleId,
                finalRemarks: `Overhaul completed in ${currentShop} by ${employeeId || 'Supervisor'}.`,
                userId: employeeId || 'UNKNOWN',
              });
              
              Alert.alert('Overhaul Completed', `Asset ${assetNumber} forwarded to QA Inspector queue.`);
              loadActiveCycles();
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Failed to complete repair.');
            } finally {
              setProcessingId(null);
            }
          }
        }
      ]
    );
  };

  const handleReportMissing = async (asset: Asset) => {
    Alert.alert(
      'Report Missing Stock',
      `Flag ${asset.assetNumber} as MISSING from shop floor? This will trigger an immediate exception alert.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report Missing',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(asset.id);
            try {
              await RepairRepository.reportMissing({
                assetId: asset.id,
                userId: employeeId || 'UNKNOWN',
              });

              Alert.alert('Reported Missing', `Asset ${asset.assetNumber} marked as Missing and logged to exceptions.`);
              loadActiveCycles();
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Failed to report missing.');
            } finally {
              setProcessingId(null);
            }
          }
        }
      ]
    );
  };

  return (
    <>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-left" size={24} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ACTIVE OVERHAUL WORK</Text>
        </View>

        {/* Shop Selector */}
        <View style={styles.shopSelector}>
          <Text style={styles.shopLabel}>SHOP FLOOR:</Text>
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

        {/* Active Metric Bar */}
        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>
            Stock undergoing overhaul in <Text style={styles.summaryBold}>{currentShop}</Text>: {cycles.length}
          </Text>
          <TouchableOpacity onPress={loadActiveCycles} style={styles.refreshBtn}>
            <Icon name="refresh" size={18} color="#0A74DA" />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color="#0A74DA" style={{ marginTop: 32 }} />
        ) : (
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {cycles.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="wrench-outline" size={48} color="#94a3b8" />
                <Text style={styles.emptyTitle}>No Active Overhauls</Text>
                <Text style={styles.emptyText}>
                  Start an overhaul from the Incoming tab to see active repairs here.
                </Text>
              </View>
            ) : (
              cycles.map(({ cycle, asset }) => (
                <View key={cycle.id} style={styles.assetCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.assetTitleRow}>
                      <Icon
                        name={asset?.assetCategory === 'LOCO' ? 'train' : 'train-car'}
                        size={18}
                        color="#0369a1"
                      />
                      <Text style={styles.assetTitle}>{asset?.assetNumber || 'UNKNOWN'}</Text>
                    </View>
                    <View style={styles.catBadge}>
                      <Text style={styles.catBadgeText}>{cycle.repairCategoryId}</Text>
                    </View>
                  </View>

                  <View style={styles.detailsRow}>
                    <Text style={styles.detailText}>
                      Started: {new Date(cycle.startedAt).toLocaleDateString()}
                    </Text>
                    <Text style={styles.detailText}>
                      Status: <Text style={{ color: '#0284c7', fontWeight: 'bold' }}>{cycle.status}</Text>
                    </Text>
                  </View>

                  {/* Operational Controls */}
                  <View style={styles.buttonRow}>
                    <TouchableOpacity 
                      style={[styles.btn, styles.holdBtn, processingId === cycle.id && styles.btnDisabled]} 
                      onPress={() => handleHoldPress(cycle.id)}
                      disabled={processingId === cycle.id}
                    >
                      <Icon name="pause" size={14} color="#d97706" />
                      <Text style={styles.holdBtnText}>HOLD</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.btn, styles.missingBtn, processingId === asset?.id && styles.btnDisabled]} 
                      onPress={() => asset && handleReportMissing(asset)}
                      disabled={processingId === asset?.id}
                    >
                      <Icon name="alert-octagon-outline" size={14} color="#b91c1c" />
                      <Text style={styles.missingBtnText}>MISSING</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.btn, styles.completeBtn, processingId === cycle.id && styles.btnDisabled]} 
                      onPress={() => handleComplete(cycle.id, asset?.assetNumber || '')}
                      disabled={processingId === cycle.id}
                    >
                      <Icon name="check-bold" size={14} color="#FFFFFF" />
                      <Text style={styles.completeBtnText}>SEND TO QA</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>

      {/* Place on Hold Modal */}
      <Modal visible={holdModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>PLACE OVERHAUL ON HOLD</Text>
              <TouchableOpacity onPress={() => setHoldModalVisible(false)}>
                <Icon name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.label}>Quick-Select Reason</Text>
            <ScrollView style={{ maxHeight: 180, marginBottom: 12 }}>
              {QUICK_HOLD_REASONS.map(reason => {
                const isSel = holdReason === reason;
                return (
                  <TouchableOpacity
                    key={reason}
                    style={[styles.reasonChip, isSel && styles.reasonChipActive]}
                    onPress={() => setHoldReason(reason)}
                  >
                    <Icon
                      name={isSel ? 'radiobox-marked' : 'radiobox-blank'}
                      size={16}
                      color={isSel ? '#d97706' : '#64748b'}
                    />
                    <Text style={[styles.reasonText, isSel && styles.reasonTextActive]}>
                      {reason}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.label}>Custom Remarks</Text>
            <TextInput 
              style={styles.input}
              value={holdReason}
              onChangeText={setHoldReason}
              placeholder="Enter specific bottleneck or indent details..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={2}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.modalCancelBtn} 
                onPress={() => setHoldModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalSubmitBtn} 
                onPress={submitHold}
              >
                <Icon name="pause" size={16} color="#FFFFFF" />
                <Text style={styles.modalSubmitText}>CONFIRM HOLD</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', padding: 16 },
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
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  assetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  assetTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
  catBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  catBadgeText: { fontSize: 11, fontWeight: '700', color: '#0369a1' },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  detailText: { fontSize: 12, color: '#64748b' },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  holdBtn: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
    flex: 1,
  },
  holdBtnText: { color: '#b45309', fontWeight: 'bold', fontSize: 11 },
  missingBtn: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    flex: 1.1,
  },
  missingBtnText: { color: '#b91c1c', fontWeight: 'bold', fontSize: 11 },
  completeBtn: {
    backgroundColor: '#059669',
    flex: 1.6,
  },
  completeBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 11 },
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
    maxHeight: '85%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: { color: '#0f172a', fontSize: 16, fontWeight: '800' },
  label: { fontSize: 12, color: '#475569', marginBottom: 6, fontWeight: '700' },
  reasonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 6,
  },
  reasonChipActive: {
    backgroundColor: '#fffbeb',
    borderColor: '#fcd34d',
  },
  reasonText: { fontSize: 12, color: '#334155', flex: 1 },
  reasonTextActive: { color: '#b45309', fontWeight: '600' },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#0f172a',
    minHeight: 54,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  modalCancelText: { color: '#0f172a', fontWeight: '700', fontSize: 13 },
  modalSubmitBtn: {
    flex: 2,
    backgroundColor: '#d97706',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  modalSubmitText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
});
