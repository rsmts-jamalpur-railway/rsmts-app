import axios from 'axios';
import { Alert, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, API_TIMEOUT_MS } from '../../config';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  },
});

// Request Interceptor: Attach JWT Token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('@Auth:token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error fetching token for request', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle errors globally
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response) {
      const { status, data } = error.response;

      // Handle State Machine Conflict / Validation Error (Offline Sync Queue)
      if (status === 400 && data?.message?.includes('Invalid state transition')) {
        console.error('SYNC CONFLICT DETECTED:', data.message);
      }

      // Handle Unauthorized — clear session and force re-login
      if (status === 401) {
        // Clear all stored auth keys individually (multiRemove not available in all versions)
        await AsyncStorage.removeItem('@Auth:token');
        await AsyncStorage.removeItem('@Auth:role');
        await AsyncStorage.removeItem('@Auth:roles');
        await AsyncStorage.removeItem('@Auth:userId');
        await AsyncStorage.removeItem('@Auth:employeeId');
        await AsyncStorage.removeItem('@Auth:userName');
        await AsyncStorage.removeItem('@Auth:assignedLocationId');
        await AsyncStorage.removeItem('@Auth:permissions');
        // Signal AuthContext to reset state (AuthContext listens for this event)
        DeviceEventEmitter.emit('AUTH_SESSION_EXPIRED');
        Alert.alert('Session Expired', 'Please log in again.');
      }
    }

    return Promise.reject(error);
  }
);

export default api;
