import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../../context/AuthContext';
import { YardRepository } from '../../../database/v2/repositories/YardRepository';
import { database } from '../../../database/v2';
import Asset from '../../../database/v2/models/Asset';
import { Q } from '@nozbe/watermelondb';

interface TargetShop {
  id: string;
  name: string;
  desc: string;
  type: string;
}

const JAMALPUR_SHOPS: TargetShop[] = [
  { id: 'WRS-1', name: 'WRS-1', desc: 'POH / Periodic Overhaul', type: 'Wagon' },
  { id: 'WRS-2', name: 'WRS-2', desc: 'Heavy Repair & Rehab', type: 'Wagon' },
  { id: 'WRS-3', name: 'WRS-3', desc: 'Body & Underframe', type: 'Wagon' },
  { id: 'WRS-4', name: 'WRS-4', desc: 'Wheel & Bogie Overhaul', type: 'Wagon' },
  { id: 'DPS', name: 'DPS', desc: 'Diesel Locomotive POH', type: 'Loco' },
  { id: 'CRANE', name: 'CRANE', desc: '140T Breakdown Cranes', type: 'Crane' },
  { id: 'GIF', name: 'GIF', desc: 'Foundry & Wheel Casting', type: 'Foundry' },
];

const SHOP_BAYS = ['Main Bay', 'Inbound Track A', 'Inbound Track B', 'Stage-1 Line', 'Stage-2 Line'];

