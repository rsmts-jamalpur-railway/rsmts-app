import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, SafeAreaView, ActivityIndicator, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../../context/AuthContext';
import { ExceptionRepository } from '../../../database/v2/repositories/ExceptionRepository';
import { withDatabase } from '@nozbe/watermelondb/DatabaseProvider';
import withObservables from '@nozbe/with-observables';
import { Q } from '@nozbe/watermelondb';
import Asset from '../../../database/v2/models/Asset';

const EXCEPTION_TYPES = [
  { label: 'Damage', value: 'DAMAGE', icon: 'alert-decagram-outline' },
  { label: 'Missing Parts', value: 'MISSING_PARTS', icon: 'puzzle-remove-outline' },
  { label: 'Condemnation Request', value: 'CONDEMNATION', icon: 'close-octagon-outline' },
  { label: 'Other', value: 'OTHER', icon: 'dots-horizontal-circle-outline' },
];

const SEVERITIES = [
  { label: 'Low', value: 'LOW', color: '#10b981', bg: '#ecfdf5' },
  { label: 'Medium', value: 'MEDIUM', color: '#f59e0b', bg: '#fffbeb' },
  { label: 'High', value: 'HIGH', color: '#d97706', bg: '#fef3c7' }, // Using amber for high
  { label: 'Critical', value: 'CRITICAL', color: '#ef4444', bg: '#fef2f2' },
];

