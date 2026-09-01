import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, SafeAreaView, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Header from '../../../components/Header';
import { useAuth } from '../../../../rsmts-dashboard/src/contexts/AuthContext';
import { ExceptionRepository } from '../../../database/v2/repositories/ExceptionRepository';
import { database } from '../../../database/v2';
import Asset from '../../../database/v2/models/Asset';

export default function ReportExceptionScreen({ navigation }: any) {
  const { user } = useAuth();
  
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
      <View style={styles.container}>
        
        <Text style={styles.label}>Select Asset</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedAssetId}
            onValueChange={(val) => setSelectedAssetId(val)}
          >
            <Picker.Item label="-- Select Asset --" value="" />
            {assets.map(a => (
              <Picker.Item key={a.id} label={`${a.assetNumber} (${a.currentStatus})`} value={a.id} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>Exception Type</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={type}
            onValueChange={(val) => setType(val)}
          >
            <Picker.Item label="Damage" value="DAMAGE" />
            <Picker.Item label="Missing Parts" value="MISSING_PARTS" />
            <Picker.Item label="Condemnation Request" value="CONDEMNATION" />
            <Picker.Item label="Other" value="OTHER" />
          </Picker>
        </View>

        <Text style={styles.label}>Severity</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={severity}
            onValueChange={(val) => setSeverity(val)}
          >
            <Picker.Item label="Low" value="LOW" />
            <Picker.Item label="Medium" value="MEDIUM" />
            <Picker.Item label="High" value="HIGH" />
            <Picker.Item label="Critical" value="CRITICAL" />
          </Picker>
        </View>

        <Text style={styles.label}>Reason / Details</Text>
        <TextInput
          style={styles.input}
          multiline
          numberOfLines={4}
          placeholder="Describe the issue..."
          value={reason}
          onChangeText={setReason}
        />

        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
          <Text style={styles.submitText}>REPORT EXCEPTION</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f1f5f9' },
  container: { flex: 1, backgroundColor: '#ffffff', padding: 16 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 16, color: '#64748b' },
  label: { fontSize: 14, fontWeight: 'bold', color: '#475569', marginBottom: 8, marginTop: 16 },
  pickerContainer: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, backgroundColor: '#f8fafc' },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, minHeight: 100, textAlignVertical: 'top', backgroundColor: '#f8fafc' },
  submitBtn: { backgroundColor: '#ef4444', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 32 },
  submitText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 }
});
