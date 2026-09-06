import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, SafeAreaView, ActivityIndicator, ScrollView } from 'react-native';
import Header from '../../../components/Header';
import { useAuth } from '../../../context/AuthContext';
import { ExceptionRepository } from '../../../database/v2/repositories/ExceptionRepository';
import { database } from '../../../database/v2';
import Asset from '../../../database/v2/models/Asset';

const EXCEPTION_TYPES = [
  { label: 'Damage', value: 'DAMAGE' },
  { label: 'Missing Parts', value: 'MISSING_PARTS' },
  { label: 'Condemnation Request', value: 'CONDEMNATION' },
  { label: 'Other', value: 'OTHER' },
];

const SEVERITIES = [
  { label: 'Low', value: 'LOW', color: '#10b981' },
  { label: 'Medium', value: 'MEDIUM', color: '#f59e0b' },
  { label: 'High', value: 'HIGH', color: '#f97316' },
  { label: 'Critical', value: 'CRITICAL', color: '#ef4444' },
];

export default function ReportExceptionScreen({ navigation }: any) {
  const { employeeId, userId } = useAuth();
  
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [type, setType] = useState('DAMAGE');
  const [severity, setSeverity] = useState('HIGH');
  const [reason, setReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    const allAssets = await database.collections.get<Asset>('assets').query().fetch();
    setAssets(allAssets.filter(a => a.currentStatus !== 'EXCEPTION_LOGGED'));
  };

  const handleSubmit = async () => {
    if (!selectedAssetId) {
      Alert.alert('Validation', 'Please select an asset.');
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Validation', 'Please provide a reason.');
      return;
    }

    Alert.alert(
      'Confirm Exception',
      'Are you sure you want to report this exception? The asset will be locked until resolved.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm', 
          onPress: async () => {
            setProcessing(true);
            try {
              await ExceptionRepository.reportException({
                assetId: selectedAssetId,
                type,
                severity,
                reason
              });
              Alert.alert('Success', 'Exception reported and queued for sync.', [
                { text: 'OK', onPress: () => navigation.goBack() }
              ]);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to report exception.');
            } finally {
              setProcessing(false);
            }
          }
        }
      ]
    );
  };

  if (processing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0A74DA" />
        <Text style={styles.loadingText}>Reporting Exception...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="REPORT EXCEPTION" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        
        <Text style={styles.label}>Select Asset *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {assets.map(a => {
            const isSelected = selectedAssetId === a.id;
            return (
              <TouchableOpacity
                key={a.id}
                style={[styles.assetChip, isSelected && styles.assetChipActive]}
                onPress={() => setSelectedAssetId(a.id)}
              >
                <Text style={[styles.assetChipTitle, isSelected && styles.assetChipTextActive]}>
                  {a.assetNumber}
                </Text>
                <Text style={[styles.assetChipSub, isSelected && styles.assetChipTextActive]}>
                  {a.currentStatus}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {assets.length === 0 && (
          <Text style={styles.emptyNote}>No assets found. Ensure assets are synced.</Text>
        )}

        <Text style={styles.label}>Exception Type</Text>
        <View style={styles.chipRow}>
          {EXCEPTION_TYPES.map(t => {
            const isSelected = type === t.value;
            return (
              <TouchableOpacity
                key={t.value}
                style={[styles.selectorChip, isSelected && styles.selectorChipActive]}
                onPress={() => setType(t.value)}
              >
                <Text style={[styles.selectorChipText, isSelected && styles.selectorChipTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Severity</Text>
        <View style={styles.chipRow}>
          {SEVERITIES.map(s => {
            const isSelected = severity === s.value;
            return (
              <TouchableOpacity
                key={s.value}
                style={[
                  styles.selectorChip,
                  isSelected && { backgroundColor: s.color, borderColor: s.color }
                ]}
                onPress={() => setSeverity(s.value)}
              >
                <Text style={[styles.selectorChipText, isSelected && styles.selectorChipTextActive]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Reason / Details *</Text>
        <TextInput
          style={styles.input}
          multiline
          numberOfLines={4}
          placeholder="Describe the issue, damage observed, or missing parts..."
          placeholderTextColor="#94a3b8"
          value={reason}
          onChangeText={setReason}
        />

        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
          <Text style={styles.submitText}>REPORT EXCEPTION</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f1f5f9' },
  container: { flex: 1, backgroundColor: '#ffffff', padding: 16 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 16, color: '#64748b' },
  label: { fontSize: 14, fontWeight: 'bold', color: '#475569', marginBottom: 8, marginTop: 16 },
  chipScroll: { flexDirection: 'row', marginBottom: 8 },
  assetChip: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    marginRight: 8,
    minWidth: 100,
  },
  assetChipActive: {
    backgroundColor: '#0A74DA',
    borderColor: '#0A74DA',
  },
  assetChipTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  assetChipSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  assetChipTextActive: {
    color: '#ffffff',
  },
  emptyNote: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  selectorChip: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectorChipActive: {
    backgroundColor: '#0A74DA',
    borderColor: '#0A74DA',
  },
  selectorChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  selectorChipTextActive: {
    color: '#ffffff',
  },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, minHeight: 100, textAlignVertical: 'top', backgroundColor: '#f8fafc' },
  submitBtn: { backgroundColor: '#ef4444', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 32, marginBottom: 40 },
  submitText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 }
});
