import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { SyncEngine } from '../database/v2/sync';
import { io, Socket } from 'socket.io-client';
import Toast from 'react-native-toast-message';
import { API_BASE_URL } from '../config';

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
        Toast.hide(); // Hide any offline toasts if we are back online
        triggerSync();
      } else if (state.isConnected === false) {
        Toast.show({
          type: 'error',
          text1: 'No Internet Connection',
          text2: 'Real-time updates are paused. You are working offline.',
          position: 'top',
          autoHide: false, // Keep it showing until internet returns
        });
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

    // Socket.IO for real-time sync
    const socket = io(API_BASE_URL);
    socket.on('connect', () => {
      console.log('Socket connected for real-time sync.');
    });
    
    socket.on('sync_event', (payload) => {
      console.log('Received real-time sync event:', payload);
      triggerSync(); // Pings the backend immediately
    });

    return () => {
      unsubscribeNet();
      unsubscribeApp.remove();
      socket.disconnect();
    };
  }, []);
}
