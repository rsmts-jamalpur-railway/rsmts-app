import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { SyncEngine } from '../database/v2/sync';
import { withDatabase } from '@nozbe/watermelondb/DatabaseProvider';
import withObservables from '@nozbe/with-observables';

import { Q } from '@nozbe/watermelondb';

interface HeaderProps {
  title?: string;
  onBack?: () => void;
  onSync?: () => void;
  pendingOperations?: any[];
}

function HeaderBase({ title, onBack, onSync, pendingOperations = [] }: HeaderProps) {
  const insets = useSafeAreaInsets();
  const { role, roles, employeeId, assignedLocationId, logout, switchRole } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);

  const pendingCount = pendingOperations.length;
  const isSuperUser = roles?.includes('SYSTEM_ADMIN') || roles?.includes('MANAGEMENT') || role === 'SYSTEM_ADMIN' || role === 'MANAGEMENT';

  const handleSync = async () => {
    if (onSync) {
      onSync();
      return;
    }
    
    setIsSyncing(true);
    try {
      await SyncEngine.sync();
      Alert.alert('Success', 'Data synchronized successfully.');
    } catch (error: any) {
      console.error('Sync error:', error);
      Alert.alert('Sync Failed', error?.message || 'Check your connection and try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout }
    ]);
  };

  const openRoleSwitcher = () => {
    Alert.alert(
      'Switch Operational Role',
      'Select a role to simulate or switch views:',
      [
        { text: 'Yard Controller', onPress: () => switchRole('YARD_CONTROLLER') },
        { text: 'Repair Supervisor', onPress: () => switchRole('REPAIR_SUPERVISOR') },
        { text: 'Mfg Supervisor', onPress: () => switchRole('MANUFACTURING_SUPERVISOR') },
        { text: 'QA Inspector', onPress: () => switchRole('QA_INSPECTOR') },
        { text: 'System Admin (God Mode)', onPress: () => switchRole('SYSTEM_ADMIN') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  if (title) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
        <View style={styles.topRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {onBack && (
              <TouchableOpacity onPress={onBack} style={{ marginRight: 12, padding: 4 }}>
                <Icon name="arrow-left" size={24} color="#0f172a" />
              </TouchableOpacity>
            )}
            <Text style={styles.brandText}>{title}</Text>
          </View>
          <TouchableOpacity style={styles.syncContainer} onPress={handleSync} disabled={isSyncing}>
            {isSyncing ? (
              <ActivityIndicator size="small" color="#0A74DA" />
            ) : (
              <View style={[styles.statusDot, { backgroundColor: pendingCount > 0 ? '#f59e0b' : '#22c55e' }]} />
            )}
            <Text style={styles.syncText}>
              {isSyncing ? 'Syncing...' : (pendingCount > 0 ? `${pendingCount} Pending` : 'Synced')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.topRow}>
        <Text style={styles.brandText}>RSMTS</Text>
        
        <View style={styles.rightControls}>
          {isSuperUser && (
            <TouchableOpacity style={styles.switchRoleBtn} onPress={openRoleSwitcher}>
              <Icon name="account-switch" size={16} color="#0A74DA" />
              <Text style={styles.switchRoleText}>SWITCH ROLE</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.syncContainer} onPress={handleSync} disabled={isSyncing}>
            {isSyncing ? (
              <ActivityIndicator size="small" color="#0A74DA" />
            ) : (
              <View style={[styles.statusDot, { backgroundColor: pendingCount > 0 ? '#f59e0b' : '#22c55e' }]} />
            )}
            <Text style={styles.syncText}>
              {isSyncing ? 'Syncing...' : (pendingCount > 0 ? `${pendingCount} Pending` : 'Synced')}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={handleLogout} style={{ marginLeft: 12 }}>
            <Icon name="logout" size={22} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.locationText}>{assignedLocationId || 'Jamalpur Workshop'}</Text>
      
      <View style={styles.divider} />

      <View style={styles.userRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.roleText}>{role ? role.replace(/_/g, ' ') : 'UNKNOWN ROLE'}</Text>
          <Text style={styles.employeeText}>{employeeId || 'Unknown EMP'}</Text>
        </View>
      </View>
    </View>
  );
}

const enhance = withObservables(['database'], ({ database }: any) => ({
  pendingOperations: database.collections.get('sync_operations').query(
    Q.where('status', 'PENDING')
  ).observe(),
}));

export default withDatabase(enhance(HeaderBase));

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  brandText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.5,
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  syncText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  locationText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginBottom: 12,
  },
  userRow: {
    flexDirection: 'column',
  },
  roleText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  employeeText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  switchRoleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginRight: 8,
  },
  switchRoleText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0A74DA',
  },
});
