import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';

export type QAVerdict = 'FIT' | 'MINOR_FIX' | 'NOT_FIT' | 'CONDEMNATION_REQUEST';

interface SharedQAFormProps {
  assetNumber: string;
  sourceContext: string;
  sourceId: string;
  onSubmit: (verdict: QAVerdict, remarks: string) => Promise<void>;
}

export default function SharedQAForm({ assetNumber, sourceContext, sourceId, onSubmit }: SharedQAFormProps) {
  const [remarks, setRemarks] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleVerdict = (verdict: QAVerdict) => {
    Alert.alert(
      `Confirm ${verdict}`,
      `Are you sure you want to mark this asset as ${verdict}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm', 
          onPress: async () => {
            setProcessing(true);
            try {
              await onSubmit(verdict, remarks);
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
        <Text style={styles.loadingText}>Processing Inspection...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.contextCard}>
        <Text style={styles.contextLabel}>Source: {sourceContext}</Text>
        <Text style={styles.contextValue}>{sourceId}</Text>
        <Text style={styles.contextLabel}>Asset Number</Text>
        <Text style={styles.assetNumber}>{assetNumber}</Text>
      </View>

      <Text style={styles.sectionTitle}>Inspection Remarks (Optional)</Text>
      <TextInput
        style={styles.remarksInput}
        multiline
        numberOfLines={4}
        placeholder="Enter inspection remarks here..."
        value={remarks}
        onChangeText={setRemarks}
      />

      <Text style={styles.sectionTitle}>Submit Verdict</Text>
      <View style={styles.verdictGrid}>
        <TouchableOpacity style={[styles.verdictBtn, styles.fitBtn]} onPress={() => handleVerdict('FIT')}>
          <Text style={styles.verdictText}>PASS (FIT)</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.verdictBtn, styles.minorBtn]} onPress={() => handleVerdict('MINOR_FIX')}>
          <Text style={styles.verdictText}>MINOR FIX</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.verdictBtn, styles.notFitBtn]} onPress={() => handleVerdict('NOT_FIT')}>
          <Text style={styles.verdictText}>NOT FIT</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.verdictBtn, styles.condemnBtn]} onPress={() => handleVerdict('CONDEMNATION_REQUEST')}>
          <Text style={styles.verdictText}>CONDEMN</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  loadingContainer: { alignItems: 'center', justifyContent: 'center', padding: 48 },
  loadingText: { marginTop: 16, color: '#64748b', fontSize: 16 },
  contextCard: { backgroundColor: '#f8fafc', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 24 },
  contextLabel: { fontSize: 12, color: '#64748b', marginBottom: 4, textTransform: 'uppercase' },
  contextValue: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 12 },
  assetNumber: { fontSize: 24, fontWeight: '900', color: '#0A74DA' },
  sectionTitle: { fontSize: 14, color: '#475569', fontWeight: 'bold', marginBottom: 12, marginTop: 8 },
  remarksInput: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, minHeight: 100, textAlignVertical: 'top', marginBottom: 24 },
  verdictGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  verdictBtn: { width: '48%', padding: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  fitBtn: { backgroundColor: '#10b981' },
  minorBtn: { backgroundColor: '#f59e0b' },
  notFitBtn: { backgroundColor: '#ef4444' },
  condemnBtn: { backgroundColor: '#1e293b' },
  verdictText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 }
});
