import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { syncDatabase } from '../services/sync';
import { withDatabase } from '@nozbe/watermelondb/DatabaseProvider';
import withObservables from '@nozbe/with-observables';

interface HeaderProps {
  role: string;
  onSync?: () => void;
  logs?: any[];
}

function HeaderBase({ role, onSync, logs = [] }: HeaderProps) {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
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
      <View style={styles.profileSection}>
        <View style={styles.avatar}>
          <Icon name="account" size={24} color="#0A74DA" />
        </View>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.roleText}>{role.toUpperCase()}</Text>
        </View>
      </View>
      
      <View style={styles.actions}>
        <TouchableOpacity style={styles.iconBtn} onPress={handleSync} disabled={isSyncing}>
          {isSyncing ? (
            <ActivityIndicator size="small" color="#0A74DA" />
          ) : (
            <Icon name="sync" size={24} color={pendingChanges > 0 ? "#f59e0b" : "#64748b"} />
          )}
          {pendingChanges > 0 && !isSyncing && (
            <View style={styles.syncBadge}>
              <Text style={styles.syncBadgeText}>{pendingChanges}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn}>
          <Icon name="bell-outline" size={24} color="#64748b" />
          <View style={styles.badge} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={handleLogout} disabled={isSyncing}>
          <Icon name="logout" size={24} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const enhance = withObservables(['database'], ({ database }: any) => ({
  logs: database.collections.get('movement_logs').query().observe(),
}));

export default withDatabase(enhance(HeaderBase));

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    // Removed borderBottomWidth as requested
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  greeting: {
    color: '#64748b',
    fontSize: 10,
  },
  roleText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
  },
  iconBtn: {
    padding: 4,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  syncBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#f59e0b',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  syncBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  }
});
