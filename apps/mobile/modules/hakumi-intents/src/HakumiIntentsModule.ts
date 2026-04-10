import { requireNativeModule } from 'expo';

export type IntentName = 'AddNoteIntent' | 'StartChatIntent';

export type HakumiIntentsModuleType = {
  donate(intentName: IntentName): Promise<boolean>;
};

export default requireNativeModule<HakumiIntentsModuleType>('HakumiIntents');
