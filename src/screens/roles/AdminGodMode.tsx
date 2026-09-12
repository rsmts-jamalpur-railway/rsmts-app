import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import withObservables from '@nozbe/with-observables';
import { Q } from '@nozbe/watermelondb';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { database } from '../../database/v2';
import Asset from '../../database/v2/models/Asset';
import MovementLog from '../../database/v2/models/MovementLog';
import Exception from '../../database/v2/models/Exception';
import { useAuth } from '../../context/AuthContext';
import { prepareSyncOperation, uuidv4 } from '../../database/v2/repositories/utils';
import { SyncEngine } from '../../database/v2/sync';

type AdminTab = 'EXCEPTIONS' | 'PERSONAS' | 'CAPACITIES' | 'ALL_ASSETS';

const JAMALPUR_SHOPS = [
  { id: 'NSY', name: 'New Sorting Yard (NSY)', capacity: 120, type: 'Yard' },
  { id: 'WRS-1', name: 'WRS-1 (POH Wagon Shop)', capacity: 45, type: 'Repair' },
  { id: 'WRS-2', name: 'WRS-2 (Heavy Rehab & Fab)', capacity: 35, type: 'Repair' },
  { id: 'WRS-3', name: 'WRS-3 (Underframe & Body)', capacity: 30, type: 'Repair' },
  { id: 'WRS-4', name: 'WRS-4 (Wheel & Bogie)', capacity: 40, type: 'Repair' },
  { id: 'DPS', name: 'Diesel POH Shop (DPS)', capacity: 15, type: 'Loco' },
  { id: 'GIF', name: 'General Iron Foundry (GIF)', capacity: 50, type: 'Mfg' },
  { id: 'CRANE', name: '140T Breakdown Crane Shop', capacity: 6, type: 'Crane' },
];

const ROLES_LIST = [
  { key: 'SYSTEM_ADMIN', label: 'Works Manager / Admin', icon: 'shield-crown', color: '#e11d48', desc: 'Full workshop control & exceptions' },
  { key: 'YARD_CONTROLLER', label: 'Yard Master (NSY)', icon: 'train-car', color: '#0284c7', desc: 'Intake, allocation, outbound dispatch' },
  { key: 'REPAIR_SUPERVISOR', label: 'Repair Supervisor', icon: 'wrench', color: '#d97706', desc: 'POH/ROH overhaul, holds & shop floor' },
  { key: 'MANUFACTURING_SUPERVISOR', label: 'Mfg Supervisor', icon: 'factory', color: '#059669', desc: 'Foundry casting & assembly batches' },
  { key: 'QA_INSPECTOR', label: 'Chief QA Inspector', icon: 'shield-check', color: '#7c3aed', desc: 'RDSO tests & Fit Certificates' },
];

interface AdminGodModeProps {
  assets: Asset[];
  exceptions: Exception[];
  recentLogs: MovementLog[];
}

