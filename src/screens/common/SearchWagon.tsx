import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Modal } from 'react-native';
import { withDatabase } from '@nozbe/watermelondb/DatabaseProvider';
import withObservables from '@nozbe/with-observables';
import { Q } from '@nozbe/watermelondb';
import Asset from '../../database/models/Asset';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../context/AuthContext';

const SearchResults = ({ assets, isAdmin, onOverride }: { assets: Asset[], isAdmin: boolean, onOverride: (asset: Asset) => void }) => {
  if (!assets || assets.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="train-car" size={48} color="#cbd5e1" />
        <Text style={styles.emptyText}>No wagons found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.resultsContainer}>
      {assets.map(asset => (
        <View key={asset.id} style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle}>{asset.asset_number}</Text>
            <View style={[styles.badge, asset.is_active ? styles.badgeActive : styles.badgeInactive]}>
              <Text style={styles.badgeText}>{asset.is_active ? 'ACTIVE' : 'DISPATCHED'}</Text>
            </View>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Current Status:</Text>
            <Text style={styles.detailValue}>{asset.current_status}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Allocated Shop:</Text>
            <Text style={styles.detailValue}>{asset.allocated_shop || 'None'}</Text>
          </View>
          
          {asset.repair_category && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Repair Category:</Text>
              <Text style={styles.detailValue}>{asset.repair_category}</Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Last Updated:</Text>
            <Text style={styles.detailValue}>{new Date(asset.updatedAt).toLocaleString()}</Text>
          </View>

          {isAdmin && (
            <TouchableOpacity style={styles.overrideBtn} onPress={() => onOverride(asset)}>
              <Text style={styles.overrideBtnText}>FORCE STATUS OVERRIDE</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );
};

const ObservableSearchResults = withObservables(['searchQuery', 'database'], ({ searchQuery, database }) => ({
  assets: searchQuery ? database.collections.get('assets').query(Q.where('asset_number', Q.like(`%${searchQuery}%`))).observe() : []
}))(({ assets, isAdmin, onOverride }: any) => <SearchResults assets={assets} isAdmin={isAdmin} onOverride={onOverride} />);

function SearchWagon({ database }: any) {
  const { role, userId } = useAuth();
  const isAdmin = role === 'Administrator' || role === 'Management';

  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [overrideModal, setOverrideModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [overrideStatus, setOverrideStatus] = useState('');

  const handleSearch = () => {
    setActiveQuery(query.toUpperCase().trim());
  };

  const openOverride = (asset: Asset) => {
    setSelectedAsset(asset);
    setOverrideStatus(asset.current_status);
    setOverrideModal(true);
  };

  const submitOverride = async () => {
    if (!overrideStatus.trim() || !selectedAsset || !userId) return;
    try {
      await database.write(async () => {
        await selectedAsset.update((a: any) => {
          a.current_status = overrideStatus;
        });

        await database.collections.get('movement_logs').create((log: any) => {
          log.asset_number = selectedAsset.asset_number;
          log.from_location = selectedAsset.allocated_shop || 'Unknown';
          log.to_location = 'Admin Override';
          log.previous_status = selectedAsset.current_status;
          log.new_status = overrideStatus;
          log.handled_by = userId;
          log.is_offline_entry = true;
          log.timestamp = new Date().getTime();
          log.remarks = `Status force-overwritten by Admin to ${overrideStatus}`;
        });
      });
      setOverrideModal(false);
      setSelectedAsset(null);
      setOverrideStatus('');
      Alert.alert('Success', 'Wagon status has been force updated.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.searchCard}>
        <Text style={styles.cardTitle}>Track Wagon</Text>
        <View style={styles.searchRow}>
          <TextInput 
            style={styles.searchInput}
            placeholder="Enter Wagon Number..."
            placeholderTextColor="#94a3b8"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="characters"
          />
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
            <Icon name="magnify" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {activeQuery ? (
        <ObservableSearchResults database={database} searchQuery={activeQuery} isAdmin={isAdmin} onOverride={openOverride} />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Enter a wagon number above to track its current location and status in the yard.</Text>
        </View>
      )}
    </ScrollView>

    <Modal visible={overrideModal} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Admin Override: {selectedAsset?.asset_number}</Text>
          <Text style={styles.modalSubtitle}>Warning: Force changing a status skips normal validation checks. Use only for system corrections.</Text>
          
          <Text style={styles.detailLabel}>New Status</Text>
          <TextInput 
            style={styles.searchInput}
            value={overrideStatus}
            onChangeText={setOverrideStatus}
            autoCapitalize="words"
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setOverrideModal(false)}>
              <Text style={styles.cancelBtnText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitBtn} onPress={submitOverride}>
              <Text style={styles.submitBtnText}>FORCE OVERRIDE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  </>
  );
}

export default withDatabase(SearchWagon);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 16 },
  searchCard: { backgroundColor: '#FFFFFF', padding: 20, marginBottom: 16 },
  cardTitle: { color: '#0f172a', fontSize: 15, fontWeight: '700', marginBottom: 16 },
  searchRow: { flexDirection: 'row', gap: 12 },
  searchInput: { flex: 1, backgroundColor: '#f8fafc', color: '#0f172a', padding: 12, borderRadius: 4, borderWidth: 1, borderColor: '#cbd5e1' },
  searchBtn: { backgroundColor: '#0A74DA', width: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 4 },
  
  resultsContainer: { gap: 12 },
  resultCard: { backgroundColor: '#f8fafc', padding: 16, borderRadius: 4, borderWidth: 1, borderColor: '#e2e8f0' },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  resultTitle: { color: '#0f172a', fontSize: 16, fontWeight: '800' },
  
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  badgeActive: { backgroundColor: '#dcfce7' },
  badgeInactive: { backgroundColor: '#f1f5f9' },
  badgeText: { fontSize: 9, fontWeight: '700', color: '#0f172a' },
  
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  detailLabel: { color: '#64748b', fontSize: 12 },
  detailValue: { color: '#0f172a', fontSize: 12, fontWeight: '600' },
  
  emptyContainer: { alignItems: 'center', padding: 32, opacity: 0.5 },
  emptyText: { color: '#64748b', textAlign: 'center', marginTop: 16, lineHeight: 20 },
  
  overrideBtn: { marginTop: 16, backgroundColor: '#fee2e2', padding: 12, borderRadius: 4, alignItems: 'center', borderWidth: 1, borderColor: '#ef4444' },
  overrideBtnText: { color: '#ef4444', fontWeight: '800', fontSize: 10 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 8 },
  modalTitle: { color: '#ef4444', fontSize: 16, fontWeight: '800', marginBottom: 8 },
  modalSubtitle: { color: '#64748b', fontSize: 12, marginBottom: 20, lineHeight: 20 },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: { flex: 1, backgroundColor: '#f1f5f9', padding: 12, borderRadius: 4, alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1' },
  cancelBtnText: { color: '#0f172a', fontWeight: '700' },
  submitBtn: { flex: 1, backgroundColor: '#ef4444', padding: 12, borderRadius: 4, alignItems: 'center' },
  submitBtnText: { color: '#FFFFFF', fontWeight: '800' },
});
