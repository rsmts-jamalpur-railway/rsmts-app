import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { SyncEngine } from '../database/v2/sync';

export function useNetworkSync() {
  const isSyncing = useRef(false);

  useEffect(() => {
    const triggerSync = async () => {
      if (isSyncing.current) return;
      const state = await NetInfo.fetch();
      // Ensure we sync on both WiFi and cellular (mobile network)
      if (state.isConnected && state.isInternetReachable !== false) {
        console.log(`Network connected (${state.type}), triggering background sync...`);
        isSyncing.current = true;
        try {
          await SyncEngine.sync();
        } catch (e) {
          console.error('Auto-sync failed:', e);
        } finally {
          isSyncing.current = false;
        }
      }
    };

    // Trigger on network state change
    const unsubscribeNet = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable !== false) {
        triggerSync();
      }
    });

    // Trigger on app foregrounding
    const unsubscribeApp = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        triggerSync();
      }
    });

    // Initial check
    triggerSync();

    return () => {
      unsubscribeNet();
      unsubscribeApp.remove();
    };
  }, []);
}
