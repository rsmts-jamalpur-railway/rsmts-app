import axios from 'axios';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://127.0.0.1:3001/v1'; // Localhost via adb reverse

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
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

// Response Interceptor: Handle Sync Conflicts globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;

      // Handle State Machine Conflict / Validation Error (Offline Sync Queue)
      if (status === 400 && data?.message?.includes('Invalid state transition')) {
        console.error('SYNC CONFLICT DETECTED:', data.message);
        // This is where WatermelonDB would flag the record as 'SyncError' 
        // instead of throwing a fatal error.
      }

      // Handle Unauthorized
      if (status === 401) {
        Alert.alert('Session Expired', 'Please login again.');
        // Trigger logout event
      }
    }

    return Promise.reject(error);
  }
);

export default api;
