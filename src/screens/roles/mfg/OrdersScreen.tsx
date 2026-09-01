import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../../context/AuthContext';
import { ManufacturingRepository } from '../../../database/v2/repositories/ManufacturingRepository';
import { database } from '../../../database/v2';
import Asset from '../../../database/v2/models/Asset';
import { Q } from '@nozbe/watermelondb';

export default function OrdersScreen({ navigation }: any) {
  const { employeeId, assignedLocationId } = useAuth();
  
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadIncomingOrders();
  }, [assignedLocationId]);

  const loadIncomingOrders = async () => {
    try {
      // Query assets allocated to this specific manufacturing shop
      const incoming = await database.collections.get<Asset>('assets')
        .query(
          Q.where('current_location_id', assignedLocationId || ''),
          Q.where('current_status', 'Allocated')
        )
        .fetch();
        
      setAssets(incoming);
    } catch (error) {
      console.error('Error loading incoming orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartOrder = async (asset: Asset) => {
    Alert.alert(
      'Start Manufacturing Order',
      `Accept asset ${asset.assetNumber} and start manufacturing?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Start', 
          onPress: async () => {
            setProcessingId(asset.id);
            try {
              // Note: targetAssetType is hardcoded for UI simplicity
              await ManufacturingRepository.startOrder({
                assetId: asset.id,
                shopId: assignedLocationId || 'UNKNOWN',
                targetAssetType: 'BOXN', // Default for demonstration
                userId: employeeId || 'UNKNOWN',
              });
              
              Alert.alert('Success', 'Manufacturing started successfully (Offline).');
              loadIncomingOrders();
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Failed to start order.');
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
        <Text style={styles.headerTitle}>MANUFACTURING ORDERS</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#0A74DA" style={{ marginTop: 32 }} />
      ) : (
        <ScrollView style={styles.list}>
          {assets.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="factory" size={48} color="#94a3b8" />
              <Text style={styles.emptyText}>No pending manufacturing orders.</Text>
            </View>
          ) : (
            assets.map(asset => (
              <View key={asset.id} style={styles.assetCard}>
                <View style={styles.assetInfo}>
                  <Text style={styles.assetTitle}>{asset.assetNumber}</Text>
                  <Text style={styles.assetSub}>Type: {asset.assetType}</Text>
                  <Text style={styles.assetSub}>Category: {asset.assetCategory}</Text>
                </View>
                
                <TouchableOpacity 
                  style={[styles.actionBtn, processingId === asset.id && styles.actionBtnDisabled]} 
                  onPress={() => handleStartOrder(asset)}
                  disabled={processingId === asset.id}
                >
                  {processingId === asset.id ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.actionBtnText}>START ORDER</Text>
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
    backgroundColor: '#FFFFFF', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0',
    marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  assetInfo: { flex: 1 },
  assetTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
  assetSub: { fontSize: 14, color: '#64748b' },
  actionBtn: { backgroundColor: '#0A74DA', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, minWidth: 100, alignItems: 'center' },
  actionBtnDisabled: { opacity: 0.7 },
  actionBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 48, marginTop: 32 },
  emptyText: { color: '#94a3b8', marginTop: 16, fontSize: 16 }
});
