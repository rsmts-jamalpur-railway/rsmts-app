import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, TextInput, Modal } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../../context/AuthContext';
import { RepairRepository } from '../../../database/v2/repositories/RepairRepository';
import { database } from '../../../database/v2';
import RepairCycle from '../../../database/v2/models/RepairCycle';
import { Q } from '@nozbe/watermelondb';

export default function ActiveRepairsScreen({ navigation }: any) {
  const { employeeId, assignedLocationId } = useAuth();
  
  const [cycles, setCycles] = useState<any[]>([]); // Using any[] here to include asset data fetched alongside
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [holdModalVisible, setHoldModalVisible] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);

  useEffect(() => {
    loadActiveCycles();
  }, [assignedLocationId]);

  const loadActiveCycles = async () => {
    try {
      // Query active repair cycles in this shop
      const activeCycles = await database.collections.get<RepairCycle>('repair_cycles')
        .query(
          Q.where('repair_shop_id', assignedLocationId || ''),
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
    setHoldReason('');
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

  const handleComplete = async (cycleId: string) => {
    Alert.alert(
      'Complete Repair',
      'Are you sure you want to complete this repair cycle and send to QA?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Complete', 
          onPress: async () => {
            setProcessingId(cycleId);
            try {
              await RepairRepository.closeRepair({
                repairCycleId: cycleId,
                finalRemarks: 'Completed via App',
                userId: employeeId || 'UNKNOWN',
              });
              
              Alert.alert('Success', 'Repair completed successfully (Offline).');
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

  return (
    <>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-left" size={24} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ACTIVE REPAIRS</Text>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color="#0A74DA" style={{ marginTop: 32 }} />
        ) : (
          <ScrollView style={styles.list}>
            {cycles.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="wrench" size={48} color="#94a3b8" />
                <Text style={styles.emptyText}>No active repairs.</Text>
              </View>
            ) : (
              cycles.map(({ cycle, asset }) => (
                <View key={cycle.id} style={styles.assetCard}>
                  <View style={styles.assetInfo}>
                    <Text style={styles.assetTitle}>{asset?.assetNumber || 'UNKNOWN'}</Text>
                    <Text style={styles.assetSub}>Category: {cycle.repairCategoryId}</Text>
                    <Text style={styles.assetSub}>Started: {new Date(cycle.startedAt).toLocaleDateString()}</Text>
                  </View>
                  
                  <View style={styles.actionColumn}>
                    <TouchableOpacity 
                      style={[styles.actionBtn, styles.holdBtn, processingId === cycle.id && styles.actionBtnDisabled]} 
                      onPress={() => handleHoldPress(cycle.id)}
                      disabled={processingId === cycle.id}
                    >
                      <Text style={[styles.actionBtnText, styles.holdBtnText]}>HOLD</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.actionBtn, styles.completeBtn, processingId === cycle.id && styles.actionBtnDisabled]} 
                      onPress={() => handleComplete(cycle.id)}
                      disabled={processingId === cycle.id}
                    >
                      <Text style={styles.actionBtnText}>COMPLETE</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>

      <Modal visible={holdModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Place Repair on Hold</Text>
            
            <Text style={styles.label}>Reason for hold *</Text>
            <TextInput 
              style={styles.input}
              value={holdReason}
              onChangeText={setHoldReason}
              placeholder="e.g. Waiting for parts"
              multiline
              numberOfLines={3}
            />

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setHoldModalVisible(false)}>
                <Text style={styles.cancelBtnText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={submitHold}>
                <Text style={styles.submitBtnText}>CONFIRM HOLD</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  backBtn: { padding: 8, marginRight: 8, marginLeft: -8 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  list: { flex: 1 },
  assetCard: {
    backgroundColor: '#FFFFFF', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0',
    marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  assetInfo: { flex: 1 },
  assetTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
  assetSub: { fontSize: 14, color: '#64748b', marginBottom: 2 },
  actionColumn: { flexDirection: 'column', gap: 8, marginLeft: 16 },
  actionBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, minWidth: 90, alignItems: 'center' },
  holdBtn: { backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fbbf24' },
  holdBtnText: { color: '#d97706' },
  completeBtn: { backgroundColor: '#10b981' },
  actionBtnDisabled: { opacity: 0.7 },
  actionBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 48, marginTop: 32 },
  emptyText: { color: '#94a3b8', marginTop: 16, fontSize: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 8 },
  modalTitle: { color: '#0f172a', fontSize: 16, fontWeight: '800', marginBottom: 16 },
  label: { fontSize: 14, color: '#475569', marginBottom: 8, fontWeight: '600' },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, fontSize: 16, color: '#0f172a', minHeight: 80, textAlignVertical: 'top' },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: { flex: 1, backgroundColor: '#f1f5f9', padding: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1' },
  cancelBtnText: { color: '#0f172a', fontWeight: '700' },
  submitBtn: { flex: 1, backgroundColor: '#fbbf24', padding: 12, borderRadius: 8, alignItems: 'center' },
  submitBtnText: { color: '#FFFFFF', fontWeight: '800' },
});
