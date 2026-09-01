import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../../context/AuthContext';
import { YardRepository } from '../../../database/v2/repositories/YardRepository';
import { database } from '../../../database/v2';
import Asset from '../../../database/v2/models/Asset';
import { Q } from '@nozbe/watermelondb';

export default function AllocateScreen({ navigation }: any) {
  const { employeeId } = useAuth();
  
  const [assetNumber, setAssetNumber] = useState('');
  const [destination, setDestination] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [foundAsset, setFoundAsset] = useState<Asset | null>(null);

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
    if (!foundAsset || !destination.trim()) {
      Alert.alert('Validation Error', 'Please search an asset and enter a destination.');
      return;
    }

    setIsSubmitting(true);
    try {
      await YardRepository.allocateAsset({
        assetId: foundAsset.id,
        shopId: destination.toUpperCase().trim(),
        userId: employeeId || 'UNKNOWN',
      });

      Alert.alert('Success', 'Asset allocation recorded offline.', [
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
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ALLOCATE ASSET</Text>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Asset Number</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={assetNumber}
            onChangeText={(text) => {
              setAssetNumber(text);
              setFoundAsset(null);
            }}
            placeholder="e.g. FLAT-54321"
            autoCapitalize="characters"
          />
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearchAsset} disabled={isSearching}>
            <Icon name="magnify" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {foundAsset && (
        <View style={styles.assetCard}>
          <Text style={styles.assetTitle}>{foundAsset.assetNumber}</Text>
          <Text style={styles.assetSub}>Current Location: {foundAsset.currentLocationId}</Text>
          <Text style={styles.assetSub}>Status: {foundAsset.currentStatus}</Text>
        </View>
      )}

      <View style={[styles.formGroup, { marginTop: 16 }]}>
        <Text style={styles.label}>Destination *</Text>
        <TextInput
          style={styles.input}
          value={destination}
          onChangeText={setDestination}
          placeholder="e.g. WRS-1"
          autoCapitalize="characters"
          editable={!!foundAsset}
        />
      </View>

      <TouchableOpacity 
        style={[styles.submitBtn, (!foundAsset || isSubmitting) && styles.submitBtnDisabled]} 
        onPress={handleAllocate}
        disabled={!foundAsset || isSubmitting}
      >
        <Icon name="check-circle-outline" size={20} color="#FFFFFF" />
        <Text style={styles.submitBtnText}>{isSubmitting ? 'SAVING...' : 'CONFIRM ALLOCATION'}</Text>
      </TouchableOpacity>
    </ScrollView>
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
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
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
    backgroundColor: '#e0f2fe',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
    marginTop: 8,
  },
  assetTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0369a1',
    marginBottom: 4,
  },
  assetSub: {
    fontSize: 14,
    color: '#0284c7',
  },
  submitBtn: {
    backgroundColor: '#0A74DA',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
