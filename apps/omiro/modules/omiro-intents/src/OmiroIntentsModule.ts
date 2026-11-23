import { requireNativeModule } from 'expo';

type IntentName = 'AddNoteIntent' | 'StartChatIntent';

type OmiroIntentsModuleType = {
  donate(intentName: IntentName): Promise<boolean>;
};

export default requireNativeModule<OmiroIntentsModuleType>('OmiroIntents');
