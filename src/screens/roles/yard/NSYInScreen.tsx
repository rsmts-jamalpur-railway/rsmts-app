import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../../context/AuthContext';
import { YardRepository } from '../../../database/v2/repositories/YardRepository';
import { ASSET_CATEGORIES, validateAssetNumber, detectAssetCategory, decodeWagonNumber } from '../../../utils/assetValidation';

const RAILWAY_ZONES = [
  { code: 'ER', name: 'Eastern (ER)' },
  { code: 'ECR', name: 'East Central (ECR)' },
  { code: 'NR', name: 'Northern (NR)' },
  { code: 'SER', name: 'South Eastern (SER)' },
  { code: 'NCR', name: 'North Central (NCR)' },
  { code: 'CR', name: 'Central (CR)' },
  { code: 'WR', name: 'Western (WR)' },
  { code: 'SR', name: 'Southern (SR)' },
];

const TRACK_LINES = [
  'NSY Line 1',
  'NSY Line 2',
  'NSY Line 3',
  'NSY Line 4',
  'Trial Yard',
  'Line-01 (Inbound)',
  'Line-02 (Holding)',
  'Line-03 (Sorting)',
];

export default function NSYInScreen({ navigation }: any) {
  const { employeeId, assignedLocationId } = useAuth();
  
  const [assetNumber, setAssetNumber] = useState('');
  const [category, setCategory] = useState<'WAGON' | 'LOCO' | 'CRANE' | 'TOWER_CAR'>('WAGON');
  const [selectedRailway, setSelectedRailway] = useState('ER');
  const [selectedTrack, setSelectedTrack] = useState('NSY Line 1');
  const [rakeNumber, setRakeNumber] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validation = useMemo(() => {
    if (!assetNumber.trim()) return null;
    return validateAssetNumber(assetNumber, category);
  }, [assetNumber, category]);

  const wagonBreakdown = useMemo(() => {
    if (category === 'WAGON' && assetNumber.trim().length === 11) {
      return decodeWagonNumber(assetNumber.trim());
    }
    return null;
  }, [category, assetNumber]);

  const handleAssetChange = (text: string) => {
    const cleaned = text.trim();
    setAssetNumber(cleaned);
    
    if (!assetNumber && cleaned.length >= 3) {
      const detected = detectAssetCategory(cleaned);
      if (detected !== 'UNKNOWN' && detected !== category) {
        setCategory(detected);
      }
    }

    if (cleaned.length >= 4) {
      const rwCode = cleaned.substring(2, 4);
      if (rwCode === '02') setSelectedRailway('ER');
      else if (rwCode === '16') setSelectedRailway('ECR');
      else if (rwCode === '03') setSelectedRailway('NR');
      else if (rwCode === '08') setSelectedRailway('SER');
      else if (rwCode === '10') setSelectedRailway('NCR');
      else if (rwCode === '01') setSelectedRailway('CR');
      else if (rwCode === '09') setSelectedRailway('WR');
      else if (rwCode === '06') setSelectedRailway('SR');
    }
  };

  const applyAutoFix = (fix: string) => {
    setAssetNumber(fix);
  };

  const handleSave = async () => {
    if (!assetNumber.trim()) {
      Alert.alert('Validation Error', 'Please enter an asset number.');
      return;
    }

    if (validation && !validation.isValid) {
      Alert.alert('Invalid Asset Number', validation.message);
      return;
    }

    setIsSubmitting(true);
    try {
      const fullRemarks = [
        rakeNumber.trim() ? `Rake: ${rakeNumber.trim()}` : '',
        remarks.trim()
      ].filter(Boolean).join(' | ');

      await YardRepository.recordArrival({
        assetNumber: assetNumber.trim(),
        category,
        userId: employeeId || 'UNKNOWN',
        photoCount: 0,
        assignedLocationId,
        fromRailway: selectedRailway,
        trackLine: selectedTrack,
        remarks: fullRemarks,
      });

      Alert.alert('Success', `Asset ${assetNumber.trim()} arrival recorded at ${selectedTrack} (${selectedRailway}).`, [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      console.error('Record arrival error:', error);
      Alert.alert('Error', error?.message || 'Failed to record arrival.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentConfig = ASSET_CATEGORIES[category];

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{top:10,bottom:10,left:10,right:10}}>
            <Icon name="arrow-left" size={24} color="#131b2e" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>NSY INTAKE</Text>
          <View style={{width: 40}} />
        </View>

        <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          
          <View style={styles.bannerCard}>
            <View style={styles.bannerHeader}>
              <View style={styles.bannerHeaderLeft}>
                <Icon name="train-car" size={20} color="#003c90" />
                <Text style={styles.bannerTitle}>ROLLING STOCK REGISTRATION</Text>
              </View>
              <View style={styles.activeBadge}>
                <View style={styles.activeDot} />
                <Text style={styles.activeBadgeText}>Intake Mode</Text>
              </View>
            </View>
            <Text style={styles.bannerDesc}>Record arrival of rolling stock into NSY Yard limits. Assets will be available for allocation after successful intake.</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>ASSET CATEGORY</Text>
            <View style={styles.chipRow}>
              {(['WAGON', 'LOCO', 'CRANE', 'TOWER_CAR'] as const).map((cat) => {
                const config = ASSET_CATEGORIES[cat];
                const isSelected = category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                    onPress={() => setCategory(cat)}
                  >
                    <Icon
                      name={config.icon}
                      size={20}
                      color={isSelected ? '#0f52ba' : '#737784'}
                    />
                    <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}>
                      {config.label.split(' ')[0]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>ASSET NUMBER <Text style={styles.requiredAsterisk}>*</Text></Text>
            <View style={[
              styles.inputContainer,
              validation && (validation.isValid ? styles.inputValid : styles.inputInvalid)
            ]}>
              <TextInput
                style={styles.input}
                value={assetNumber}
                onChangeText={handleAssetChange}
                placeholder={currentConfig.placeholder}
                placeholderTextColor="#94a3b8"
                keyboardType={category === 'WAGON' || category === 'LOCO' || category === 'CRANE' ? 'numeric' : 'default'}
                autoCapitalize="characters"
              />
              {validation && (
                <Icon
                  name={validation.isValid ? 'check-circle' : 'alert-circle'}
                  size={24}
                  color={validation.isValid ? '#006a63' : '#ba1a1a'}
                  style={{marginRight: 16}}
                />
              )}
            </View>
            {validation && !validation.isValid && (
              <Text style={styles.errorText}>{validation.message}</Text>
            )}
            
            {validation?.autoFix && (
              <TouchableOpacity style={styles.autoFixBtn} onPress={() => applyAutoFix(validation.autoFix!)}>
                <Icon name="wand" size={16} color="#0f52ba" />
                <Text style={styles.autoFixText}>Use valid number: {validation.autoFix}</Text>
              </TouchableOpacity>
            )}
          </View>

          {wagonBreakdown && (
            <View style={styles.breakdownCard}>
              <View style={styles.breakdownHeader}>
                <Icon name="information" size={18} color="#0f52ba" />
                <Text style={styles.breakdownTitle}>Wagon Specifications</Text>
              </View>
              <View style={styles.breakdownGrid}>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>TYPE</Text>
                  <Text style={styles.breakdownValue}>{wagonBreakdown.typeName}</Text>
                </View>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>ZONE</Text>
                  <Text style={styles.breakdownValue}>{wagonBreakdown.railwayName}</Text>
                </View>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>YEAR</Text>
                  <Text style={styles.breakdownValue}>{wagonBreakdown.manufactureYear}</Text>
                </View>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>S/N</Text>
                  <Text style={styles.breakdownValue}>#{wagonBreakdown.serialNumber}</Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.formGroup}>
            <Text style={styles.label}>OWNING RAILWAY ZONE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll} contentContainerStyle={{gap: 8}}>
              {RAILWAY_ZONES.map((rz) => {
                const isSelected = selectedRailway === rz.code;
                return (
                  <TouchableOpacity
                    key={rz.code}
                    style={[styles.railwayChip, isSelected && styles.railwayChipActive]}
                    onPress={() => setSelectedRailway(rz.code)}
                  >
                    <Text style={[styles.railwayCode, isSelected && styles.railwayTextActive]}>{rz.code}</Text>
                    <Text style={[styles.railwayName, isSelected && styles.railwayTextActive]}>{rz.name.split(' ')[0]}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>INTAKE TRACK / LINE <Text style={styles.requiredAsterisk}>*</Text></Text>
            <View style={styles.trackGrid}>
              {TRACK_LINES.map((track) => {
                const isSelected = selectedTrack === track;
                return (
                  <TouchableOpacity
                    key={track}
                    style={[styles.trackChip, isSelected && styles.trackChipActive]}
                    onPress={() => setSelectedTrack(track)}
                  >
                    <Icon name="railroad-light" size={18} color={isSelected ? '#006a63' : '#737784'} />
                    <Text style={[styles.trackChipText, isSelected && styles.trackChipTextActive]}>{track}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>INBOUND RAKE / TRAIN NUMBER</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="e.g. RAKE-ECR-9021 / TR-13401"
                placeholderTextColor="#94a3b8"
                value={rakeNumber}
                onChangeText={setRakeNumber}
                autoCapitalize="characters"
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>INTAKE NOTES & CONDITION</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Physical damage notes, load condition..."
                placeholderTextColor="#94a3b8"
                value={remarks}
                onChangeText={setRemarks}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.submitBtn, (isSubmitting || (validation && !validation.isValid)) && styles.submitBtnDisabled]} 
            onPress={handleSave}
            disabled={isSubmitting || (validation ? !validation.isValid : false)}
            activeOpacity={0.8}
          >
            <Icon name="arrow-down-box" size={24} color="#ffffff" />
            <Text style={styles.submitBtnText}>{isSubmitting ? 'RECORDING...' : 'REGISTER INBOUND ASSET'}</Text>
          </TouchableOpacity>
          <View style={{height: 40}} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 20 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#131b2e', letterSpacing: -0.5 },
  
  container: { flex: 1 },
  content: { padding: 16 },

  bannerCard: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginBottom: 24, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  bannerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  bannerHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bannerTitle: { fontSize: 11, fontWeight: '700', color: '#737784', letterSpacing: 0.5 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ccfbf1', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#006a63' },
  activeBadgeText: { fontSize: 10, fontWeight: '700', color: '#006f67', textTransform: 'uppercase' },
  bannerDesc: { fontSize: 13, color: '#434653', lineHeight: 20 },

  formGroup: { marginBottom: 24 },
  label: { fontSize: 11, fontWeight: '700', color: '#737784', letterSpacing: 0.5, marginBottom: 8 },
  requiredAsterisk: { color: '#ba1a1a' },

  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, flex: 1, minWidth: '45%' },
  categoryChipActive: { backgroundColor: '#f2f3ff', borderColor: '#0f52ba' },
  categoryChipText: { fontSize: 14, fontWeight: '600', color: '#434653' },
  categoryChipTextActive: { color: '#0f52ba' },

  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, overflow: 'hidden' },
  inputValid: { borderColor: '#006a63', backgroundColor: '#f0fdfa' },
  inputInvalid: { borderColor: '#ba1a1a', backgroundColor: '#fffbfa' },
  input: { flex: 1, fontSize: 16, color: '#131b2e', padding: 16 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  
  errorText: { color: '#ba1a1a', fontSize: 12, marginTop: 4, fontWeight: '500' },
  autoFixBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f2f3ff', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginTop: 8 },
  autoFixText: { fontSize: 12, fontWeight: '600', color: '#0f52ba' },

  breakdownCard: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 16, marginBottom: 24 },
  breakdownHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  breakdownTitle: { fontSize: 13, fontWeight: '700', color: '#0f52ba', letterSpacing: 0.5, textTransform: 'uppercase' },
  breakdownGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  breakdownItem: { width: '45%' },
  breakdownLabel: { fontSize: 10, fontWeight: '700', color: '#737784', letterSpacing: 0.5, marginBottom: 2 },
  breakdownValue: { fontSize: 14, fontWeight: '600', color: '#131b2e' },

  horizontalScroll: { overflow: 'visible' },
  railwayRow: { flexDirection: 'row', gap: 8 },
  railwayChip: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center', minWidth: 80 },
  railwayChipActive: { backgroundColor: '#131b2e', borderColor: '#131b2e' },
  railwayCode: { fontSize: 14, fontWeight: '700', color: '#131b2e', marginBottom: 2 },
  railwayName: { fontSize: 10, color: '#737784', fontWeight: '500' },
  railwayTextActive: { color: '#ffffff' },

  trackGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  trackChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, minWidth: '45%', flex: 1 },
  trackChipActive: { backgroundColor: '#ccfbf1', borderColor: '#006a63' },
  trackChipText: { fontSize: 13, fontWeight: '600', color: '#434653' },
  trackChipTextActive: { color: '#006a63' },

  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#0f52ba', borderRadius: 12, paddingVertical: 16, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  submitBtnDisabled: { backgroundColor: '#94a3b8' },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#ffffff', letterSpacing: 0.5 },
});
