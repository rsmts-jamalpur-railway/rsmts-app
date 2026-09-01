import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../../context/AuthContext';
import { RepairRepository } from '../../../database/v2/repositories/RepairRepository';
import { database } from '../../../database/v2';
import RepairCycle from '../../../database/v2/models/RepairCycle';
import { Q } from '@nozbe/watermelondb';

export default function OnHoldScreen({ navigation }: any) {
  const { employeeId, assignedLocationId } = useAuth();
  
  const [cycles, setCycles] = useState<any[]>([]); // Array of { cycle, asset, holdReason }
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadOnHoldCycles();
  }, [assignedLocationId]);

  const loadOnHoldCycles = async () => {
    try {
      const holdCycles = await database.collections.get<RepairCycle>('repair_cycles')
        .query(
          Q.where('repair_shop_id', assignedLocationId || ''),
          Q.where('status', 'ON_HOLD')
        )
        .fetch();
        
      const cycleData = await Promise.all(holdCycles.map(async (cycle) => {
        const asset = await cycle.asset.fetch();
        const holds = await cycle.repairHolds.fetch();
        const activeHold = holds.find((h: any) => !h.holdEnd);
        return { cycle, asset, holdReason: activeHold?.holdReason || 'Unknown' };
      }));

      setCycles(cycleData);
    } catch (error) {
      console.error('Error loading on-hold repairs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResume = async (cycleId: string) => {
    Alert.alert(
      'Resume Repair',
      'Are you sure you want to resume this repair?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Resume', 
          onPress: async () => {
            setProcessingId(cycleId);
            try {
              await RepairRepository.resumeRepair({
                repairCycleId: cycleId,
                userId: employeeId || 'UNKNOWN',
              });
              
              Alert.alert('Success', 'Repair resumed successfully (Offline).');
              loadOnHoldCycles();
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Failed to resume repair.');
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
        <Text style={styles.headerTitle}>ON HOLD</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#0A74DA" style={{ marginTop: 32 }} />
      ) : (
        <ScrollView style={styles.list}>
          {cycles.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="pause-circle-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyText}>No repairs on hold.</Text>
            </View>
          ) : (
            cycles.map(({ cycle, asset, holdReason }) => (
              <View key={cycle.id} style={styles.assetCard}>
                <View style={styles.assetInfo}>
                  <Text style={styles.assetTitle}>{asset?.assetNumber || 'UNKNOWN'}</Text>
                  <Text style={styles.assetSub}>Category: {cycle.repairCategoryId}</Text>
                  <Text style={[styles.assetSub, styles.holdReasonText]}>Reason: {holdReason}</Text>
                </View>
                
                <TouchableOpacity 
                  style={[styles.actionBtn, processingId === cycle.id && styles.actionBtnDisabled]} 
                  onPress={() => handleResume(cycle.id)}
                  disabled={processingId === cycle.id}
                >
                  {processingId === cycle.id ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.actionBtnText}>RESUME</Text>
                  )}
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  backBtn: { padding: 8, marginRight: 8, marginLeft: -8 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  list: { flex: 1 },
  assetCard: {
    backgroundColor: '#fffbeb', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#fde68a',
    marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  assetInfo: { flex: 1, paddingRight: 16 },
  assetTitle: { fontSize: 16, fontWeight: 'bold', color: '#92400e', marginBottom: 4 },
  assetSub: { fontSize: 14, color: '#b45309', marginBottom: 2 },
  holdReasonText: { fontStyle: 'italic', marginTop: 4 },
  actionBtn: { backgroundColor: '#0A74DA', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, minWidth: 90, alignItems: 'center' },
  actionBtnDisabled: { opacity: 0.7 },
  actionBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 48, marginTop: 32 },
  emptyText: { color: '#94a3b8', marginTop: 16, fontSize: 16 }
});
