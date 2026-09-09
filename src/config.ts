import { Platform } from 'react-native';

/**
 * Central configuration for RSMTS Mobile App.
 * In __DEV__ mode: points to local backend (emulator-safe addresses).
 * In production builds: points to the Railway-hosted backend.
 */

const DEV_BASE_URL =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3001/v1'   // Android Emulator loopback alias
    : 'http://127.0.0.1:3001/v1'; // iOS Simulator / physical dev host

const PROD_BASE_URL = 'https://rsmts-backend-production.up.railway.app/v1';

export const API_BASE_URL = __DEV__ ? DEV_BASE_URL : PROD_BASE_URL;

/**
 * Request timeout in milliseconds.
 * 30 s to accommodate Railway cold-start latency in production.
 */
export const API_TIMEOUT_MS = 30_000;
