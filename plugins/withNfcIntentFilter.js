const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Config plugin that adds NFC NDEF_DISCOVERED intent filter to MainActivity.
 * This allows the app to open directly when scanning an NFC tag with the
 * crea-glass:// URI scheme, without showing an intermediate Android screen.
 */
function withNfcIntentFilter(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const mainActivity =
      manifest.manifest.application?.[0]?.activity?.find(
        (a) => a.$?.['android:name'] === '.MainActivity'
      );

    if (!mainActivity) return config;

    if (!mainActivity['intent-filter']) {
      mainActivity['intent-filter'] = [];
    }

    // Check if already added
    const alreadyExists = mainActivity['intent-filter'].some((f) =>
      f.action?.some((a) => a.$?.['android:name'] === 'android.nfc.action.NDEF_DISCOVERED')
    );

    if (!alreadyExists) {
      mainActivity['intent-filter'].push({
        action: [{ $: { 'android:name': 'android.nfc.action.NDEF_DISCOVERED' } }],
        category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
        data: [{ $: { 'android:scheme': 'crea-glass' } }],
      });
    }

    return config;
  });
}

module.exports = withNfcIntentFilter;
