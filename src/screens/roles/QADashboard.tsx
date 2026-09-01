import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../context/AuthContext';

export default function QADashboard({ navigation }: any) {
  const { employeeId, can } = useAuth();

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.greeting}>GOOD MORNING, {employeeId || 'EMP'}</Text>
      <Text style={styles.sectionTitle}>[ QUALITY ASSURANCE ]</Text>

      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Pending Repair QA</Text>
          <Text style={styles.kpiValue}>—</Text>
          <Text style={styles.kpiSub}>Data unavailable</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Pending Mfg QA</Text>
          <Text style={styles.kpiValue}>—</Text>
          <Text style={styles.kpiSub}>Data unavailable</Text>
        </View>
      </View>
      
      <View style={[styles.kpiRow, { marginTop: 12 }]}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Fit Certificates</Text>
          <Text style={styles.kpiValue}>—</Text>
          <Text style={styles.kpiSub}>Data unavailable</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Active Exceptions</Text>
          <Text style={styles.kpiValue}>—</Text>
          <Text style={styles.kpiSub}>Data unavailable</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
      <View style={styles.actionGrid}>
        {can('qa:inspect') && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('QARepairListScreen')}>
            <Icon name="clipboard-check-outline" size={24} color="#FFFFFF" />
            <Text style={styles.actionText}>VIEW REPAIR QA</Text>
          </TouchableOpacity>
        )}
        
        {can('qa:inspect') && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('QAMfgListScreen')}>
            <Icon name="shield-check-outline" size={24} color="#FFFFFF" />
            <Text style={styles.actionText}>VIEW MFG QA</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#ef4444' }]} onPress={() => navigation.navigate('ReportException')}>
          <Icon name="alert-circle-outline" size={24} color="#FFFFFF" />
          <Text style={styles.actionText}>REPORT EXCEPTION</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>Activity feed unavailable (Read API Missing)</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    padding: 16,
  },
  greeting: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 24,
    marginBottom: 12,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  kpiLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  kpiSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionBtn: {
    backgroundColor: '#0A74DA',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 140,
  },
  actionText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  emptyText: {
    color: '#94a3b8',
    fontStyle: 'italic',
  }
});
