import { requireNativeModule } from 'expo';

export type IntentName = 'AddNoteIntent' | 'StartChatIntent';

export type OmiroIntentsModuleType = {
  donate(intentName: IntentName): Promise<boolean>;
};

export default requireNativeModule<OmiroIntentsModuleType>('OmiroIntents');
