import { Platform } from 'react-native';

type IntentName = 'AddNoteIntent' | 'StartChatIntent';

function donateIntent(name: IntentName): void {
  if (Platform.OS !== 'ios') return;

  try {
    const HakumiIntents = require('~/modules/hakumi-intents').default as {
      donate(intentName: IntentName): Promise<boolean>;
    };
    if (!HakumiIntents?.donate) {
      if (__DEV__) {
        console.warn(
          '[intent-donation] HakumiIntents Expo module not found. Rebuild the app to link local modules.',
        );
      }
      return;
    }
    void HakumiIntents.donate(name);
  } catch (e) {
    if (__DEV__) console.warn('[intent-donation] donate() failed:', e);
  }
}

/** Call when the user creates a new note manually. */
export function donateAddNoteIntent(): void {
  donateIntent('AddNoteIntent');
}

export function donateStartChatIntent(): void {
  donateIntent('StartChatIntent');
}
