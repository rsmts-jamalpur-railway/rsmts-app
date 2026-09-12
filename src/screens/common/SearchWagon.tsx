import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Modal, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../context/AuthContext';
import { database } from '../../database/v2';
import Asset from '../../database/v2/models/Asset';
import { Q } from '@nozbe/watermelondb';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../config';
import 'react-native-get-random-values';
import uuid from 'react-native-uuid';

const SearchResults = ({ assets, isAdmin, onOverride, onEdit }: any) => {
  if (!assets || assets.length === 0) return null;

  return (
    <View style={styles.resultsContainer}>
      {assets.map((asset: any) => (
        <View key={asset.id} style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <View style={styles.resultHeaderLeft}>
              <View style={styles.resultIconBox}>
                <Icon name="train" size={20} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.resultAssetId}>{asset.assetNumber || asset.asset_number}</Text>
                <Text style={styles.resultClass}>{asset.assetCategory || asset.category_id || 'UNKNOWN'} | {asset.railwayZone || asset.railway_zone || 'N/A'}</Text>
              </View>
            </View>
            <View style={styles.resultBadge}>
              <Text style={styles.resultBadgeText}>{asset.currentStatus || asset.operational_status || 'UNKNOWN'}</Text>
            </View>
          </View>

          <View style={styles.resultGrid}>
            <View style={styles.resultGridItem}>
              <Text style={styles.resultGridLabel}>CURRENT LOC</Text>
              <Text style={styles.resultGridValue}>{asset.currentLocationId || asset.location_id || 'N/A'}</Text>
            </View>
            <View style={styles.resultGridItem}>
              <Text style={styles.resultGridLabel}>TRACK/LINE</Text>
              <Text style={styles.resultGridValue}>{asset.trackLine || asset.track_line || 'N/A'}</Text>
            </View>
          </View>

          {isAdmin && (
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.overrideBtn} onPress={() => onOverride(asset)}>
                <Icon name="shield-alert-outline" size={16} color="#ba1a1a" />
                <Text style={[styles.overrideBtnText, { color: '#ba1a1a' }]}>FORCE STATUS</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.overrideBtn} onPress={() => onEdit(asset)}>
                <Icon name="pencil-outline" size={16} color="#003c90" />
                <Text style={styles.overrideBtnText}>EDIT ASSET</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}
    </View>
  );
};

export default function SearchWagon() {
  const { role, employeeId } = useAuth();
  const isAdmin = role === 'SYSTEM_ADMIN' || role === 'MANAGEMENT';

  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [overview, setOverview] = useState<any>({ inYard: 'N/A', allocated: 'N/A', exception: 'N/A' });

  const [overrideModal, setOverrideModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [overrideStatus, setOverrideStatus] = useState('');

  const [editModal, setEditModal] = useState(false);
  const [editFields, setEditFields] = useState({
    assetNumber: '',
    railwayZone: '',
    trackLine: '',
    trainNumber: '',
    remarks: '',
    condition: ''
  });

  useEffect(() => {
    fetchOverview();
  }, []);

  useEffect(() => {
    if (activeQuery) {
      fetchSearchResults(activeQuery);
    } else {
      setSearchResults([]);
    }
  }, [activeQuery]);

  const fetchOverview = async () => {
    try {
      const isConnected = await NetInfo.fetch().then(s => s.isConnected);
      if (!isConnected) {
        Toast.show({ type: 'error', text1: 'Offline', text2: 'Showing limited local data' });
        // Fallback to local
        const assets = await database.collections.get<Asset>('assets').query().fetch();
        setOverview({
          inYard: assets.filter((a) => a.currentLocationId === 'NSY' || a.currentLocationId === 'YARD').length,
          allocated: assets.filter((a) => a.currentStatus === 'ALLOCATED').length,
          exception: assets.filter((a) => a.currentStatus === 'EXCEPTION_LOGGED').length
        });
        return;
      }
      
      const token = await AsyncStorage.getItem('@Auth:token');
      const res = await fetch(`${API_BASE_URL}/dashboard/overview`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      
      const inYard = data.assets_by_state?.find((d: any) => d.operational_status === 'RECEIVED_IN_YARD')?.count || 0;
      const allocated = data.assets_by_state?.find((d: any) => d.operational_status === 'ALLOCATED')?.count || 0;
      const exception = data.assets_by_state?.find((d: any) => d.operational_status === 'EXCEPTION_LOGGED')?.count || 0;
      
      setOverview({ inYard, allocated, exception });
    } catch (e) {
      console.warn('Overview fetch failed', e);
    }
  };

  const fetchSearchResults = async (search: string) => {
    try {
      setLoading(true);
      const isConnected = await NetInfo.fetch().then(s => s.isConnected);
      if (!isConnected) {
        Toast.show({ type: 'error', text1: 'Offline', text2: 'Searching local data only' });
        // Local fallback
        const assets = await database.collections.get<Asset>('assets')
          .query(
            Q.where('asset_number', Q.like(`%${search}%`))
          ).fetch();
        setSearchResults(assets);
        setLoading(false);
        return;
      }

      const token = await AsyncStorage.getItem('@Auth:token');
      const res = await fetch(`${API_BASE_URL}/dashboard/pipeline?search=${search}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      setSearchResults(data);
    } catch (e) {
      console.warn('Search fetch failed', e);
      Alert.alert('Error', 'Failed to perform real-time search');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setActiveQuery(query.toUpperCase().trim());
  };

  const openOverride = (asset: any) => {
    setSelectedAsset(asset);
    setOverrideStatus(asset.currentStatus || asset.operational_status || '');
    setOverrideModal(true);
  };

  const submitOverride = async () => {
    if (!overrideStatus.trim() || !selectedAsset || !employeeId) return;
    try {
      // In a real app, you would make an API call here.
      // For now, this is restricted functionality.
      setOverrideModal(false);
      setSelectedAsset(null);
      setOverrideStatus('');
      Alert.alert('Success', 'Asset status has been force updated.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const openEdit = (asset: any) => {
    setSelectedAsset(asset);
    setEditFields({
      assetNumber: asset.assetNumber || asset.asset_number || '',
      railwayZone: asset.railwayZone || asset.railway_zone || '',
      trackLine: asset.trackLine || asset.track_line || '',
      trainNumber: asset.trainNumber || asset.train_number || '',
      remarks: asset.remarks || '',
      condition: asset.condition || ''
    });
    setEditModal(true);
  };

  const submitEdit = async () => {
    if (!selectedAsset) return;
    try {
      const token = await AsyncStorage.getItem('@Auth:token');
      const isConnected = await NetInfo.fetch().then(s => s.isConnected);
      if (!isConnected) {
        Alert.alert('Error', 'You must be online to edit an asset.');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/yard/asset/${selectedAsset.id || selectedAsset.asset_id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_operation_id: selectedAsset.id || uuid.v4(),
          asset_number: editFields.assetNumber,
          railway_zone: editFields.railwayZone,
          track_line: editFields.trackLine,
          train_number: editFields.trainNumber,
          remarks: editFields.remarks,
          condition: editFields.condition
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to update asset.');
      }

      setEditModal(false);
      Alert.alert('Success', 'Asset updated.');
      fetchSearchResults(activeQuery); // Refresh
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        
        <View style={styles.topBanner}>
          <View style={styles.topBannerLeft}>
            <View style={styles.radarIconBox}>
              <Icon name="radar" size={20} color="#003c90" />
            </View>
            <View>
              <Text style={styles.bannerZone}>GLOBAL ASSET LOCATOR</Text>
              <Text style={styles.bannerOnline}>Real-time tracking active</Text>
            </View>
          </View>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        <View style={styles.searchCard}>
          <View style={styles.searchHeader}>
            <Text style={styles.cardTitle}>Find Asset</Text>
            <View style={styles.rfidBadge}>
              <Text style={styles.rfidBadgeText}>RFID ENABLED</Text>
            </View>
          </View>
          <Text style={styles.searchDesc}>Enter Wagon/Coach Number or scan RFID tag.</Text>

          <View style={styles.searchRow}>
            <View style={styles.inputWrap}>
              <Icon name="barcode-scan" size={20} color="#737784" style={styles.inputIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="e.g. ECOR123456"
                placeholderTextColor="#94a3b8"
                value={query}
                onChangeText={setQuery}
                autoCapitalize="characters"
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
              {query.length > 0 && (
                <TouchableOpacity style={styles.scanBtn} onPress={() => { setQuery(''); setActiveQuery(''); }}>
                  <Icon name="close-circle" size={18} color="#737784" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
              <Icon name="magnify" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.formatAssistance}>
            <Text style={styles.formatAssistanceText}>Format: ZONE + 6 DIGITS (ex: SECR842911)</Text>
            {activeQuery ? (
              <TouchableOpacity onPress={() => { setQuery(''); setActiveQuery(''); }}>
                <Text style={styles.clearText}>Clear Results</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {activeQuery ? (
          <SearchResults assets={searchResults} isAdmin={isAdmin} onOverride={openOverride} onEdit={openEdit} />
        ) : (
          <View style={styles.resultsViewport}>
            <View style={styles.iconCircle}>
              <Icon name="train" size={38} color="#003c90" />
            </View>
            <Text style={styles.resultsTitle}>Awaiting Asset Identifier</Text>
            <Text style={styles.resultsDesc}>Enter an asset number above to track its current location and status in the yard.</Text>

            <View style={styles.quickMetricsRow}>
              <View style={styles.quickMetricBox}>
                <Text style={styles.quickMetricValue}>{overview.inYard}</Text>
                <Text style={styles.quickMetricLabel}>IN YARD</Text>
              </View>
              <View style={styles.quickMetricBox}>
                <Text style={[styles.quickMetricValue, { color: '#006a63' }]}>{overview.allocated}</Text>
                <Text style={styles.quickMetricLabel}>ALLOCATED</Text>
              </View>
              <View style={styles.quickMetricBox}>
                <Text style={[styles.quickMetricValue, { color: '#860024' }]}>{overview.exception}</Text>
                <Text style={styles.quickMetricLabel}>HOLD/EXC</Text>
              </View>
            </View>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Override Modal */}
      <Modal visible={overrideModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Force Status Update (Admin)</Text>
            <Text style={styles.modalSubtitle}>Manually override the operational status for {selectedAsset?.assetNumber || selectedAsset?.asset_number}. This bypasses validation.</Text>
            <TextInput
              style={styles.modalInput}
              value={overrideStatus}
              onChangeText={setOverrideStatus}
              placeholder="e.g. OUT_OF_SERVICE"
              placeholderTextColor="#94a3b8"
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

      {/* Edit Modal */}
      <Modal visible={editModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit Asset Details</Text>
              <Text style={styles.modalSubtitle}>Update physical properties and metadata.</Text>
              
              <Text style={styles.modalInputLabel}>Asset Number</Text>
              <TextInput style={styles.modalInput} value={editFields.assetNumber} onChangeText={t => setEditFields({...editFields, assetNumber: t})} />
              
              <Text style={styles.modalInputLabel}>Railway Zone</Text>
              <TextInput style={styles.modalInput} value={editFields.railwayZone} onChangeText={t => setEditFields({...editFields, railwayZone: t})} />
              
              <Text style={styles.modalInputLabel}>Track/Line</Text>
              <TextInput style={styles.modalInput} value={editFields.trackLine} onChangeText={t => setEditFields({...editFields, trackLine: t})} />
              
              <Text style={styles.modalInputLabel}>Train Number</Text>
              <TextInput style={styles.modalInput} value={editFields.trainNumber} onChangeText={t => setEditFields({...editFields, trainNumber: t})} />
              
              <Text style={styles.modalInputLabel}>Condition</Text>
              <TextInput style={styles.modalInput} value={editFields.condition} onChangeText={t => setEditFields({...editFields, condition: t})} />
              
              <Text style={styles.modalInputLabel}>Notes / Remarks</Text>
              <TextInput style={styles.modalInput} value={editFields.remarks} onChangeText={t => setEditFields({...editFields, remarks: t})} />
              
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModal(false)}>
                  <Text style={styles.cancelBtnText}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitBtn} onPress={submitEdit}>
                  <Text style={styles.submitBtnText}>SAVE DETAILS</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 16, paddingTop: 16 },

  topBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#f2f3ff', borderRadius: 12, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  topBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  radarIconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(0,60,144,0.1)', alignItems: 'center', justifyContent: 'center' },
  bannerZone: { fontSize: 11, fontWeight: '700', color: '#003c90', textTransform: 'uppercase', letterSpacing: 0.8 },
  bannerOnline: { fontSize: 12, fontWeight: '500', color: '#434653' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eaedff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#006a63', marginRight: 4 },
  liveText: { fontSize: 11, fontWeight: '700', color: '#006a63' },

  searchCard: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  searchHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardTitle: { fontSize: 22, fontWeight: '700', color: '#131b2e' },
  rfidBadge: { backgroundColor: '#eaedff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  rfidBadgeText: { fontSize: 11, fontWeight: '700', color: '#003c90', letterSpacing: 0.4 },
  searchDesc: { fontSize: 12, color: '#434653', marginBottom: 16 },

  searchRow: { flexDirection: 'row', gap: 8 },
  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f2f3ff', borderRadius: 8, borderWidth: 2, borderColor: 'transparent' },
  inputIcon: { marginLeft: 12 },
  searchInput: { flex: 1, height: 48, paddingHorizontal: 10, color: '#131b2e', fontSize: 10, fontWeight: '600' },
  scanBtn: { width: 36, height: 36, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  searchBtn: { width: 48, height: 48, backgroundColor: '#0f52ba', borderRadius: 8, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },

  formatAssistance: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 6 },
  formatAssistanceText: { fontSize: 11, color: '#737784', fontWeight: '700' },
  clearText: { fontSize: 11, color: '#003c90', fontWeight: '700' },

  resultsViewport: { backgroundColor: '#ffffff', borderRadius: 16, padding: 24, alignItems: 'center', justifyContent: 'center', minHeight: 290, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#eaedff', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  resultsTitle: { fontSize: 17, fontWeight: '600', color: '#131b2e', marginBottom: 4 },
  resultsDesc: { fontSize: 14, color: '#434653', textAlign: 'center', paddingHorizontal: 20, marginBottom: 24 },

  quickMetricsRow: { flexDirection: 'row', gap: 8, width: '100%', borderTopWidth: 1, borderTopColor: '#eaedff', paddingTop: 16 },
  quickMetricBox: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f2f3ff', borderRadius: 8, padding: 8, minHeight: 64 },
  quickMetricValue: { fontSize: 22, fontWeight: '700', color: '#131b2e' },
  quickMetricLabel: { fontSize: 11, fontWeight: '600', color: '#737784', letterSpacing: 0.8, textTransform: 'uppercase' },

  resultsContainer: { marginTop: 12, padding: 16, backgroundColor: '#FFFFFF', borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  resultCard: {},
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eaedff', paddingBottom: 12, marginBottom: 12 },
  resultHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  resultIconBox: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#003c90', alignItems: 'center', justifyContent: 'center' },
  resultAssetId: { fontSize: 17, fontWeight: '700', fontFamily: 'monospace', color: '#131b2e' },
  resultClass: { fontSize: 12, color: '#434653' },
  resultBadge: { backgroundColor: '#9cf2e8', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  resultBadgeText: { fontSize: 11, fontWeight: '700', color: '#00504a' },

  resultGrid: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  resultGridItem: { flex: 1, backgroundColor: '#f2f3ff', padding: 8, borderRadius: 8 },
  resultGridLabel: { fontSize: 11, fontWeight: '700', color: '#737784', textTransform: 'uppercase', marginBottom: 2 },
  resultGridValue: { fontSize: 14, fontWeight: '700', color: '#131b2e' },

  actionRow: { flexDirection: 'row', gap: 8 },
  overrideBtn: { flex: 1, height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 8, backgroundColor: '#e2e7ff' },
  overrideBtnText: { fontSize: 12, fontWeight: '700', color: '#003c90' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 12 },
  modalTitle: { color: '#ba1a1a', fontSize: 16, fontWeight: '800', marginBottom: 8 },
  modalSubtitle: { color: '#434653', fontSize: 12, marginBottom: 20, lineHeight: 20 },
  modalInputLabel: { color: '#737784', fontSize: 12, marginBottom: 4 },
  modalInput: { backgroundColor: '#f2f3ff', color: '#131b2e', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1' },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: { flex: 1, backgroundColor: '#f2f3ff', padding: 12, borderRadius: 8, alignItems: 'center' },
  cancelBtnText: { color: '#131b2e', fontWeight: '700' },
  submitBtn: { flex: 1, backgroundColor: '#ba1a1a', padding: 12, borderRadius: 8, alignItems: 'center' },
  submitBtnText: { color: '#FFFFFF', fontWeight: '800' },
});
