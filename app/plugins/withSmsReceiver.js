const { withAndroidManifest } = require('expo/config-plugins');

const RECEIVER_NAME = 'expo.modules.smsreceiver.SmsReceiver';
const SMS_ACTION = 'android.provider.Telephony.SMS_RECEIVED';

function ensureUsesPermission(manifest, name) {
  const root = manifest.manifest;
  root['uses-permission'] = root['uses-permission'] || [];
  const exists = root['uses-permission'].some((p) => p.$ && p.$['android:name'] === name);
  if (!exists) {
    root['uses-permission'].push({ $: { 'android:name': name } });
  }
}

function ensureSmsReceiver(mainApplication) {
  mainApplication.receiver = mainApplication.receiver || [];
  const exists = mainApplication.receiver.some((r) => r.$ && r.$['android:name'] === RECEIVER_NAME);
  if (!exists) {
    mainApplication.receiver.push({
      $: {
        'android:name': RECEIVER_NAME,
        'android:enabled': 'true',
        'android:exported': 'true',
      },
      'intent-filter': [
        {
          action: [{ $: { 'android:name': SMS_ACTION } }],
        },
      ],
    });
  }
}

const withSmsReceiver = (config) =>
  withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    ensureUsesPermission(manifest, 'android.permission.RECEIVE_SMS');
    ensureUsesPermission(manifest, 'android.permission.READ_SMS');

    const mainApplication = manifest.manifest.application && manifest.manifest.application[0];
    if (mainApplication) {
      ensureSmsReceiver(mainApplication);
    }
    return config;
  });

module.exports = withSmsReceiver;
