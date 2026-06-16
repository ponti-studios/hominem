import { LOG_MESSAGES, logger } from '@hominem/telemetry';

type IntentName = 'AddNoteIntent' | 'StartChatIntent';

function donateIntent(name: IntentName): void {
  try {
    const OmiroIntents = require('~/modules/omiro-intents').default as {
      donate(intentName: IntentName): Promise<boolean>;
    };
    if (!OmiroIntents?.donate) {
      if (__DEV__) {
        logger.warn(LOG_MESSAGES.INTENT_DONATION_FAILED, {
          reason: 'OmiroIntents Expo module not found',
        });
      }
      return;
    }
    void OmiroIntents.donate(name);
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