function AdminGodModeComponent({ assets = [], exceptions = [], recentLogs = [] }: AdminGodModeProps) {
  const { role, switchRole, employeeId } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('EXCEPTIONS');
  
  // Modals
  const [routeModal, setRouteModal] = useState(false);
  const [timelineModal, setTimelineModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);

  // Filtered exception assets
  const exceptionAssets = assets.filter(
    a => a.currentStatus === 'Missing' || a.currentStatus === 'CONDEMNATION_REQUESTED' || 
         a.currentStatus === 'REPAIR_ON_HOLD' || a.currentStatus === 'Hold' || a.currentStatus === 'Condemned'
  );

  // Filtered all assets
  const filteredAssets = assets.filter(a => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toUpperCase().trim();
    return a.assetNumber.includes(q) || a.currentLocationId.includes(q) || a.currentStatus.includes(q);
  });

  // Shop Occupancies
  const shopOccupancies = JAMALPUR_SHOPS.map(shop => {
    const count = assets.filter(a => a.currentLocationId === shop.id).length;
    const percent = Math.min(100, Math.round((count / shop.capacity) * 100));
    return { ...shop, count, percent };
  });

  const handleOpenRouteModal = (asset: Asset) => {
    setSelectedAsset(asset);
    setRouteModal(true);
  };

  const handleOpenTimeline = (asset: Asset) => {
    setSelectedAsset(asset);
    setTimelineModal(true);
  };

  const executeResolution = async (asset: Asset, action: 'RE_ROUTE' | 'MARK_FOUND' | 'APPROVE_CONDEMNATION' | 'RELEASE_HOLD', targetShop?: string) => {
    setIsExecuting(true);
    const clientOpId = uuidv4();
    const now = new Date();

    try {
      await database.write(async () => {
        let newStatus = asset.currentStatus;
        let newLocation = asset.currentLocationId;
        let remarks = '';
        let cmdType = 'EXCEPTION_RESOLVE';

        if (action === 'RE_ROUTE' && targetShop) {
          newStatus = 'Allocated';
          newLocation = targetShop;
          remarks = `Admin Force Re-Routed from ${asset.currentLocationId} to ${targetShop}`;
          cmdType = 'YARD_ALLOCATE';
        } else if (action === 'MARK_FOUND') {
          newStatus = 'Allocated';
          newLocation = targetShop || asset.currentLocationId || 'WRS-1';
          remarks = `Admin Marked Found at ${newLocation}`;
          cmdType = 'EXCEPTION_RESOLVE';
        } else if (action === 'APPROVE_CONDEMNATION') {
          newStatus = 'CONDEMNED';
          newLocation = 'SCRAP_YARD';
          remarks = `Admin Approved Condemnation & Scrapping`;
          cmdType = 'EXCEPTION_RESOLVE';
        } else if (action === 'RELEASE_HOLD') {
          newStatus = 'IN_REPAIR';
          remarks = `Admin Released Hold & Resumed Overhaul`;
          cmdType = 'REPAIR_RESUME';
        }

        const assetUpdate = asset.prepareUpdate(a => {
          a.currentStatus = newStatus;
          a.currentLocationId = newLocation;
        });

        const movementLogCreate = database.collections.get<MovementLog>('movement_logs').prepareCreate(log => {
          log.clientOperationId = clientOpId;
          log.assetId = asset.id;
          log.fromLocationId = asset.currentLocationId;
          log.toLocationId = newLocation;
          log.previousStatus = asset.currentStatus;
          log.newStatus = newStatus;
          log.remarks = remarks;
        });

        const syncOperation = prepareSyncOperation(database, clientOpId, cmdType, {
          client_operation_id: clientOpId,
          asset_id: asset.serverId || null,
          asset_number: asset.assetNumber,
          action,
          target_location_id: newLocation,
          resolved_by: employeeId || 'ADMIN',
          offline_timestamp: now.getTime()
        });

        await database.batch(assetUpdate, movementLogCreate, syncOperation);
      });
      SyncEngine.sync().catch(e => console.log('Auto-sync failed:', e?.message));

      setRouteModal(false);
      setSelectedAsset(null);
      Alert.alert('Resolution Saved', `Asset ${asset.assetNumber} updated. Transaction queued in outbox.`);
    } catch (err: any) {
      console.error('Resolution error:', err);
      Alert.alert('Resolution Error', err?.message || 'Failed to resolve exception.');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Admin Command Header */}
      <View style={styles.adminHeader}>
        <View>
          <Text style={styles.adminTitle}>JAMALPUR HQ WORKSHOP ADMIN</Text>
          <Text style={styles.adminSub}>Role: <Text style={styles.roleHighlight}>{role}</Text> • Officer: {employeeId || 'CWM'}</Text>
        </View>
        <View style={styles.adminBadge}>
          <Icon name="shield-crown" size={16} color="#e11d48" />
          <Text style={styles.adminBadgeText}>GOD MODE</Text>
        </View>
      </View>

      {/* Segmented Top Navigation */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'EXCEPTIONS' && styles.tabBtnActive]}
          onPress={() => setActiveTab('EXCEPTIONS')}
        >
          <Icon name="alert-octagon" size={16} color={activeTab === 'EXCEPTIONS' ? '#FFFFFF' : '#64748b'} />
          <Text style={[styles.tabText, activeTab === 'EXCEPTIONS' && styles.tabTextActive]}>
            EXCEPTIONS ({exceptionAssets.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'PERSONAS' && styles.tabBtnActive]}
          onPress={() => setActiveTab('PERSONAS')}
        >
          <Icon name="account-switch" size={16} color={activeTab === 'PERSONAS' ? '#FFFFFF' : '#64748b'} />
          <Text style={[styles.tabText, activeTab === 'PERSONAS' && styles.tabTextActive]}>
            PERSONAS
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'CAPACITIES' && styles.tabBtnActive]}
          onPress={() => setActiveTab('CAPACITIES')}
        >
          <Icon name="chart-bar" size={16} color={activeTab === 'CAPACITIES' ? '#FFFFFF' : '#64748b'} />
          <Text style={[styles.tabText, activeTab === 'CAPACITIES' && styles.tabTextActive]}>
            CAPACITIES
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'ALL_ASSETS' && styles.tabBtnActive]}
          onPress={() => setActiveTab('ALL_ASSETS')}
        >
          <Icon name="format-list-bulleted" size={16} color={activeTab === 'ALL_ASSETS' ? '#FFFFFF' : '#64748b'} />
          <Text style={[styles.tabText, activeTab === 'ALL_ASSETS' && styles.tabTextActive]}>
            DIRECTORY
          </Text>
        </TouchableOpacity>
      </View>

      {/* TAB CONTENT 1: EXCEPTIONS */}
      {activeTab === 'EXCEPTIONS' && (
        <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionHeader}>WORKSHOP EXCEPTION RESOLUTION CENTER</Text>
          {exceptionAssets.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="check-circle-outline" size={48} color="#059669" />
              <Text style={styles.emptyTitle}>All Systems Nominal</Text>
              <Text style={styles.emptyText}>No missing rolling stock, holds, or condemnation requests pending.</Text>
            </View>
          ) : (
            exceptionAssets.map(asset => (
              <View key={asset.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.assetNumRow}>
                    <Icon name="train-car" size={18} color="#0f172a" />
                    <Text style={styles.cardAssetNumber}>{asset.assetNumber}</Text>
                  </View>
                  <View style={[
                    styles.statusBadge, 
                    asset.currentStatus === 'Missing' ? styles.statusMissing :
                    asset.currentStatus.includes('CONDEMN') ? styles.statusCondemn : styles.statusHold
                  ]}>
                    <Text style={styles.statusBadgeText}>{asset.currentStatus}</Text>
                  </View>
                </View>

                <Text style={styles.cardSub}>Current Location: <Text style={styles.boldVal}>{asset.currentLocationId}</Text></Text>
                <Text style={styles.cardSub}>Category: <Text style={styles.boldVal}>{asset.assetCategory || 'WAGON'}</Text></Text>

                {/* Action Row */}
                <View style={styles.btnRow}>
                  {asset.currentStatus === 'Missing' && (
                    <>
                      <TouchableOpacity 
                        style={[styles.actionBtn, styles.primaryBtn]} 
                        onPress={() => handleOpenRouteModal(asset)}
                      >
                        <Icon name="routes" size={14} color="#FFFFFF" />
                        <Text style={styles.btnText}>FORCE RE-ROUTE</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.actionBtn, styles.successBtn]} 
                        onPress={() => executeResolution(asset, 'MARK_FOUND')}
                      >
                        <Icon name="map-marker-check" size={14} color="#FFFFFF" />
                        <Text style={styles.btnText}>MARK FOUND</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {asset.currentStatus.includes('CONDEMN') && (
                    <TouchableOpacity 
                      style={[styles.actionBtn, styles.dangerBtn]} 
                      onPress={() => executeResolution(asset, 'APPROVE_CONDEMNATION')}
                    >
                      <Icon name="skull-crossbones" size={14} color="#FFFFFF" />
                      <Text style={styles.btnText}>APPROVE SCRAP</Text>
                    </TouchableOpacity>
                  )}

                  {asset.currentStatus.includes('HOLD') && (
                    <TouchableOpacity 
                      style={[styles.actionBtn, styles.warningBtn]} 
                      onPress={() => executeResolution(asset, 'RELEASE_HOLD')}
                    >
                      <Icon name="play-circle-outline" size={14} color="#FFFFFF" />
                      <Text style={styles.btnText}>RELEASE HOLD</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* TAB CONTENT 2: PERSONA SWITCHER */}
      {activeTab === 'PERSONAS' && (
        <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionHeader}>INSTANT ROLE & PERSONA EMULATION</Text>
          <Text style={styles.sectionSub}>
            Switch roles to test permissions, interface flows, and shop-specific offline actions.
          </Text>

          <View style={styles.personaGrid}>
            {ROLES_LIST.map(r => {
              const isCurrent = role === r.key;
              return (
                <TouchableOpacity
                  key={r.key}
                  style={[styles.personaCard, isCurrent && styles.personaCardActive]}
                  onPress={() => {
                    switchRole(r.key);
                    Alert.alert('Role Switched', `Active persona is now: ${r.label}`);
                  }}
                >
                  <View style={styles.personaTop}>
                    <View style={[styles.personaIconWrap, { backgroundColor: r.color }]}>
                      <Icon name={r.icon} size={22} color="#FFFFFF" />
                    </View>
                    {isCurrent && (
                      <View style={styles.activeTag}>
                        <Text style={styles.activeTagText}>CURRENT ROLE</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.personaTitle}>{r.label}</Text>
                  <Text style={styles.personaDesc}>{r.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* TAB CONTENT 3: CAPACITIES */}
      {activeTab === 'CAPACITIES' && (
        <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionHeader}>JAMALPUR 68-NODE WORKSHOP CAPACITIES</Text>
          <Text style={styles.sectionSub}>Live bay utilization and bottleneck telemetry.</Text>

          {shopOccupancies.map(shop => {
            const isHigh = shop.percent >= 80;
            return (
              <View key={shop.id} style={styles.shopCard}>
                <View style={styles.shopHeader}>
                  <View>
                    <Text style={styles.shopName}>{shop.name}</Text>
                    <Text style={styles.shopType}>{shop.type} Unit</Text>
                  </View>
                  <Text style={[styles.shopPercent, isHigh && styles.shopPercentHigh]}>
                    {shop.count} / {shop.capacity} ({shop.percent}%)
                  </Text>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressTrack}>
                  <View style={[
                    styles.progressFill, 
                    { width: `${shop.percent}%` },
                    isHigh ? styles.progressHigh : styles.progressNormal
                  ]} />
                </View>
              </View>
            );
          })}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* TAB CONTENT 4: ALL ASSETS */}
      {activeTab === 'ALL_ASSETS' && (
        <View style={{ flex: 1 }}>
          <View style={styles.searchBar}>
            <Icon name="magnify" size={20} color="#64748b" />
            <TextInput
              style={styles.searchInput}
              placeholder="Filter by wagon number, shop, or status..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="characters"
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Icon name="close-circle" size={18} color="#94a3b8" />
              </TouchableOpacity>
            ) : null}
          </View>

          <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
            {filteredAssets.map(asset => (
              <TouchableOpacity 
                key={asset.id} 
                style={styles.directoryCard}
                onPress={() => handleOpenTimeline(asset)}
              >
                <View style={styles.dirHeader}>
                  <Text style={styles.dirTitle}>{asset.assetNumber}</Text>
                  <Text style={styles.dirLocation}>{asset.currentLocationId}</Text>
                </View>
                <View style={styles.dirMeta}>
                  <Text style={styles.dirSub}>Category: {asset.assetCategory || 'WAGON'}</Text>
                  <Text style={styles.dirSub}>Status: <Text style={{ fontWeight: 'bold', color: '#0A74DA' }}>{asset.currentStatus}</Text></Text>
                </View>
                <Text style={styles.tapHint}>Tap to view movement history ➜</Text>
              </TouchableOpacity>
            ))}
            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      )}

      {/* Re-Route Destination Picker Modal */}
      <Modal visible={routeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>FORCE RE-ROUTE STOCK</Text>
                <Text style={styles.modalSub}>{selectedAsset?.assetNumber}</Text>
              </View>
              <TouchableOpacity onPress={() => setRouteModal(false)}>
                <Icon name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalInstruction}>
              Select target repair shop to re-allocate this rolling stock:
            </Text>

            <View style={styles.shopGrid}>
              {JAMALPUR_SHOPS.filter(s => s.id !== 'NSY').map(shop => (
                <TouchableOpacity
                  key={shop.id}
                  style={styles.shopChoiceBtn}
                  onPress={() => selectedAsset && executeResolution(selectedAsset, 'RE_ROUTE', shop.id)}
                >
                  <Text style={styles.shopChoiceCode}>{shop.id}</Text>
                  <Text style={styles.shopChoiceName} numberOfLines={1}>{shop.name.split(' ')[0]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setRouteModal(false)}>
              <Text style={styles.cancelBtnText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Movement Timeline Modal */}
      <Modal visible={timelineModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>AUDIT LOG TIMELINE</Text>
                <Text style={styles.modalSub}>{selectedAsset?.assetNumber}</Text>
              </View>
              <TouchableOpacity onPress={() => setTimelineModal(false)}>
                <Icon name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              {recentLogs
                .filter(l => l.assetId === selectedAsset?.id)
                .map(log => (
                  <View key={log.id} style={styles.timelineItem}>
                    <View style={styles.timelineDot} />
                    <View style={styles.timelineBody}>
                      <Text style={styles.timelineTime}>
                        {new Date(log.createdAt).toLocaleString()}
                      </Text>
                      <Text style={styles.timelineStatus}>
                        {log.previousStatus || 'START'} ➔ {log.newStatus}
                      </Text>
                      <Text style={styles.timelineLoc}>
                        {log.fromLocationId || 'Yard'} ➔ {log.toLocationId || 'Shop'}
                      </Text>
                      {log.remarks && (
                        <Text style={styles.timelineRemarks}>"{log.remarks}"</Text>
                      )}
                    </View>
                  </View>
                ))}
            </ScrollView>

            <TouchableOpacity style={[styles.cancelBtn, { marginTop: 12 }]} onPress={() => setTimelineModal(false)}>
              <Text style={styles.cancelBtnText}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const enhance = withObservables([], () => ({
  assets: database.collections.get<Asset>('assets').query().observe(),
  exceptions: database.collections.get<Exception>('exceptions').query().observe(),
  recentLogs: database.collections.get<MovementLog>('movement_logs')
    .query(Q.sortBy('created_at', Q.desc), Q.take(40))
    .observe(),
}));

export default enhance(AdminGodModeComponent);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  adminHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  adminTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a', letterSpacing: 0.4 },
  adminSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  roleHighlight: { color: '#e11d48', fontWeight: 'bold' },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffe4e6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  adminBadgeText: { fontSize: 10, fontWeight: '800', color: '#e11d48' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  tabBtnActive: { backgroundColor: '#0f172a' },
  tabText: { fontSize: 10, fontWeight: '700', color: '#64748b' },
  tabTextActive: { color: '#FFFFFF' },
  tabContent: { flex: 1, padding: 14 },
  sectionHeader: { fontSize: 12, fontWeight: '800', color: '#334155', marginBottom: 4, letterSpacing: 0.3 },
  sectionSub: { fontSize: 11, color: '#64748b', marginBottom: 14 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  assetNumRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardAssetNumber: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusMissing: { backgroundColor: '#fee2e2' },
  statusCondemn: { backgroundColor: '#fef2f2' },
  statusHold: { backgroundColor: '#fef3c7' },
  statusBadgeText: { fontSize: 10, fontWeight: '700', color: '#0f172a' },
  cardSub: { fontSize: 12, color: '#64748b', marginBottom: 2 },
  boldVal: { fontWeight: '600', color: '#0f172a' },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  primaryBtn: { backgroundColor: '#0284c7' },
  successBtn: { backgroundColor: '#059669' },
  dangerBtn: { backgroundColor: '#dc2626' },
  warningBtn: { backgroundColor: '#d97706' },
  btnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 11 },
  personaGrid: { gap: 10 },
  personaCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 14,
  },
  personaCardActive: { borderColor: '#0f172a', borderWidth: 2, backgroundColor: '#f8fafc' },
  personaTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  personaIconWrap: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  activeTag: { backgroundColor: '#0f172a', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  activeTagText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  personaTitle: { fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
  personaDesc: { fontSize: 11, color: '#64748b', marginTop: 2 },
  shopCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 10,
  },
  shopHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  shopName: { fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
  shopType: { fontSize: 11, color: '#64748b' },
  shopPercent: { fontSize: 12, fontWeight: 'bold', color: '#059669' },
  shopPercentHigh: { color: '#dc2626' },
  progressTrack: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressNormal: { backgroundColor: '#059669' },
  progressHigh: { backgroundColor: '#dc2626' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    margin: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13, color: '#0f172a' },
  directoryCard: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  dirHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  dirTitle: { fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
  dirLocation: { fontSize: 12, fontWeight: '600', color: '#0284c7' },
  dirMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  dirSub: { fontSize: 11, color: '#64748b' },
  tapHint: { fontSize: 10, color: '#94a3b8', textAlign: 'right' },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 36,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyTitle: { fontSize: 15, fontWeight: 'bold', color: '#334155', marginTop: 10 },
  emptyText: { color: '#94a3b8', marginTop: 4, fontSize: 12, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  modalSub: { fontSize: 12, color: '#0A74DA', fontWeight: '600' },
  modalInstruction: { fontSize: 12, color: '#64748b', marginBottom: 12 },
  shopGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  shopChoiceBtn: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  shopChoiceCode: { fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
  shopChoiceName: { fontSize: 10, color: '#64748b' },
  cancelBtn: {
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelBtnText: { color: '#0f172a', fontWeight: 'bold', fontSize: 13 },
  timelineItem: { flexDirection: 'row', marginBottom: 12 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0A74DA', marginTop: 4, marginRight: 10 },
  timelineBody: { flex: 1, backgroundColor: '#f8fafc', padding: 10, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  timelineTime: { fontSize: 10, color: '#94a3b8', marginBottom: 2 },
  timelineStatus: { fontSize: 12, fontWeight: 'bold', color: '#0f172a' },
  timelineLoc: { fontSize: 11, color: '#64748b', marginTop: 2 },
  timelineRemarks: { fontSize: 11, color: '#475569', fontStyle: 'italic', marginTop: 4 },
});
