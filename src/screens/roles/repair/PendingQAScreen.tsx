import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../../context/AuthContext';
import { database } from '../../../database/v2';
import RepairCycle from '../../../database/v2/models/RepairCycle';
import { Q } from '@nozbe/watermelondb';

export default function PendingQAScreen({ navigation }: any) {
  const { assignedLocationId } = useAuth();
  
  const [cycles, setCycles] = useState<any[]>([]); // Array of { cycle, asset }
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPendingQACycles();
  }, [assignedLocationId]);

  const loadPendingQACycles = async () => {
    try {
      const completedCycles = await database.collections.get<RepairCycle>('repair_cycles')
        .query(
          Q.where('repair_shop_id', assignedLocationId || ''),
          Q.where('status', 'COMPLETED')
        )
        .fetch();
        
      const cycleData = await Promise.all(completedCycles.map(async (cycle) => {
        const asset = await cycle.asset.fetch();
        return { cycle, asset };
      }));

      setCycles(cycleData);
    } catch (error) {
      console.error('Error loading pending QA repairs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PENDING QA</Text>
      </View>

      <Text style={styles.sectionTitle}>Completed Repairs Awaiting QA Inspection</Text>

      {isLoading ? (
        <ActivityIndicator size="large" color="#0A74DA" style={{ marginTop: 32 }} />
      ) : (
        <ScrollView style={styles.list}>
          {cycles.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="shield-check-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyText}>No repairs pending QA.</Text>
            </View>
          ) : (
            cycles.map(({ cycle, asset }) => (
              <View key={cycle.id} style={styles.assetCard}>
                <View style={styles.assetInfo}>
                  <Text style={styles.assetTitle}>{asset?.assetNumber || 'UNKNOWN'}</Text>
                  <Text style={styles.assetSub}>Category: {cycle.repairCategoryId}</Text>
                  <Text style={styles.assetSub}>Completed On: {cycle.completedAt ? new Date(cycle.completedAt).toLocaleDateString() : 'N/A'}</Text>
                </View>
                
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>WAITING FOR QA</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  backBtn: { padding: 8, marginRight: 8, marginLeft: -8 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  sectionTitle: { fontSize: 14, color: '#64748b', fontWeight: '600', marginBottom: 16 },
  list: { flex: 1 },
  assetCard: {
    backgroundColor: '#FFFFFF', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0',
    marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  assetInfo: { flex: 1 },
  assetTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
  assetSub: { fontSize: 14, color: '#64748b', marginBottom: 2 },
  statusBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4, borderWidth: 1, borderColor: '#cbd5e1' },
  statusBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#475569' },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 48, marginTop: 32 },
  emptyText: { color: '#94a3b8', marginTop: 16, fontSize: 16 }
});