function ReportExceptionScreenBase({ navigation, assets = [] }: any) {
  const { employeeId } = useAuth();

  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [type, setType] = useState('MISSING_PARTS');
  const [severity, setSeverity] = useState('HIGH');
  const [reason, setReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async () => {
    if (!selectedAssetId) {
      Alert.alert('Validation', 'Please select an asset.');
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Validation', 'Please provide a reason.');
      return;
    }
    if (reason.length < 10) {
      Alert.alert('Validation', 'Reason must be at least 10 characters.');
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
                {
                  text: 'OK', onPress: () => {
                    setSelectedAssetId('');
                    setReason('');
                  }
                }
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
        <ActivityIndicator size="large" color="#0f52ba" />
        <Text style={styles.loadingText}>Submitting Exception Report...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Sub-Header Navigation Bar */}
        <View style={styles.subHeader}>
          <View style={styles.subHeaderLeft}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Icon name="arrow-left" size={24} color="#131b2e" />
            </TouchableOpacity>
            <Text style={styles.subHeaderTitle}>REPORT EXCEPTION</Text>
          </View>
        </View>

        {/* Select Asset */}
        <View style={styles.fieldGroup}>
          <View style={styles.fieldHeader}>
            <Text style={styles.fieldTitle}>Select Asset <Text style={{ color: '#ba1a1a' }}>*</Text></Text>
            <Text style={styles.fieldOptional}>MANDATORY</Text>
          </View>
          {assets.length === 0 ? (
            <Text style={styles.emptyNote}>No active assets available in yard.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.assetGrid}>
              {assets.map((a: Asset) => {
                const isSelected = selectedAssetId === a.id;
                return (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.assetOption, isSelected && styles.assetOptionActive]}
                    onPress={() => setSelectedAssetId(a.id)}
                  >
                    <Text style={[styles.assetOptionId, isSelected && styles.assetOptionTextActive]}>{a.assetNumber}</Text>
                    <Text style={[styles.assetOptionStatus, isSelected && styles.assetOptionSubActive]}>{a.currentStatus.replace(/_/g, ' ')}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {selectedAssetId && (
            (() => {
              const selectedAsset = assets.find((a: Asset) => a.id === selectedAssetId);
              if (!selectedAsset) return null;
              return (
                <View style={{ marginTop: 12, padding: 12, backgroundColor: '#f2f3ff', borderRadius: 8, borderWidth: 1, borderColor: '#dae2fd' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#003c90', marginBottom: 4 }}>SELECTED ASSET DETAILS</Text>
                  <Text style={{ fontSize: 13, color: '#131b2e' }}>Category: {selectedAsset.assetCategory || 'WAGON'}</Text>
                  <Text style={{ fontSize: 13, color: '#131b2e' }}>Current Status: {selectedAsset.currentStatus}</Text>
                  <Text style={{ fontSize: 13, color: '#131b2e' }}>Location ID: {selectedAsset.currentLocationId}</Text>
                </View>
              );
            })()
          )}
        </View>

        {/* Exception Type */}
        <View style={styles.fieldGroup}>
          <View style={styles.fieldHeader}>
            <Text style={styles.fieldTitle}>Exception Type</Text>
            <Text style={styles.fieldOptional}>SELECT ONE</Text>
          </View>
          <View style={styles.typeGrid}>
            {EXCEPTION_TYPES.map(t => {
              const isSelected = type === t.value;
              return (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.typeBtn, isSelected && styles.typeBtnActive]}
                  onPress={() => setType(t.value)}
                >
                  {isSelected && <Icon name="check" size={16} color="#ffffff" style={{ marginRight: 4 }} />}
                  <Text style={[styles.typeBtnText, isSelected && styles.typeBtnTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Severity */}
        <View style={styles.fieldGroup}>
          <View style={styles.fieldHeader}>
            <Text style={styles.fieldTitle}>Severity</Text>
            <Text style={styles.fieldOptional}>IMPACT LEVEL</Text>
          </View>
          <View style={styles.severityGrid}>
            {SEVERITIES.map(s => {
              const isSelected = severity === s.value;
              return (
                <TouchableOpacity
                  key={s.value}
                  style={[
                    styles.severityBtn,
                    isSelected ? { backgroundColor: s.color, shadowColor: s.color, shadowOpacity: 0.4, shadowRadius: 4, elevation: 3 } : null
                  ]}
                  onPress={() => setSeverity(s.value)}
                >
                  <Text style={[styles.severityBtnText, isSelected && { color: '#ffffff', fontWeight: '800' }]}>{s.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Reason */}
        <View style={styles.fieldGroup}>
          <View style={styles.fieldHeader}>
            <Text style={styles.fieldTitle}>Reason / Details <Text style={{ color: '#ba1a1a' }}>*</Text></Text>
            <Text style={styles.fieldOptional}>FIELD NOTE</Text>
          </View>
          <TextInput
            style={styles.reasonInput}
            multiline
            numberOfLines={5}
            placeholder="Describe the issue, damage observed, or missing parts..."
            placeholderTextColor="#737784"
            value={reason}
            onChangeText={setReason}
            textAlignVertical="top"
          />
          <View style={styles.charCountRow}>
            <Text style={styles.charMinNote}>Minimum 10 characters recommended</Text>
            <Text style={styles.charCountText}>{reason.length}/500</Text>
          </View>
        </View>

        {/* Submit */}
        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
          <Icon name="flag" size={20} color="#ffffff" style={{ marginRight: 8 }} />
          <Text style={styles.submitText}>REPORT EXCEPTION</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const enhance = withObservables(['database'], ({ database }: any) => ({
  assets: database.collections.get('assets').query(Q.where('current_status', Q.notEq('EXCEPTION_LOGGED'))).observe()
}));

export default withDatabase(enhance(ReportExceptionScreenBase));

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1 },
  content: { padding: 16 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  loadingText: { marginTop: 16, color: '#434653', fontSize: 15, fontWeight: '600' },

  subHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  subHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f2f3ff', marginLeft: -8 },
  subHeaderTitle: { fontSize: 17, fontWeight: '800', color: '#131b2e', textTransform: 'uppercase', letterSpacing: 0.5 },

  calloutCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f2f3ff', padding: 12, borderRadius: 12, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  calloutLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  calloutIconBox: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#ffdada', alignItems: 'center', justifyContent: 'center' },
  calloutSuper: { fontSize: 11, fontWeight: '800', color: '#434653', textTransform: 'uppercase', letterSpacing: 0.8 },
  calloutTitle: { fontSize: 14, fontWeight: '700', color: '#131b2e' },
  formTag: { backgroundColor: '#dae2fd', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  formTagText: { fontSize: 11, fontWeight: '700', color: '#434653', fontFamily: 'monospace' },

  fieldGroup: { marginBottom: 24 },
  fieldHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  fieldTitle: { fontSize: 15, fontWeight: '700', color: '#131b2e' },
  fieldOptional: { fontSize: 11, fontWeight: '700', color: '#737784', letterSpacing: 0.8 },

  emptyNote: { fontSize: 13, color: '#737784', fontStyle: 'italic', paddingVertical: 8 },

  assetGrid: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
  assetOption: { backgroundColor: '#ffffff', borderWidth: 2, borderColor: 'transparent', borderRadius: 12, padding: 12, minWidth: 140, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  assetOptionActive: { borderColor: '#0f52ba', backgroundColor: '#f2f3ff' },
  assetOptionId: { fontSize: 16, fontWeight: '800', color: '#131b2e', marginBottom: 2 },
  assetOptionStatus: { fontSize: 11, fontWeight: '600', color: '#737784', textTransform: 'uppercase' },
  assetOptionTextActive: { color: '#003c90' },
  assetOptionSubActive: { color: '#003c90' },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeBtn: { height: 48, paddingHorizontal: 16, backgroundColor: '#ffffff', borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1, flexDirection: 'row', flexGrow: 1 },
  typeBtnActive: { backgroundColor: '#0f52ba' },
  typeBtnText: { fontSize: 15, fontWeight: '600', color: '#131b2e' },
  typeBtnTextActive: { color: '#ffffff' },

  severityGrid: { flexDirection: 'row', gap: 6 },
  severityBtn: { flex: 1, height: 48, backgroundColor: '#ffffff', borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  severityBtnText: { fontSize: 14, fontWeight: '600', color: '#131b2e' },

  reasonInput: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, minHeight: 120, fontSize: 14, color: '#131b2e', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  charCountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, marginTop: 8 },
  charMinNote: { fontSize: 11, color: '#737784' },
  charCountText: { fontSize: 11, color: '#737784', fontFamily: 'monospace' },

  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#b20033', height: 56, borderRadius: 12, shadowColor: '#b20033', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  submitText: { color: '#ffffff', fontWeight: '800', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 },
});
