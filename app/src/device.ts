import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'dompetku_device_token';

export function getDeviceId(): string {
  if (Platform.OS === 'android') {
    try {
      const androidId = Application.getAndroidId();
      if (androidId) return `android-${androidId}`;
    } catch {
      // abaikan, pakai fallback di bawah
    }
  }
  return 'unknown-device';
}

function makeToken(): string {
  const c = Crypto as unknown as { randomUUID?: () => string };
  if (typeof c.randomUUID === 'function') return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = Math.floor(Math.random() * 16);
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Token rahasia per HP. Dibuat sekali, disimpan aman di perangkat,
 * dipakai sebagai bukti kepemilikan akun di backend.
 */
export async function getDeviceToken(): Promise<string> {
  try {
    let token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token) {
      token = makeToken();
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    }
    return token;
  } catch {
    return `fallback-${Date.now()}`;
  }
}
