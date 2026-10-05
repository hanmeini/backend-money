import { registerWebModule, NativeModule } from 'expo';

// SmsReceiverModule is not available on the web platform.
class SmsReceiverModule extends NativeModule<{}> {
  setConfig(): void {}
  getPendingMessages(): string {
    return '[]';
  }
  clearPendingMessages(): void {}
}

export default registerWebModule(SmsReceiverModule, 'SmsReceiverModule');
