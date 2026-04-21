import { Platform } from 'react-native';

import { logger, LOG_MESSAGES } from '@hominem/telemetry';

type IntentName = 'AddNoteIntent' | 'StartChatIntent';

function donateIntent(name: IntentName): void {
  if (Platform.OS !== 'ios') return;

  try {
    const HakumiIntents = require('~/modules/hakumi-intents').default as {
      donate(intentName: IntentName): Promise<boolean>;
    };
    if (!HakumiIntents?.donate) {
      if (__DEV__) {
        logger.warn(LOG_MESSAGES.INTENT_DONATION_FAILED, {
          reason: 'HakumiIntents Expo module not found',
        });
      }
      return;
    }
    void HakumiIntents.donate(name);
  } catch (e) {
    if (__DEV__) logger.warn(LOG_MESSAGES.INTENT_DONATION_FAILED, { error: e });
  }
}

/** Call when the user creates a new note manually. */
export function donateAddNoteIntent(): void {
  donateIntent('AddNoteIntent');
}

export function donateStartChatIntent(): void {
  donateIntent('StartChatIntent');
}
