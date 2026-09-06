import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../../context/AuthContext';
import { YardRepository } from '../../../database/v2/repositories/YardRepository';
import { ASSET_CATEGORIES, validateAssetNumber, detectAssetCategory, decodeWagonNumber } from '../../../utils/assetValidation';

const RAILWAY_ZONES = [
  { code: 'ER', name: 'Eastern (ER - Jamalpur)' },
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

  // Real-time validation computation
  const validation = useMemo(() => {
    if (!assetNumber.trim()) return null;
    return validateAssetNumber(assetNumber, category);
  }, [assetNumber, category]);

  // Decode wagon if available
  const wagonBreakdown = useMemo(() => {
    if (category === 'WAGON' && assetNumber.trim().length === 11) {
      return decodeWagonNumber(assetNumber.trim());
    }
    return null;
  }, [category, assetNumber]);

  const handleAssetChange = (text: string) => {
    const cleaned = text.trim();
    setAssetNumber(cleaned);
    
    // Auto-detect category if user types a pattern
    if (!assetNumber && cleaned.length >= 3) {
      const detected = detectAssetCategory(cleaned);
      if (detected !== 'UNKNOWN' && detected !== category) {
        setCategory(detected);
      }
    }

    // Auto-detect railway zone from 11-digit wagon if applicable
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
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>NEW NSY INTAKE</Text>
      </View>

      {/* Category Selection Chips */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Rolling Stock Category *</Text>
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
                  size={18}
                  color={isSelected ? '#FFFFFF' : '#475569'}
                />
                <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}>
                  {config.label.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.categoryDesc}>{currentConfig.description}</Text>
      </View>

      {/* Asset Number Input */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Asset Number *</Text>
        <TextInput
          style={[
            styles.input,
            validation && (validation.isValid ? styles.inputValid : styles.inputInvalid)
          ]}
          value={assetNumber}
          onChangeText={handleAssetChange}
          placeholder={currentConfig.placeholder}
          keyboardType={category === 'WAGON' || category === 'LOCO' || category === 'CRANE' ? 'numeric' : 'default'}
          autoCapitalize="characters"
        />

        {/* Validation Status Message */}
        {validation && (
          <View style={[styles.valBadge, validation.isValid ? styles.valBadgeSuccess : styles.valBadgeError]}>
            <Icon
              name={validation.isValid ? 'check-circle' : 'alert-circle'}
              size={16}
              color={validation.isValid ? '#059669' : '#dc2626'}
            />
            <Text style={[styles.valText, validation.isValid ? styles.valTextSuccess : styles.valTextError]}>
              {validation.message}
            </Text>
          </View>
        )}

        {/* Auto-fix Suggestion */}
        {validation?.autoFix && (
          <TouchableOpacity
            style={styles.autoFixBtn}
            onPress={() => applyAutoFix(validation.autoFix!)}
          >
            <Icon name="wand" size={16} color="#1d4ed8" />
            <Text style={styles.autoFixText}>Use valid number: {validation.autoFix}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Decoded Wagon Metadata Card */}
      {wagonBreakdown && (
        <View style={styles.breakdownCard}>
          <View style={styles.breakdownHeader}>
            <Icon name="train-car" size={20} color="#0369a1" />
            <Text style={styles.breakdownTitle}>Indian Railways Wagon Specifications</Text>
          </View>
          <View style={styles.breakdownGrid}>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>WAGON TYPE</Text>
              <Text style={styles.breakdownValue}>{wagonBreakdown.typeName}</Text>
            </View>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>OWNING ZONE</Text>
              <Text style={styles.breakdownValue}>{wagonBreakdown.railwayName}</Text>
            </View>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>MANUFACTURE YEAR</Text>
              <Text style={styles.breakdownValue}>{wagonBreakdown.manufactureYear}</Text>
            </View>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>SERIAL NUMBER</Text>
              <Text style={styles.breakdownValue}>#{wagonBreakdown.serialNumber}</Text>
            </View>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>CHECK DIGIT</Text>
              <Text style={[
                styles.breakdownValue, 
                { color: wagonBreakdown.isValidCheckDigit ? '#059669' : '#dc2626', fontWeight: 'bold' }
              ]}>
                {wagonBreakdown.enteredCheckDigit} {wagonBreakdown.isValidCheckDigit ? '(Valid ✓)' : `(Expected: ${wagonBreakdown.calculatedCheckDigit})`}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Owning Railway Zone Picker */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Owning Railway Zone *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
          <View style={styles.railwayRow}>
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
          </View>
        </ScrollView>
      </View>

      {/* Track Line Intake Picker */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Intake Track / Line *</Text>
        <View style={styles.trackGrid}>
          {TRACK_LINES.map((track) => {
            const isSelected = selectedTrack === track;
            return (
              <TouchableOpacity
                key={track}
                style={[styles.trackChip, isSelected && styles.trackChipActive]}
                onPress={() => setSelectedTrack(track)}
              >
                <Icon
                  name="railroad-light"
                  size={16}
                  color={isSelected ? '#FFFFFF' : '#475569'}
                />
                <Text style={[styles.trackChipText, isSelected && styles.trackChipTextActive]}>
                  {track}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Rake / Train Number */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Inbound Rake / Train Number (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. RAKE-ECR-9021 / TR-13401"
          placeholderTextColor="#94a3b8"
          value={rakeNumber}
          onChangeText={setRakeNumber}
          autoCapitalize="characters"
        />
      </View>

      {/* Remarks */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Intake Notes & Condition</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Physical damage notes, load condition, wheel defects..."
          placeholderTextColor="#94a3b8"
          value={remarks}
          onChangeText={setRemarks}
          multiline
          numberOfLines={3}
        />
      </View>

      {/* Submit Button */}
      <TouchableOpacity 
        style={[
          styles.submitBtn, 
          (isSubmitting || (validation && !validation.isValid)) && styles.submitBtnDisabled
        ]} 
        onPress={handleSave}
        disabled={isSubmitting || (validation ? !validation.isValid : false)}
      >
        <Icon name="content-save" size={20} color="#FFFFFF" />
        <Text style={styles.submitBtnText}>{isSubmitting ? 'RECORDING...' : 'RECORD NSY ARRIVAL (OFFLINE)'}</Text>
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
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    color: '#334155',
    marginBottom: 8,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
  },
  categoryChipActive: {
    backgroundColor: '#0A74DA',
    borderColor: '#0A74DA',
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  categoryDesc: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
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
  inputValid: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  inputInvalid: {
    borderColor: '#f87171',
    backgroundColor: '#fef2f2',
  },
  valBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    padding: 10,
    borderRadius: 6,
  },
  valBadgeSuccess: {
    backgroundColor: '#dcfce7',
  },
  valBadgeError: {
    backgroundColor: '#fee2e2',
  },
  valText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  valTextSuccess: {
    color: '#166534',
  },
  valTextError: {
    color: '#991b1b',
  },
  autoFixBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
  },
  autoFixText: {
    fontSize: 12,
    color: '#1d4ed8',
    fontWeight: '600',
  },
  breakdownCard: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 10,
    padding: 14,
    marginBottom: 18,
  },
  breakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0f2fe',
  },
  breakdownTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369a1',
  },
  breakdownGrid: {
    gap: 6,
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  breakdownValue: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '600',
  },
  horizontalScroll: {
    marginBottom: 4,
  },
  railwayRow: {
    flexDirection: 'row',
    gap: 8,
  },
  railwayChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 70,
  },
  railwayChipActive: {
    backgroundColor: '#0A74DA',
    borderColor: '#0A74DA',
  },
  railwayCode: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#334155',
  },
  railwayName: {
    fontSize: 10,
    color: '#64748b',
  },
  railwayTextActive: {
    color: '#FFFFFF',
  },
  trackGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  trackChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  trackChipActive: {
    backgroundColor: '#1e293b',
    borderColor: '#1e293b',
  },
  trackChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  trackChipTextActive: {
    color: '#FFFFFF',
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: '#0A74DA',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 36,
    gap: 8,
    elevation: 2,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  }
});
