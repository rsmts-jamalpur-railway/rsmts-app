import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { syncDatabase } from '../services/sync';
import { withDatabase } from '@nozbe/watermelondb/DatabaseProvider';
import withObservables from '@nozbe/with-observables';

interface HeaderProps {
  onSync?: () => void;
  logs?: any[];
}

function HeaderBase({ onSync, logs = [] }: HeaderProps) {
  const insets = useSafeAreaInsets();
  const { role, employeeId, assignedLocationId, logout } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);

  const pendingChanges = logs.filter(log => log.syncStatus !== 'synced').length;

  const handleSync = async () => {
    if (onSync) {
      onSync();
      return;
    }
    
    setIsSyncing(true);
    try {
      await syncDatabase();
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

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.topRow}>
        <Text style={styles.brandText}>RSMTS</Text>
        
        <View style={styles.rightControls}>
          <TouchableOpacity style={styles.syncContainer} onPress={handleSync} disabled={isSyncing}>
            {isSyncing ? (
              <ActivityIndicator size="small" color="#0A74DA" />
            ) : (
              <View style={[styles.statusDot, { backgroundColor: pendingChanges > 0 ? '#f59e0b' : '#22c55e' }]} />
            )}
            <Text style={styles.syncText}>
              {isSyncing ? 'Syncing...' : (pendingChanges > 0 ? `${pendingChanges} Pending` : 'Synced')}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={handleLogout} style={{ marginLeft: 12 }}>
            <Icon name="logout" size={24} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.locationText}>{assignedLocationId || 'Unknown Location'}</Text>
      
      <View style={styles.divider} />

      <View style={styles.userRow}>
        <Text style={styles.roleText}>{role ? role.replace('_', ' ') : 'UNKNOWN ROLE'}</Text>
        <Text style={styles.employeeText}>{employeeId || 'Unknown EMP'}</Text>
      </View>
    </View>
  );
}

const enhance = withObservables(['database'], ({ database }: any) => ({
  logs: database.collections.get('movement_logs').query().observe(), // We might need sync_operations later
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
  }
});
