import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../../context/AuthContext';
import { YardRepository } from '../../../database/v2/repositories/YardRepository';
import { database } from '../../../database/v2';
import Asset from '../../../database/v2/models/Asset';
import { Q } from '@nozbe/watermelondb';

export default function NSYOutScreen({ navigation }: any) {
  const { employeeId } = useAuth();
  
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);

  useEffect(() => {
    loadFitAssets();
  }, []);

  const loadFitAssets = async () => {
    try {
      // In a real scenario, this queries assets ready for dispatch.
      // We assume QA marks them as 'FIT' and their location is 'YARD' or ready to dispatch.
      // For this implementation, we query 'FIT' status.
      const fitAssets = await database.collections.get<Asset>('assets')
        .query(
          Q.where('current_status', 'FIT')
        )
        .fetch();
        
      setAssets(fitAssets);
    } catch (error) {
      console.error('Error loading fit assets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDispatch = async (asset: Asset) => {
    Alert.alert(
      'Dispatch Asset',
      `Are you sure you want to dispatch ${asset.assetNumber} out of the yard?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Dispatch', 
          style: 'destructive',
          onPress: async () => {
            setDispatchingId(asset.id);
            try {
              await YardRepository.dispatchAsset({
                assetId: asset.id,
                userId: employeeId || 'UNKNOWN',
                toRailway: 'EXTERNAL_RAILWAY', // Defaulting for Phase 3 UI simplicity
              });
              
              Alert.alert('Success', 'Asset dispatched successfully.');
              loadFitAssets();
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Failed to dispatch asset.');
            } finally {
              setDispatchingId(null);
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
        <Text style={styles.headerTitle}>NSY OUT</Text>
      </View>

      <Text style={styles.sectionTitle}>FIT ASSETS READY FOR DISPATCH</Text>

      {isLoading ? (
        <ActivityIndicator size="large" color="#0A74DA" style={{ marginTop: 32 }} />
      ) : (
        <ScrollView style={styles.list}>
          {assets.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="check-circle-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyText}>No fit assets ready for dispatch.</Text>
            </View>
          ) : (
            assets.map(asset => (
              <View key={asset.id} style={styles.assetCard}>
                <View style={styles.assetInfo}>
                  <Text style={styles.assetTitle}>{asset.assetNumber}</Text>
                  <Text style={styles.assetSub}>Status: {asset.currentStatus}</Text>
                  <Text style={styles.assetSub}>Location: {asset.currentLocationId}</Text>
                </View>
                
                <TouchableOpacity 
                  style={[styles.dispatchBtn, dispatchingId === asset.id && styles.dispatchBtnDisabled]} 
                  onPress={() => handleDispatch(asset)}
                  disabled={dispatchingId === asset.id}
                >
                  {dispatchingId === asset.id ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.dispatchBtnText}>DISPATCH</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
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
  sectionTitle: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 16,
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
  },
  assetTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  assetSub: {
    fontSize: 14,
    color: '#64748b',
  },
  dispatchBtn: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
  },
  dispatchBtnDisabled: {
    opacity: 0.7,
  },
  dispatchBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
    marginTop: 32,
  },
  emptyText: {
    color: '#94a3b8',
    marginTop: 16,
    fontSize: 16,
  }
});
