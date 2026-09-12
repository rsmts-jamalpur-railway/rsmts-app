import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, SafeAreaView, ActivityIndicator, Modal } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../../context/AuthContext';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../../config';

export default function ExceptionListScreen({ navigation }: any) {
  const { role } = useAuth();
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedException, setSelectedException] = useState<any>(null);
  const [detailsModal, setDetailsModal] = useState(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchExceptions();
    });
    return unsubscribe;
  }, [navigation]);

  const fetchExceptions = async () => {
    try {
      setLoading(true);
      const isConnected = await NetInfo.fetch().then(s => s.isConnected);
      if (!isConnected) {
        Toast.show({ type: 'error', text1: 'Offline', text2: 'Cannot fetch exceptions' });
        setLoading(false);
        return;
      }

      const token = await AsyncStorage.getItem('@Auth:token');
      const res = await fetch(`${API_BASE_URL}/exceptions?status=OPEN`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setExceptions(data);
      }
    } catch (error) {
      console.error('Failed to fetch exceptions', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load exceptions' });
    } finally {
      setLoading(false);
    }
  };

  const openDetails = (item: any) => {
    setSelectedException(item);
    setDetailsModal(true);
  };

  const renderExceptionItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} onPress={() => openDetails(item)}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Icon name="alert-circle" size={20} color="#b20033" />
          <Text style={styles.assetNumber}>{item.asset?.asset_number || 'UNKNOWN ASSET'}</Text>
        </View>
        <View style={[styles.severityBadge, item.severity === 'CRITICAL' ? styles.badgeCritical : styles.badgeHigh]}>
          <Text style={styles.severityText}>{item.severity}</Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.exceptionType}>{item.exception_type.replace(/_/g, ' ')}</Text>
        <Text style={styles.dateText}>{new Date(item.created_at).toLocaleString()}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>EXCEPTIONS</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('ReportException')}>
            <Icon name="plus" size={20} color="#ffffff" />
            <Text style={styles.addBtnText}>REPORT</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#0f52ba" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={exceptions}
            keyExtractor={item => item.id}
            renderItem={renderExceptionItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Icon name="check-circle-outline" size={48} color="#10b981" />
                <Text style={styles.emptyText}>No active exceptions.</Text>
              </View>
            }
          />
        )}
      </View>

      <Modal visible={detailsModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedException && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Exception Details</Text>
                  <TouchableOpacity onPress={() => setDetailsModal(false)}>
                    <Icon name="close" size={24} color="#131b2e" />
                  </TouchableOpacity>
                </View>
                <View style={styles.modalBody}>
                  <Text style={styles.detailLabel}>ASSET NUMBER</Text>
                  <Text style={styles.detailValue}>{selectedException.asset?.asset_number || 'N/A'}</Text>

                  <Text style={styles.detailLabel}>TYPE</Text>
                  <Text style={styles.detailValue}>{selectedException.exception_type}</Text>

                  <Text style={styles.detailLabel}>SEVERITY</Text>
                  <Text style={styles.detailValue}>{selectedException.severity}</Text>

                  <Text style={styles.detailLabel}>STATUS</Text>
                  <Text style={styles.detailValue}>{selectedException.status}</Text>

                  <Text style={styles.detailLabel}>REASON / DETAILS</Text>
                  <Text style={styles.detailValueBox}>{selectedException.reason || 'No additional details provided.'}</Text>
                  
                  <Text style={styles.detailLabel}>REPORTED AT</Text>
                  <Text style={styles.detailValue}>{new Date(selectedException.created_at).toLocaleString()}</Text>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1, padding: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: '#131b2e' },
  addBtn: { flexDirection: 'row', backgroundColor: '#0f52ba', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  addBtnText: { color: '#ffffff', fontWeight: '700', marginLeft: 4 },
  listContent: { paddingBottom: 20 },
  card: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  assetNumber: { fontSize: 16, fontWeight: '800', color: '#131b2e' },
  severityBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  badgeCritical: { backgroundColor: '#fef2f2', borderColor: '#ef4444', borderWidth: 1 },
  badgeHigh: { backgroundColor: '#fef3c7', borderColor: '#d97706', borderWidth: 1 },
  severityText: { fontSize: 11, fontWeight: '800', color: '#131b2e' },
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  exceptionType: { fontSize: 14, color: '#434653', fontWeight: '600' },
  dateText: { fontSize: 12, color: '#737784' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyText: { fontSize: 16, color: '#737784', marginTop: 12 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: '50%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#131b2e' },
  modalBody: { paddingBottom: 40 },
  detailLabel: { fontSize: 11, fontWeight: '700', color: '#737784', marginBottom: 4, marginTop: 16 },
  detailValue: { fontSize: 15, fontWeight: '600', color: '#131b2e' },
  detailValueBox: { fontSize: 14, color: '#131b2e', backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, marginTop: 4, minHeight: 60 },
});
