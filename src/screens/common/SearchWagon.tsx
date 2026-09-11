import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Modal } from 'react-native';
import { withDatabase } from '@nozbe/watermelondb/DatabaseProvider';
import withObservables from '@nozbe/with-observables';
import { Q } from '@nozbe/watermelondb';
import Asset from '../../database/v2/models/Asset';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../context/AuthContext';

const SearchResults = ({ assets, isAdmin, onOverride }: { assets: Asset[], isAdmin: boolean, onOverride: (asset: Asset) => void }) => {
  if (!assets || assets.length === 0) {
    return (
      <View style={styles.resultsViewport}>
        <View style={styles.iconCircle}>
          <Icon name="train" size={38} color="#003c90" />
        </View>
        <Text style={styles.resultsTitle}>No Assets Found</Text>
        <Text style={styles.resultsDesc}>We couldn't find any asset matching that identifier.</Text>
      </View>
    );
  }

  return (
    <View style={styles.resultsContainer}>
      {assets.map(asset => {
        const isActive = asset.currentStatus !== 'DISPATCHED';
        return (
          <View key={asset.id} style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <View style={styles.resultHeaderLeft}>
                <View style={styles.resultIconBox}>
                  <Icon name="train" size={20} color="#ffffff" />
                </View>
                <View>
                  <Text style={styles.resultAssetId}>{asset.assetNumber}</Text>
                  <Text style={styles.resultClass}>Class: {asset.assetCategory}</Text>
                </View>
              </View>
              <View style={styles.resultBadge}>
                <Text style={styles.resultBadgeText}>{asset.currentStatus}</Text>
              </View>
            </View>
            
            <View style={styles.resultGrid}>
              <View style={styles.resultGridItem}>
                <Text style={styles.resultGridLabel}>CURRENT LOCATION</Text>
                <Text style={styles.resultGridValue}>{asset.currentLocationId || 'Unknown'}</Text>
              </View>
              <View style={styles.resultGridItem}>
                <Text style={styles.resultGridLabel}>LAST UPDATED</Text>
                <Text style={styles.resultGridValue}>{new Date(asset.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
            </View>

            {isAdmin && (
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.overrideBtn} onPress={() => onOverride(asset)}>
                  <Icon name="pencil" size={18} color="#003c90" />
                  <Text style={styles.overrideBtnText}>Override Status</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
};

const ObservableSearchResults = withObservables(['searchQuery', 'database'], ({ searchQuery, database }) => ({
  assets: searchQuery ? database.collections.get('assets').query(Q.where('asset_number', Q.like(`%${searchQuery}%`))).observe() : []
}))(({ assets, isAdmin, onOverride }: any) => <SearchResults assets={assets} isAdmin={isAdmin} onOverride={onOverride} />);

function SearchWagon({ database }: any) {
  const { role, employeeId } = useAuth();
  const isAdmin = role === 'SYSTEM_ADMIN' || role === 'MANAGEMENT';

  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [overrideModal, setOverrideModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [overrideStatus, setOverrideStatus] = useState('');

  const handleSearch = () => {
    setActiveQuery(query.toUpperCase().trim());
  };

  const handleChipClick = (assetNo: string) => {
    setQuery(assetNo);
    setActiveQuery(assetNo);
  };

  const openOverride = (asset: Asset) => {
    setSelectedAsset(asset);
    setOverrideStatus(asset.currentStatus);
    setOverrideModal(true);
  };

  const submitOverride = async () => {
    if (!overrideStatus.trim() || !selectedAsset || !employeeId) return;
    try {
      await database.write(async () => {
        await selectedAsset.update((a: any) => {
          a.currentStatus = overrideStatus;
        });

        await database.collections.get('movement_logs').create((log: any) => {
          log.assetId = selectedAsset.id;
          log.fromLocationId = selectedAsset.currentLocationId || 'Unknown';
          log.toLocationId = 'Admin Override';
          log.previousStatus = selectedAsset.currentStatus;
          log.newStatus = overrideStatus;
          log.remarks = `Status force-overwritten by Admin to ${overrideStatus}`;
        });
      });
      setOverrideModal(false);
      setSelectedAsset(null);
      setOverrideStatus('');
      Alert.alert('Success', 'Asset status has been force updated.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Top Banner */}
        <View style={styles.topBanner}>
          <View style={styles.topBannerLeft}>
            <View style={styles.radarIconBox}>
              <Icon name="radar" size={20} color="#003c90" />
            </View>
            <View>
              <Text style={styles.bannerZone}>Yard Zone NSY-04</Text>
              <Text style={styles.bannerOnline}>Telemetry Online • 312 Tracked Units</Text>
            </View>
          </View>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        {/* Primary Search Card */}
        <View style={styles.searchCard}>
          <View style={styles.searchHeader}>
            <Text style={styles.cardTitle}>Track Asset</Text>
            <View style={styles.rfidBadge}>
              <Text style={styles.rfidBadgeText}>RFID / OCR READY</Text>
            </View>
          </View>
          <Text style={styles.searchDesc}>Lookup locomotives, hopper cars, intermodal containers, or maintenance bogeys.</Text>
          
          <View style={styles.searchRow}>
            <View style={styles.inputWrap}>
              <Icon name="tag" size={20} color="#737784" style={styles.inputIcon} />
              <TextInput 
                style={styles.searchInput}
                placeholder="ENTER ASSET NUMBER..."
                placeholderTextColor="#737784"
                value={query}
                onChangeText={setQuery}
                autoCapitalize="characters"
                onSubmitEditing={handleSearch}
              />
              <TouchableOpacity style={styles.scanBtn}>
                <Icon name="barcode-scan" size={22} color="#434653" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
              <Icon name="magnify" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <View style={styles.formatAssistance}>
            <Text style={styles.formatAssistanceText}>Ex: WGN-8842, BNSF-902, FLAT-4401</Text>
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(''); setActiveQuery(''); }}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Recent Tracked Assets */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recently Tracked Assets</Text>
          <Text style={styles.tapToQuery}>TAP TO QUERY</Text>
        </View>
        <View style={styles.chipsGrid}>
          <TouchableOpacity style={styles.chipBtn} onPress={() => handleChipClick('WGN-8842')}>
            <View style={styles.chipLeft}>
              <Icon name="train" size={18} color="#003c90" />
              <Text style={styles.chipText}>WGN-8842</Text>
            </View>
            <View style={styles.chipDotSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.chipBtn} onPress={() => handleChipClick('BOX-1093')}>
            <View style={styles.chipLeft}>
              <Icon name="package-variant-closed" size={18} color="#737784" />
              <Text style={styles.chipText}>BOX-1093</Text>
            </View>
            <View style={styles.chipDotAmber} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.chipBtn} onPress={() => handleChipClick('FLAT-4401')}>
            <View style={styles.chipLeft}>
              <Icon name="view-day" size={18} color="#737784" />
              <Text style={styles.chipText}>FLAT-4401</Text>
            </View>
            <View style={styles.chipDotSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.chipBtn} onPress={() => handleChipClick('TANK-2104')}>
            <View style={styles.chipLeft}>
              <Icon name="alert-circle" size={18} color="#860024" />
              <Text style={styles.chipText}>TANK-2104</Text>
            </View>
            <View style={styles.chipDotError} />
          </TouchableOpacity>
        </View>

        {/* Results Area */}
        {activeQuery ? (
          <ObservableSearchResults database={database} searchQuery={activeQuery} isAdmin={isAdmin} onOverride={openOverride} />
        ) : (
          <View style={styles.resultsViewport}>
            <View style={styles.iconCircle}>
              <Icon name="train" size={38} color="#003c90" />
            </View>
            <Text style={styles.resultsTitle}>Awaiting Asset Identifier</Text>
            <Text style={styles.resultsDesc}>Enter an asset number above to track its current location and status in the yard.</Text>
            
            <View style={styles.quickMetricsRow}>
              <View style={styles.quickMetricBox}>
                <Text style={styles.quickMetricValue}>148</Text>
                <Text style={styles.quickMetricLabel}>IN YARD</Text>
              </View>
              <View style={styles.quickMetricBox}>
                <Text style={[styles.quickMetricValue, { color: '#006a63' }]}>38</Text>
                <Text style={styles.quickMetricLabel}>ALLOCATED</Text>
              </View>
              <View style={styles.quickMetricBox}>
                <Text style={[styles.quickMetricValue, { color: '#860024' }]}>5</Text>
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
            <Text style={styles.modalTitle}>Admin Override: {selectedAsset?.assetNumber}</Text>
            <Text style={styles.modalSubtitle}>Warning: Force changing a status skips normal validation checks. Use only for system corrections.</Text>
            
            <Text style={styles.modalInputLabel}>New Status</Text>
            <TextInput 
              style={styles.modalInput}
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
  container: { flex: 1, backgroundColor: '#faf8ff' },
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
  searchInput: { flex: 1, height: 48, paddingHorizontal: 10, color: '#131b2e', fontSize: 15, fontWeight: '600' },
  scanBtn: { width: 36, height: 36, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  searchBtn: { width: 48, height: 48, backgroundColor: '#0f52ba', borderRadius: 8, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  
  formatAssistance: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 6 },
  formatAssistanceText: { fontSize: 11, color: '#737784', fontWeight: '700' },
  clearText: { fontSize: 11, color: '#003c90', fontWeight: '700' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#434653', letterSpacing: 0.8, textTransform: 'uppercase' },
  tapToQuery: { fontSize: 11, fontWeight: '700', color: '#737784', letterSpacing: 0.4 },

  chipsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  chipBtn: { width: '48%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  chipLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chipText: { fontSize: 11, fontWeight: '700', fontFamily: 'monospace', color: '#131b2e' },
  chipDotSecondary: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#006a63' },
  chipDotAmber: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#f59e0b' },
  chipDotError: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ba1a1a' },

  resultsViewport: { backgroundColor: '#ffffff', borderRadius: 16, padding: 24, alignItems: 'center', justifyContent: 'center', minHeight: 290, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#eaedff', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  resultsTitle: { fontSize: 17, fontWeight: '600', color: '#131b2e', marginBottom: 4 },
  resultsDesc: { fontSize: 14, color: '#434653', textAlign: 'center', paddingHorizontal: 20, marginBottom: 24 },
  
  quickMetricsRow: { flexDirection: 'row', gap: 8, width: '100%', borderTopWidth: 1, borderTopColor: '#eaedff', paddingTop: 16 },
  quickMetricBox: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f2f3ff', borderRadius: 8, padding: 8, minHeight: 64 },
  quickMetricValue: { fontSize: 22, fontWeight: '700', color: '#131b2e' },
  quickMetricLabel: { fontSize: 11, fontWeight: '600', color: '#737784', letterSpacing: 0.8, textTransform: 'uppercase' },

  resultsContainer: { marginTop: 12, padding: 16, backgroundColor: '#ffffff', borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  resultCard: { },
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
