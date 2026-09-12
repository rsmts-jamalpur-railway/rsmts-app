import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, TextInput, Modal } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../../context/AuthContext';
import { ManufacturingRepository } from '../../../database/v2/repositories/ManufacturingRepository';
import { database } from '../../../database/v2';
import ManufacturingOrder from '../../../database/v2/models/ManufacturingOrder';
import { Q } from '@nozbe/watermelondb';

const MFG_SHOPS = [
  { id: 'GIF', name: 'GIF (Foundry)' },
  { id: 'BOGIE-MFG', name: 'Bogie Assembly' },
  { id: 'WHEEL-MFG', name: 'Wheel Machining' },
  { id: 'FORGE-SHOP', name: 'Heavy Forging' },
];

export default function ActiveOrdersScreen({ navigation }: any) {
  const { employeeId, assignedLocationId } = useAuth();
  
  const [currentShop, setCurrentShop] = useState(assignedLocationId || 'GIF');
  const [orders, setOrders] = useState<any[]>([]); // Array of { order, asset }
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Completion Modal State
  const [completingOrder, setCompletingOrder] = useState<any | null>(null);
  const [finalRemarks, setFinalRemarks] = useState('');

  useEffect(() => {
    loadActiveOrders();
  }, [currentShop]);

  const loadActiveOrders = async () => {
    try {
      setIsLoading(true);
      const activeOrders = await database.collections.get<ManufacturingOrder>('manufacturing_orders')
        .query(
          Q.where('manufacturing_shop_id', currentShop),
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

  const openCompleteModal = (orderItem: any) => {
    setCompletingOrder(orderItem);
    setFinalRemarks(`Fabrication complete to specs by ${employeeId || 'Supervisor'}.`);
  };

  const handleConfirmComplete = async () => {
    if (!completingOrder) return;

    setProcessingId(completingOrder.order.id);
    const orderId = completingOrder.order.id;
    const assetNum = completingOrder.asset?.assetNumber || 'Stock';
    setCompletingOrder(null);

    try {
      await ManufacturingRepository.completeOrder({
        orderId: orderId,
        finalRemarks: finalRemarks.trim(),
        userId: employeeId || 'UNKNOWN',
      });
      
      Alert.alert('Production Complete', `Order for ${assetNum} completed and forwarded to QA inspection.`);
      loadActiveOrders();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to complete order.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ACTIVE PRODUCTION BATCHES</Text>
      </View>

      {/* Shop Selector */}
      <View style={styles.shopSelector}>
        <Text style={styles.shopLabel}>MANUFACTURING SHOP:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shopScroll}>
          {MFG_SHOPS.map(s => {
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

      {/* Summary Bar */}
      <View style={styles.summaryBar}>
        <Text style={styles.summaryText}>
          Active production in <Text style={styles.summaryBold}>{currentShop}</Text>: {orders.length}
        </Text>
        <TouchableOpacity onPress={loadActiveOrders} style={styles.refreshBtn}>
          <Icon name="refresh" size={18} color="#0A74DA" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#0A74DA" style={{ marginTop: 32 }} />
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {orders.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="cog-clockwise" size={48} color="#94a3b8" />
              <Text style={styles.emptyTitle}>No Active Production Orders</Text>
              <Text style={styles.emptyText}>
                No orders are currently in fabrication in {currentShop}.
              </Text>
            </View>
          ) : (
            orders.map(({ order, asset }) => (
              <View key={order.id} style={styles.assetCard}>
                <View style={styles.assetInfo}>
                  <View style={styles.titleRow}>
                    <Icon name="cube-send" size={18} color="#047857" />
                    <Text style={styles.assetTitle}>{asset?.assetNumber || 'UNKNOWN'}</Text>
                  </View>
                  <View style={styles.targetBadge}>
                    <Text style={styles.targetBadgeText}>Target: {order.targetAssetType}</Text>
                  </View>
                  <Text style={styles.assetSub}>
                    Started: {new Date(order.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                
                <TouchableOpacity 
                  style={[styles.actionBtn, processingId === order.id && styles.actionBtnDisabled]} 
                  onPress={() => openCompleteModal({ order, asset })}
                  disabled={processingId === order.id}
                >
                  {processingId === order.id ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Icon name="check-circle-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.actionBtnText}>FINISH & QA</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Completion Modal */}
      <Modal
        visible={!!completingOrder}
        transparent
        animationType="slide"
        onRequestClose={() => setCompletingOrder(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>COMPLETE PRODUCTION BATCH</Text>
                <Text style={styles.modalSub}>
                  {completingOrder?.asset?.assetNumber} → {completingOrder?.order?.targetAssetType}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setCompletingOrder(null)}>
                <Icon name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.label}>Handover & Final QC Remarks *</Text>
              <TextInput
                style={styles.textArea}
                value={finalRemarks}
                onChangeText={setFinalRemarks}
                placeholder="Dimensional check passed, ultrasonic testing completed..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.modalCancelBtn} 
                onPress={() => setCompletingOrder(null)}
              >
                <Text style={styles.modalCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalConfirmBtn} 
                onPress={handleConfirmComplete}
              >
                <Icon name="check-bold" size={16} color="#FFFFFF" />
                <Text style={styles.modalConfirmText}>SUBMIT TO QA</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
  shopChipActive: { backgroundColor: '#047857', borderColor: '#047857' },
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  assetTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
  targetBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  targetBadgeText: { fontSize: 11, fontWeight: '700', color: '#047857' },
  assetSub: { fontSize: 12, color: '#64748b' },
  actionBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionBtnDisabled: { opacity: 0.7 },
  actionBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 11 },
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
  modalSub: { fontSize: 12, color: '#059669', fontWeight: '600', marginTop: 2 },
  modalBody: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 },
  textArea: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#0f172a',
    minHeight: 70,
    textAlignVertical: 'top',
  },
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
    backgroundColor: '#10b981',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  modalConfirmText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 },
});
