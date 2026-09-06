import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../../context/AuthContext';
import { RepairRepository } from '../../../database/v2/repositories/RepairRepository';
import { database } from '../../../database/v2';
import RepairCycle from '../../../database/v2/models/RepairCycle';
import { Q } from '@nozbe/watermelondb';

const SHOPS = [
  { id: 'WRS-1', name: 'WRS-1 (POH)' },
  { id: 'WRS-2', name: 'WRS-2 (Rehab)' },
  { id: 'WRS-3', name: 'WRS-3 (Underframe)' },
  { id: 'WRS-4', name: 'WRS-4 (Bogie)' },
  { id: 'DPS', name: 'DPS (Loco POH)' },
];

export default function OnHoldScreen({ navigation }: any) {
  const { employeeId, assignedLocationId } = useAuth();
  
  const [currentShop, setCurrentShop] = useState(assignedLocationId || 'WRS-1');
  const [cycles, setCycles] = useState<any[]>([]); // Array of { cycle, asset, holdReason, holdStart }
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadOnHoldCycles();
  }, [currentShop]);

  const loadOnHoldCycles = async () => {
    try {
      setIsLoading(true);
      const holdCycles = await database.collections.get<RepairCycle>('repair_cycles')
        .query(
          Q.where('repair_shop_id', currentShop),
          Q.where('status', 'ON_HOLD')
        )
        .fetch();
        
      const cycleData = await Promise.all(holdCycles.map(async (cycle) => {
        const asset = await cycle.asset.fetch();
        const holds = await cycle.repairHolds.fetch();
        const activeHold = holds.find((h: any) => !h.holdEnd);
        return { 
          cycle, 
          asset, 
          holdReason: activeHold?.holdReason || 'Materials / Parts Delay',
          holdStart: activeHold?.holdStart || cycle.startedAt
        };
      }));

      setCycles(cycleData);
    } catch (error) {
      console.error('Error loading on-hold repairs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResume = async (cycleId: string, assetNumber: string) => {
    Alert.alert(
      'Resume Repair Cycle',
      `Resume active overhaul work for ${assetNumber}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Resume Overhaul', 
          onPress: async () => {
            setProcessingId(cycleId);
            try {
              await RepairRepository.resumeRepair({
                repairCycleId: cycleId,
                userId: employeeId || 'UNKNOWN',
              });
              
              Alert.alert('Repair Resumed', `Asset ${assetNumber} moved back to Active Repairs queue.`);
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
        <Text style={styles.headerTitle}>ON-HOLD REPAIR QUEUE</Text>
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

      {/* Metric Bar */}
      <View style={styles.summaryBar}>
        <Text style={styles.summaryText}>
          Stock on hold in <Text style={styles.summaryBold}>{currentShop}</Text>: {cycles.length}
        </Text>
        <TouchableOpacity onPress={loadOnHoldCycles} style={styles.refreshBtn}>
          <Icon name="refresh" size={18} color="#0A74DA" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#0A74DA" style={{ marginTop: 32 }} />
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {cycles.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="pause-circle-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyTitle}>No Repairs on Hold</Text>
              <Text style={styles.emptyText}>
                No overhaul cycles in {currentShop} are currently blocked by material shortage.
              </Text>
            </View>
          ) : (
            cycles.map(({ cycle, asset, holdReason, holdStart }) => (
              <View key={cycle.id} style={styles.assetCard}>
                <View style={styles.assetInfo}>
                  <View style={styles.titleRow}>
                    <Icon
                      name={asset?.assetCategory === 'LOCO' ? 'train' : 'train-car'}
                      size={18}
                      color="#92400e"
                    />
                    <Text style={styles.assetTitle}>{asset?.assetNumber || 'UNKNOWN'}</Text>
                    <View style={styles.catBadge}>
                      <Text style={styles.catBadgeText}>{cycle.repairCategoryId}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.reasonBox}>
                    <Icon name="alert-circle-outline" size={14} color="#b45309" />
                    <Text style={styles.holdReasonText}>{holdReason}</Text>
                  </View>

                  <Text style={styles.timeText}>
                    On hold since: {new Date(holdStart).toLocaleDateString()} ({new Date(holdStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                  </Text>
                </View>
                
                <TouchableOpacity 
                  style={[styles.actionBtn, processingId === cycle.id && styles.actionBtnDisabled]} 
                  onPress={() => handleResume(cycle.id, asset?.assetNumber || '')}
                  disabled={processingId === cycle.id}
                >
                  {processingId === cycle.id ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Icon name="play" size={14} color="#FFFFFF" />
                      <Text style={styles.actionBtnText}>RESUME</Text>
                    </>
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
  shopChipActive: { backgroundColor: '#d97706', borderColor: '#d97706' },
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
    backgroundColor: '#fffbeb',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assetInfo: { flex: 1, paddingRight: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  assetTitle: { fontSize: 15, fontWeight: 'bold', color: '#92400e' },
  catBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  catBadgeText: { fontSize: 10, fontWeight: '700', color: '#92400e' },
  reasonBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef3c7',
    padding: 8,
    borderRadius: 6,
    marginBottom: 6,
  },
  holdReasonText: { fontSize: 12, color: '#92400e', fontWeight: '500', flex: 1 },
  timeText: { fontSize: 11, color: '#b45309' },
  actionBtn: {
    backgroundColor: '#d97706',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 84,
    alignItems: 'center',
    flexDirection: 'row',
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
  emptyText: { color: '#94a3b8', marginTop: 4, fontSize: 12, textAlign: 'center' }
});
