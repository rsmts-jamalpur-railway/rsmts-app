import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import withObservables from '@nozbe/with-observables';
import { Q } from '@nozbe/watermelondb';
import { database } from '../../database/v2';
import QAInspection from '../../database/v2/models/QAInspection';
import FitCertificate from '../../database/v2/models/FitCertificate';
import Exception from '../../database/v2/models/Exception';
import Asset from '../../database/v2/models/Asset';
import { useAuth } from '../../context/AuthContext';

interface QADashboardProps {
  navigation: any;
  inspections: QAInspection[];
  fitCertificates: FitCertificate[];
  exceptions: Exception[];
  assets: Asset[];
}

function QADashboardComponent({
  navigation,
  inspections = [],
  fitCertificates = [],
  exceptions = [],
  assets = []
}: QADashboardProps) {
  const { employeeId, can } = useAuth();

  // Metrics
  const pendingRepairQACount = assets.filter(
    a => (a.currentStatus === 'PENDING_QA' || a.currentStatus === 'Pending QA') &&
         (a.currentLocationId.startsWith('WRS') || a.currentLocationId === 'DPS' || a.currentLocationId === 'YARD')
  ).length;

  const pendingMfgQACount = assets.filter(
    a => (a.currentStatus === 'PENDING_QA' || a.currentStatus === 'Pending QA') &&
         (a.currentLocationId === 'GIF' || a.currentLocationId.includes('MFG') || a.currentLocationId.includes('FORGE'))
  ).length;

  const totalFitCertificates = fitCertificates.length;
  const openExceptionsCount = exceptions.filter(e => e.status === 'OPEN').length;

  // Recent inspection records
  const recentInspections = inspections.slice(0, 5);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Top Officer Banner */}
      <View style={styles.banner}>
        <View>
          <Text style={styles.greeting}>CHIEF ROLLING STOCK INSPECTOR</Text>
          <Text style={styles.officerName}>
            Inspector: <Text style={styles.officerNameBold}>{employeeId || 'QA-INSP'}</Text>
          </Text>
        </View>
        <View style={styles.certBadge}>
          <Icon name="shield-check" size={14} color="#166534" />
          <Text style={styles.certBadgeText}>RDSO STANDARDS</Text>
        </View>
      </View>

      {/* Live Operational Metrics */}
      <Text style={styles.sectionTitle}>[ LIVE QUALITY ASSURANCE TELEMETRY ]</Text>
      <View style={styles.kpiRow}>
        <TouchableOpacity 
          style={[styles.kpiCard, styles.kpiRepair]} 
          onPress={() => navigation.navigate('QARepairListScreen')}
        >
          <View style={styles.kpiHeader}>
            <Icon name="clipboard-check-outline" size={20} color="#0284c7" />
            <Text style={styles.kpiLabel}>Pending Repair QA</Text>
          </View>
          <Text style={styles.kpiValue}>{pendingRepairQACount}</Text>
          <Text style={styles.kpiSub}>Overhaul completed</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.kpiCard, styles.kpiMfg]} 
          onPress={() => navigation.navigate('QAMfgListScreen')}
        >
          <View style={styles.kpiHeader}>
            <Icon name="factory" size={20} color="#059669" />
            <Text style={styles.kpiLabel}>Pending Mfg QA</Text>
          </View>
          <Text style={[styles.kpiValue, { color: '#059669' }]}>{pendingMfgQACount}</Text>
          <Text style={styles.kpiSub}>New components</Text>
        </TouchableOpacity>
      </View>
      
      <View style={[styles.kpiRow, { marginTop: 12 }]}>
        <View style={[styles.kpiCard, styles.kpiFit]}>
          <View style={styles.kpiHeader}>
            <Icon name="certificate-outline" size={20} color="#16a34a" />
            <Text style={styles.kpiLabel}>Fit Certificates</Text>
          </View>
          <Text style={[styles.kpiValue, { color: '#16a34a' }]}>{totalFitCertificates}</Text>
          <Text style={styles.kpiSub}>Certified fit for dispatch</Text>
        </View>

        <TouchableOpacity 
          style={[styles.kpiCard, styles.kpiException]} 
          onPress={() => navigation.navigate('ReportException')}
        >
          <View style={styles.kpiHeader}>
            <Icon name="alert-decagram-outline" size={20} color="#e11d48" />
            <Text style={styles.kpiLabel}>Open Exceptions</Text>
          </View>
          <Text style={[styles.kpiValue, { color: '#e11d48' }]}>{openExceptionsCount}</Text>
          <Text style={styles.kpiSub}>Unresolved defects</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>INSPECTOR WORKBENCH</Text>
      <View style={styles.actionGrid}>
        {can('qa:inspect') && (
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: '#0284c7' }]} 
            onPress={() => navigation.navigate('QARepairListScreen')}
          >
            <Icon name="clipboard-check" size={22} color="#FFFFFF" />
            <View>
              <Text style={styles.actionText}>INSPECT REPAIR OVERHAULS</Text>
              <Text style={styles.actionDesc}>Check POH/ROH clearance & brake tests</Text>
            </View>
          </TouchableOpacity>
        )}
        
        {can('qa:inspect') && (
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: '#059669' }]} 
            onPress={() => navigation.navigate('QAMfgListScreen')}
          >
            <Icon name="shield-check" size={22} color="#FFFFFF" />
            <View>
              <Text style={styles.actionText}>INSPECT MANUFACTURED STOCK</Text>
              <Text style={styles.actionDesc}>Dimension, weld integrity & ultrasonic tests</Text>
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          style={[styles.actionBtn, { backgroundColor: '#e11d48' }]} 
          onPress={() => navigation.navigate('ReportException')}
        >
          <Icon name="alert-octagon" size={22} color="#FFFFFF" />
          <View>
            <Text style={styles.actionText}>LOG QA DEFECT / CONDEMNATION</Text>
            <Text style={styles.actionDesc}>Submit condemnation request to Admin</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Recent Inspection Verdicts */}
      <Text style={styles.sectionTitle}>RECENT INSPECTION VERDICTS</Text>
      {recentInspections.length === 0 ? (
        <View style={styles.emptyState}>
          <Icon name="shield-outline" size={32} color="#cbd5e1" />
          <Text style={styles.emptyText}>No inspection verdicts recorded offline yet.</Text>
        </View>
      ) : (
        <View style={styles.logCard}>
          {recentInspections.map((insp, index) => (
            <View key={insp.id} style={[styles.logItem, index !== recentInspections.length - 1 && styles.logItemBorder]}>
              <View style={styles.logIconCol}>
                <Icon
                  name={
                    insp.verdict === 'FIT' ? 'check-circle' :
                    insp.verdict === 'MINOR_FIX' ? 'alert-circle' :
                    insp.verdict === 'NOT_FIT' ? 'close-circle' : 'skull-crossbones'
                  }
                  size={20}
                  color={
                    insp.verdict === 'FIT' ? '#16a34a' :
                    insp.verdict === 'MINOR_FIX' ? '#d97706' :
                    insp.verdict === 'NOT_FIT' ? '#ef4444' : '#1e293b'
                  }
                />
              </View>
              <View style={styles.logContent}>
                <View style={styles.logRow}>
                  <Text style={styles.logStatus}>VERDICT: {insp.verdict}</Text>
                  <Text style={styles.logTime}>
                    {new Date(insp.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <Text style={styles.logRemarks} numberOfLines={1}>
                  {insp.remarks || 'No remarks entered'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const enhance = withObservables([], () => ({
  inspections: database.collections.get<QAInspection>('qa_inspections')
    .query(Q.sortBy('created_at', Q.desc), Q.take(10))
    .observe(),
  fitCertificates: database.collections.get<FitCertificate>('fit_certificates').query().observe(),
  exceptions: database.collections.get<Exception>('exceptions').query().observe(),
  assets: database.collections.get<Asset>('assets').query().observe(),
}));

export default enhance(QADashboardComponent);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  banner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  greeting: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  officerName: {
    fontSize: 13,
    color: '#334155',
    marginTop: 2,
  },
  officerNameBold: {
    fontWeight: '700',
    color: '#0f172a',
  },
  certBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  certBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 10,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  kpiRepair: { borderLeftWidth: 4, borderLeftColor: '#0284c7' },
  kpiMfg: { borderLeftWidth: 4, borderLeftColor: '#10b981' },
  kpiFit: { borderLeftWidth: 4, borderLeftColor: '#16a34a' },
  kpiException: { borderLeftWidth: 4, borderLeftColor: '#e11d48' },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  kpiLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  kpiSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  actionGrid: {
    gap: 10,
    marginBottom: 16,
  },
  actionBtn: {
    padding: 14,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    elevation: 1,
  },
  actionText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  actionDesc: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    marginTop: 2,
  },
  logCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  logItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  logIconCol: {
    marginRight: 10,
  },
  logContent: {
    flex: 1,
  },
  logRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logStatus: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  logTime: {
    fontSize: 11,
    color: '#94a3b8',
  },
  logRemarks: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 6,
    fontStyle: 'italic',
  }
});
