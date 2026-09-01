import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../../context/AuthContext';
import { YardRepository } from '../../../database/v2/repositories/YardRepository';

export default function NSYInScreen({ navigation }: any) {
  const { employeeId, assignedLocationId } = useAuth();
  
  const [assetNumber, setAssetNumber] = useState('');
  const [category, setCategory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    if (!assetNumber.trim() || !category.trim()) {
      Alert.alert('Validation Error', 'Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      await YardRepository.recordArrival({
        assetNumber,
        category,
        userId: employeeId || 'UNKNOWN',
        photoCount: 0,
        assignedLocationId,
      });

      Alert.alert('Success', 'Asset arrival recorded offline.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      console.error('Record arrival error:', error);
      Alert.alert('Error', error?.message || 'Failed to record arrival.');
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
        <Text style={styles.headerTitle}>NEW NSY ENTRY</Text>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Asset Number *</Text>
        <TextInput
          style={styles.input}
          value={assetNumber}
          onChangeText={setAssetNumber}
          placeholder="e.g. FLAT-54321"
          autoCapitalize="characters"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Asset Category *</Text>
        <TextInput
          style={styles.input}
          value={category}
          onChangeText={setCategory}
          placeholder="e.g. WAGON"
          autoCapitalize="characters"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Arrival Details</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Optional remarks..."
          multiline
          numberOfLines={3}
        />
      </View>

      <TouchableOpacity 
        style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]} 
        onPress={handleSave}
        disabled={isSubmitting}
      >
        <Icon name="content-save" size={20} color="#FFFFFF" />
        <Text style={styles.submitBtnText}>{isSubmitting ? 'SAVING...' : 'SAVE ARRIVAL'}</Text>
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
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
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
    opacity: 0.7,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
