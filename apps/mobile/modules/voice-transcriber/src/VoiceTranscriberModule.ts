import { requireNativeModule } from 'expo';

export type SpeechRecognitionPermissionStatus =
  | 'authorized'
  | 'denied'
  | 'notDetermined'
  | 'restricted';

export type VoiceTranscriberModuleType = {
  getPermissions(): Promise<SpeechRecognitionPermissionStatus>;
  requestPermissions(): Promise<SpeechRecognitionPermissionStatus>;
  transcribeFile(audioUri: string): Promise<string>;
};

export default requireNativeModule<VoiceTranscriberModuleType>('VoiceTranscriber');
