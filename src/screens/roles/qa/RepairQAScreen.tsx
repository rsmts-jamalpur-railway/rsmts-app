import React from 'react';
import { View, StyleSheet, Alert, SafeAreaView } from 'react-native';
import Header from '../../../components/Header';
import SharedQAForm, { QAVerdict } from './SharedQAForm';
import { QARepository } from '../../../database/v2/repositories/QARepository';
import { useAuth } from '../../../context/AuthContext';

export default function RepairQAScreen({ route, navigation }: any) {
  const { userId, employeeId } = useAuth();
  const { assetId, assetNumber, cycleId } = route.params;

  const handleSubmit = async (verdict: QAVerdict, remarks: string) => {
    try {
      await QARepository.submitInspection({
        assetId,
        repairCycleId: cycleId,
        result: verdict,
        remarks,
        userId: employeeId || userId || 'offline-user'
      });
      Alert.alert('Success', 'Inspection submitted successfully', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit inspection');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="REPAIR QA" onBack={() => navigation.goBack()} />
      <View style={styles.container}>
        <SharedQAForm 
          assetNumber={assetNumber}
          sourceContext="Repair Cycle"
          sourceId={cycleId}
          onSubmit={handleSubmit}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, backgroundColor: '#FFFFFF' },
});
