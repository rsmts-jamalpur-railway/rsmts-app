import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../../context/AuthContext';
import { ManufacturingRepository } from '../../../database/v2/repositories/ManufacturingRepository';
import { database } from '../../../database/v2';
import ManufacturingOrder from '../../../database/v2/models/ManufacturingOrder';
import { Q } from '@nozbe/watermelondb';

export default function ActiveOrdersScreen({ navigation }: any) {
  const { employeeId, assignedLocationId } = useAuth();
  
  const [orders, setOrders] = useState<any[]>([]); // Array of { order, asset }
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadActiveOrders();
  }, [assignedLocationId]);

  const loadActiveOrders = async () => {
    try {
      const activeOrders = await database.collections.get<ManufacturingOrder>('manufacturing_orders')
        .query(
          Q.where('manufacturing_shop_id', assignedLocationId || ''),
          Q.where('order_status', 'IN_PROGRESS')
        )
        .fetch();
        
      const orderData = await Promise.all(activeOrders.map(async (order) => {
        const asset = await order.asset.fetch();
        return { order, asset };
      }));

      setOrders(orderData);
    } catch (error) {
      console.error('Error loading active manufacturing orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = async (orderId: string) => {
    Alert.alert(
      'Complete Order',
      'Are you sure you want to complete this manufacturing order and send to QA?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Complete', 
          onPress: async () => {
            setProcessingId(orderId);
            try {
              await ManufacturingRepository.completeOrder({
                orderId: orderId,
                finalRemarks: 'Completed via App',
                userId: employeeId || 'UNKNOWN',
              });
              
              Alert.alert('Success', 'Manufacturing order completed successfully (Offline).');
              loadActiveOrders();
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Failed to complete order.');
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
        <Text style={styles.headerTitle}>ACTIVE ORDERS</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#0A74DA" style={{ marginTop: 32 }} />
      ) : (
        <ScrollView style={styles.list}>
          {orders.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="cog" size={48} color="#94a3b8" />
              <Text style={styles.emptyText}>No active manufacturing orders.</Text>
            </View>
          ) : (
            orders.map(({ order, asset }) => (
              <View key={order.id} style={styles.assetCard}>
                <View style={styles.assetInfo}>
                  <Text style={styles.assetTitle}>{asset?.assetNumber || 'UNKNOWN'}</Text>
                  <Text style={styles.assetSub}>Target: {order.targetAssetType}</Text>
                  <Text style={styles.assetSub}>Started: {new Date(order.createdAt).toLocaleDateString()}</Text>
                </View>
                
                <TouchableOpacity 
                  style={[styles.actionBtn, processingId === order.id && styles.actionBtnDisabled]} 
                  onPress={() => handleComplete(order.id)}
                  disabled={processingId === order.id}
                >
                  {processingId === order.id ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.actionBtnText}>COMPLETE</Text>
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
  assetSub: { fontSize: 14, color: '#64748b', marginBottom: 2 },
  actionBtn: { backgroundColor: '#10b981', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, minWidth: 100, alignItems: 'center' },
  actionBtnDisabled: { opacity: 0.7 },
  actionBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 48, marginTop: 32 },
  emptyText: { color: '#94a3b8', marginTop: 16, fontSize: 16 }
});
