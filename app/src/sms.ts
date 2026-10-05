import { PermissionsAndroid, Platform } from 'react-native';
import SmsReceiverModule from '../modules/sms-receiver/src/SmsReceiverModule';
import { ingestSms, SmsPayload } from './api';

export type PendingSms = SmsPayload;

export async function ensureSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const result = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
    PermissionsAndroid.PERMISSIONS.READ_SMS,
  ]);
  return Object.values(result).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
}

export function configureSmsForwarder(backendUrl: string, deviceId: string): void {
  if (Platform.OS !== 'android') return;
  SmsReceiverModule.setConfig(backendUrl, deviceId);
}

export function readPendingQueue(): PendingSms[] {
  if (Platform.OS !== 'android') return [];
  try {
    const parsed: unknown = JSON.parse(SmsReceiverModule.getPendingMessages());
    return Array.isArray(parsed) ? (parsed as PendingSms[]) : [];
  } catch {
    return [];
  }
}

export async function flushPendingQueue(deviceId: string): Promise<number> {
  const pending = readPendingQueue();
  let sent = 0;
  for (const sms of pending) {
    try {
      await ingestSms(deviceId, sms);
      sent += 1;
    } catch {
      // biarkan di antrean, dicoba lagi lain waktu
      return sent;
    }
  }
  if (pending.length > 0) {
    try {
      SmsReceiverModule.clearPendingMessages();
    } catch {
      // abaikan
    }
  }
  return sent;
}
