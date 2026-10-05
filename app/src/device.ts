import { Platform } from 'react-native';
import * as Application from 'expo-application';

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
