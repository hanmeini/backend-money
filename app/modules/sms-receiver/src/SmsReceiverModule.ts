import { NativeModule, requireNativeModule } from 'expo';

declare class SmsReceiverModule extends NativeModule<{}> {
  setConfig(backendUrl: string, deviceId: string): void;
  getPendingMessages(): string;
  clearPendingMessages(): void;
}

export default requireNativeModule<SmsReceiverModule>('SmsReceiver');
