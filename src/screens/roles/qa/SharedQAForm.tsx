import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export type QAVerdict = 'FIT' | 'MINOR_FIX' | 'NOT_FIT' | 'CONDEMNATION_REQUEST';

interface SharedQAFormProps {
  assetNumber: string;
  sourceContext: string;
  sourceId: string;
  onSubmit: (verdict: QAVerdict, remarks: string) => Promise<void>;
}

const REDIRECT_SHOPS = ['WRS-1', 'WRS-2', 'WRS-3', 'WRS-4', 'DPS', 'GIF'];

const DEFECT_CATEGORIES = [
  'WHEEL: Flange / Root Wear Exceeded',
  'BRAKE: Distributor Valve / Cylinder Leakage',
  'UNDERFRAME: Solebar / Crossbar Structural Crack',
  'BOGIE: Spring Broken / Bolster Clearance Abnormal',
  'COUPLER: CBC Knuckle / Draft Gear Play Defect',
  'BODY: Heavy Panel Corrosion / Floor Perforation',
];

export default function SharedQAForm({ assetNumber, sourceContext, sourceId, onSubmit }: SharedQAFormProps) {
  const [selectedVerdict, setSelectedVerdict] = useState<QAVerdict>('FIT');
  const [selectedDefect, setSelectedDefect] = useState(DEFECT_CATEGORIES[0]);
  const [redirectShop, setRedirectShop] = useState('WRS-1');
  const [remarks, setRemarks] = useState('');
  const [photoCount, setPhotoCount] = useState(0);
  const [processing, setProcessing] = useState(false);

  const handleSimulatePhoto = () => {
    setPhotoCount(prev => prev + 1);
    Alert.alert('Photo Captured', `Proof photo #${photoCount + 1} attached to offline inspection report.`);
  };

  const handleSubmit = () => {
    let finalRemarks = remarks.trim();
    if (selectedVerdict !== 'FIT') {
      const extra = [
        `Defect: ${selectedDefect}`,
        selectedVerdict !== 'CONDEMNATION_REQUEST' ? `Redirected to: ${redirectShop}` : 'CONDEMNATION FLAGGED',
        photoCount > 0 ? `[${photoCount} Photo Proofs Attached]` : '',
        remarks.trim()
      ].filter(Boolean).join(' | ');
      finalRemarks = extra;
    }

    Alert.alert(
      `Confirm ${selectedVerdict} Verdict`,
      `Submit QA inspection for asset ${assetNumber} as ${selectedVerdict}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm Verdict', 
          onPress: async () => {
            setProcessing(true);
            try {
              await onSubmit(selectedVerdict, finalRemarks);
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
        <Text style={styles.loadingText}>Generating Inspection & Fit Record...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* Context Identification Card */}
      <View style={styles.contextCard}>
        <View style={styles.contextRow}>
          <Text style={styles.contextLabel}>Source: {sourceContext}</Text>
          <Text style={styles.contextValue}>ID: {sourceId.substring(0, 12)}</Text>
        </View>
        <Text style={styles.contextLabel}>ROLLING STOCK ASSET NUMBER</Text>
        <Text style={styles.assetNumber}>{assetNumber}</Text>
      </View>

      {/* Verdict Selection */}
      <Text style={styles.sectionTitle}>SELECT INSPECTION VERDICT *</Text>
      <View style={styles.verdictGrid}>
        <TouchableOpacity 
          style={[styles.verdictBtn, styles.fitBtn, selectedVerdict === 'FIT' && styles.verdictBtnActive]} 
          onPress={() => setSelectedVerdict('FIT')}
        >
          <Icon name="check-decagram" size={20} color="#FFFFFF" />
          <Text style={styles.verdictText}>PASS (FIT)</Text>
          <Text style={styles.verdictSubText}>Ready for NSY dispatch</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.verdictBtn, styles.minorBtn, selectedVerdict === 'MINOR_FIX' && styles.verdictBtnActive]} 
          onPress={() => setSelectedVerdict('MINOR_FIX')}
        >
          <Icon name="wrench-clock" size={20} color="#FFFFFF" />
          <Text style={styles.verdictText}>MINOR FIX</Text>
          <Text style={styles.verdictSubText}>Snag list adjustment</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.verdictBtn, styles.notFitBtn, selectedVerdict === 'NOT_FIT' && styles.verdictBtnActive]} 
          onPress={() => setSelectedVerdict('NOT_FIT')}
        >
          <Icon name="close-circle-outline" size={20} color="#FFFFFF" />
          <Text style={styles.verdictText}>NOT FIT</Text>
          <Text style={styles.verdictSubText}>Reject & full rework</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.verdictBtn, styles.condemnBtn, selectedVerdict === 'CONDEMNATION_REQUEST' && styles.verdictBtnActive]} 
          onPress={() => setSelectedVerdict('CONDEMNATION_REQUEST')}
        >
          <Icon name="skull-crossbones" size={20} color="#FFFFFF" />
          <Text style={styles.verdictText}>CONDEMN</Text>
          <Text style={styles.verdictSubText}>Scrap approval request</Text>
        </TouchableOpacity>
      </View>

      {/* Defect Category for Negative Verdicts */}
      {selectedVerdict !== 'FIT' && (
        <View style={styles.defectContainer}>
          <Text style={styles.sectionTitle}>PRIMARY DEFECT CLASSIFICATION *</Text>
          {DEFECT_CATEGORIES.map(defect => {
            const isSel = selectedDefect === defect;
            return (
              <TouchableOpacity
                key={defect}
                style={[styles.defectChip, isSel && styles.defectChipActive]}
                onPress={() => setSelectedDefect(defect)}
              >
                <Icon
                  name={isSel ? 'radiobox-marked' : 'radiobox-blank'}
                  size={16}
                  color={isSel ? '#b91c1c' : '#64748b'}
                />
                <Text style={[styles.defectText, isSel && styles.defectTextActive]}>{defect}</Text>
              </TouchableOpacity>
            );
          })}

          {/* Redirect Shop Picker */}
          {selectedVerdict !== 'CONDEMNATION_REQUEST' && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.label}>REDIRECT STOCK TO SHOP *</Text>
              <View style={styles.shopRow}>
                {REDIRECT_SHOPS.map(shop => {
                  const isSel = redirectShop === shop;
                  return (
                    <TouchableOpacity
                      key={shop}
                      style={[styles.shopChip, isSel && styles.shopChipActive]}
                      onPress={() => setRedirectShop(shop)}
                    >
                      <Text style={[styles.shopChipText, isSel && styles.shopChipTextActive]}>{shop}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Photo Proof Attachment */}
          <View style={styles.photoRow}>
            <TouchableOpacity style={styles.photoBtn} onPress={handleSimulatePhoto}>
              <Icon name="camera-outline" size={18} color="#0f172a" />
              <Text style={styles.photoBtnText}>ATTACH DEFECT PHOTO ({photoCount})</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Inspection Remarks */}
      <Text style={styles.sectionTitle}>INSPECTOR NOTES & SIGN-OFF</Text>
      <TextInput
        style={styles.remarksInput}
        multiline
        numberOfLines={3}
        placeholder="Enter technical measurements, gauge readings, or specific snag items..."
        placeholderTextColor="#94a3b8"
        value={remarks}
        onChangeText={setRemarks}
      />

      {/* Submit Button */}
      <TouchableOpacity 
        style={[
          styles.submitBtn,
          selectedVerdict === 'FIT' ? styles.submitFit :
          selectedVerdict === 'MINOR_FIX' ? styles.submitMinor :
          selectedVerdict === 'NOT_FIT' ? styles.submitNotFit : styles.submitCondemn
        ]}
        onPress={handleSubmit}
      >
        <Icon name="shield-check" size={20} color="#FFFFFF" />
        <Text style={styles.submitBtnText}>
          SUBMIT VERDICT: {selectedVerdict}
        </Text>
      </TouchableOpacity>
      <View style={{ height: 36 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: { alignItems: 'center', justifyContent: 'center', padding: 48 },
  loadingText: { marginTop: 16, color: '#64748b', fontSize: 14, fontWeight: '600' },
  contextCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  contextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  contextLabel: { fontSize: 11, color: '#64748b', fontWeight: '700', textTransform: 'uppercase' },
  contextValue: { fontSize: 12, fontWeight: 'bold', color: '#0f172a' },
  assetNumber: { fontSize: 22, fontWeight: '900', color: '#0A74DA', marginTop: 2 },
  sectionTitle: { fontSize: 12, color: '#475569', fontWeight: '800', marginBottom: 8, marginTop: 4, letterSpacing: 0.3 },
  verdictGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 14 },
  verdictBtn: {
    width: '48%',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  verdictBtnActive: {
    borderColor: '#0f172a',
    transform: [{ scale: 1.02 }],
  },
  fitBtn: { backgroundColor: '#059669' },
  minorBtn: { backgroundColor: '#d97706' },
  notFitBtn: { backgroundColor: '#dc2626' },
  condemnBtn: { backgroundColor: '#1e293b' },
  verdictText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13, marginTop: 4 },
  verdictSubText: { color: 'rgba(255,255,255,0.8)', fontSize: 10, marginTop: 2 },
  defectContainer: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  defectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  defectChipActive: {
    borderColor: '#b91c1c',
    backgroundColor: '#ffe4e6',
  },
  defectText: { fontSize: 12, color: '#334155', flex: 1 },
  defectTextActive: { color: '#b91c1c', fontWeight: 'bold' },
  label: { fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 6 },
  shopRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  shopChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  shopChipActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  shopChipText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  shopChipTextActive: { color: '#FFFFFF' },
  photoRow: { marginTop: 6 },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 10,
    borderRadius: 6,
  },
  photoBtnText: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
  remarksInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 16,
    fontSize: 13,
    color: '#0f172a',
  },
  submitBtn: {
    padding: 16,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  submitFit: { backgroundColor: '#059669' },
  submitMinor: { backgroundColor: '#d97706' },
  submitNotFit: { backgroundColor: '#dc2626' },
  submitCondemn: { backgroundColor: '#1e293b' },
  submitBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14, letterSpacing: 0.4 },
});