export default function AllocateScreen({ navigation }: any) {
  const { employeeId } = useAuth();
  
  const [assetNumber, setAssetNumber] = useState('');
  const [selectedShop, setSelectedShop] = useState('WRS-1');
  const [selectedBay, setSelectedBay] = useState('Main Bay');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [foundAsset, setFoundAsset] = useState<Asset | null>(null);

  // Unallocated wagons in NSY
  const [unallocatedAssets, setUnallocatedAssets] = useState<Asset[]>([]);
  const [shopOccupancy, setShopOccupancy] = useState<Record<string, number>>({});
  const [isLoadingList, setIsLoadingList] = useState(true);

  useEffect(() => {
    loadYardData();
  }, []);

  const loadYardData = async () => {
    try {
      setIsLoadingList(true);
      const assetsTable = database.collections.get<Asset>('assets');
      
      // Fetch assets in yard awaiting allocation
      const yardAssets = await assetsTable
        .query(
          Q.where('current_status', Q.oneOf(['RECEIVED_IN_YARD', 'Unallocated', 'AWAITING_ALLOCATION']))
        )
        .fetch();
      setUnallocatedAssets(yardAssets);

      // Compute shop occupancy
      const allAssets = await assetsTable.query().fetch();
      const counts: Record<string, number> = {};
      JAMALPUR_SHOPS.forEach(s => { counts[s.id] = 0; });
      allAssets.forEach(a => {
        if (counts[a.currentLocationId] !== undefined) {
          counts[a.currentLocationId]++;
        }
      });
      setShopOccupancy(counts);
    } catch (err) {
      console.error('Failed to load yard assets for allocation:', err);
    } finally {
      setIsLoadingList(false);
    }
  };

  const handleSelectAsset = (asset: Asset) => {
    setFoundAsset(asset);
    setAssetNumber(asset.assetNumber);
  };

  const handleSearchAsset = async () => {
    if (!assetNumber.trim()) return;
    
    setIsSearching(true);
    try {
      const assets = await database.collections.get<Asset>('assets')
        .query(Q.where('asset_number', assetNumber.toUpperCase().trim()))
        .fetch();
        
      if (assets.length > 0) {
        setFoundAsset(assets[0]);
      } else {
        setFoundAsset(null);
        Alert.alert('Not Found', 'Could not find asset in local database.');
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAllocate = async () => {
    if (!foundAsset || !selectedShop) {
      Alert.alert('Validation Error', 'Please select an asset and target shop.');
      return;
    }

    setIsSubmitting(true);
    try {
      await YardRepository.allocateAsset({
        assetId: foundAsset.id,
        shopId: selectedShop,
        userId: employeeId || 'UNKNOWN',
      });

      Alert.alert('Success', `Asset ${foundAsset.assetNumber} successfully allocated to ${selectedShop} (${selectedBay}).`, [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      console.error('Allocation error:', error);
      Alert.alert('Error', error?.message || 'Failed to allocate asset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ALLOCATE ROLLING STOCK</Text>
      </View>

      {/* Quick Select from NSY */}
      <View style={styles.formGroup}>
        <View style={styles.sectionHeader}>
          <Text style={styles.label}>Unallocated Stock in NSY ({unallocatedAssets.length})</Text>
          <TouchableOpacity onPress={loadYardData}>
            <Icon name="refresh" size={18} color="#0A74DA" />
          </TouchableOpacity>
        </View>

        {isLoadingList ? (
          <ActivityIndicator size="small" color="#0A74DA" style={{ marginVertical: 10 }} />
        ) : unallocatedAssets.length === 0 ? (
          <Text style={styles.emptyHint}>No unallocated stock waiting in yard. Use search below.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stockScroll}>
            {unallocatedAssets.map(asset => {
              const isSelected = foundAsset?.id === asset.id;
              return (
                <TouchableOpacity
                  key={asset.id}
                  style={[styles.stockCard, isSelected && styles.stockCardSelected]}
                  onPress={() => handleSelectAsset(asset)}
                >
                  <View style={styles.stockHeader}>
                    <Icon 
                      name={asset.assetCategory === 'LOCO' ? 'train' : 'train-car'} 
                      size={16} 
                      color={isSelected ? '#FFFFFF' : '#0284c7'} 
                    />
                    <Text style={[styles.stockNumber, isSelected && styles.stockTextSelected]}>
                      {asset.assetNumber}
                    </Text>
                  </View>
                  <Text style={[styles.stockMeta, isSelected && styles.stockTextSelected]}>
                    Loc: {asset.currentLocationId}
                  </Text>
                  <Text style={[styles.stockStatus, isSelected && styles.stockTextSelected]}>
                    {asset.currentStatus}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Manual Search */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Or Search Asset Number</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={assetNumber}
            onChangeText={(text) => {
              setAssetNumber(text);
              if (foundAsset && foundAsset.assetNumber !== text) {
                setFoundAsset(null);
              }
            }}
            placeholder="e.g. 21021845128"
            placeholderTextColor="#94a3b8"
            autoCapitalize="characters"
          />
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearchAsset} disabled={isSearching}>
            {isSearching ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Icon name="magnify" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Selected Asset Details */}
      {foundAsset && (
        <View style={styles.assetCard}>
          <View style={styles.selectedBadge}>
            <Icon name="check-circle" size={16} color="#059669" />
            <Text style={styles.selectedBadgeText}>SELECTED FOR ALLOCATION</Text>
          </View>
          <Text style={styles.assetTitle}>{foundAsset.assetNumber}</Text>
          <View style={styles.assetMetaRow}>
            <Text style={styles.assetSub}>Category: <Text style={styles.metaVal}>{foundAsset.assetCategory || 'WAGON'}</Text></Text>
            <Text style={styles.assetSub}>Track: <Text style={styles.metaVal}>{foundAsset.currentLocationId}</Text></Text>
            <Text style={styles.assetSub}>Status: <Text style={styles.metaVal}>{foundAsset.currentStatus}</Text></Text>
          </View>
        </View>
      )}

      {/* Target Jamalpur Shop Selection */}
      <View style={[styles.formGroup, { marginTop: 12 }]}>
        <Text style={styles.label}>Target Jamalpur Shop *</Text>
        <View style={styles.shopGrid}>
          {JAMALPUR_SHOPS.map(shop => {
            const isSelected = selectedShop === shop.id;
            const occupancy = shopOccupancy[shop.id] || 0;
            return (
              <TouchableOpacity
                key={shop.id}
                style={[styles.shopCard, isSelected && styles.shopCardActive]}
                onPress={() => setSelectedShop(shop.id)}
              >
                <View style={styles.shopTop}>
                  <Text style={[styles.shopCode, isSelected && styles.shopTextActive]}>{shop.name}</Text>
                  <View style={[styles.occBadge, isSelected && styles.occBadgeActive]}>
                    <Text style={[styles.occText, isSelected && styles.occTextActive]}>{occupancy} in shop</Text>
                  </View>
                </View>
                <Text style={[styles.shopDesc, isSelected && styles.shopTextActive]}>{shop.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Shop Bay Selection */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Shop Bay / Inbound Track</Text>
        <View style={styles.bayRow}>
          {SHOP_BAYS.map(bay => {
            const isSelected = selectedBay === bay;
            return (
              <TouchableOpacity
                key={bay}
                style={[styles.bayChip, isSelected && styles.bayChipActive]}
                onPress={() => setSelectedBay(bay)}
              >
                <Text style={[styles.bayChipText, isSelected && styles.bayChipTextActive]}>{bay}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Submit Button */}
      <TouchableOpacity 
        style={[styles.submitBtn, (!foundAsset || isSubmitting) && styles.submitBtnDisabled]} 
        onPress={handleAllocate}
        disabled={!foundAsset || isSubmitting}
      >
        <Icon name="check-circle-outline" size={20} color="#FFFFFF" />
        <Text style={styles.submitBtnText}>
          {isSubmitting ? 'RECORDING ALLOCATION...' : `ALLOCATE TO ${selectedShop}`}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
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
  formGroup: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    color: '#334155',
    marginBottom: 8,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  emptyHint: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  stockScroll: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  stockCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    marginRight: 10,
    minWidth: 140,
  },
  stockCardSelected: {
    backgroundColor: '#0A74DA',
    borderColor: '#0A74DA',
  },
  stockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  stockNumber: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  stockMeta: {
    fontSize: 11,
    color: '#64748b',
  },
  stockStatus: {
    fontSize: 10,
    color: '#0284c7',
    fontWeight: '600',
    marginTop: 2,
  },
  stockTextSelected: {
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#0f172a',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchBtn: {
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  assetCard: {
    backgroundColor: '#f0fdf4',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 16,
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  selectedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
    letterSpacing: 0.5,
  },
  assetTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 6,
  },
  assetMetaRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  assetSub: {
    fontSize: 12,
    color: '#475569',
  },
  metaVal: {
    fontWeight: '600',
    color: '#0f172a',
  },
  shopGrid: {
    gap: 8,
  },
  shopCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 12,
  },
  shopCardActive: {
    backgroundColor: '#0A74DA',
    borderColor: '#0A74DA',
  },
  shopTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  shopCode: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  occBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  occBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  occText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  occTextActive: {
    color: '#FFFFFF',
  },
  shopDesc: {
    fontSize: 12,
    color: '#64748b',
  },
  shopTextActive: {
    color: '#FFFFFF',
  },
  bayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bayChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  bayChipActive: {
    backgroundColor: '#1e293b',
    borderColor: '#1e293b',
  },
  bayChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  bayChipTextActive: {
    color: '#FFFFFF',
  },
  submitBtn: {
    backgroundColor: '#0A74DA',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 36,
    gap: 8,
    elevation: 2,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  }
});
