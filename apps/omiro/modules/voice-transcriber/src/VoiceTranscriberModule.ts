import { requireNativeModule } from 'expo';

export type SpeechRecognitionPermissionStatus =
  | 'authorized'
  | 'denied'
  | 'notDetermined'
  | 'restricted';

export interface VoiceTranscriptionResult {
  rawText: string;
  locale: string;
  engine: 'sfspeech';
  isOnDevice: true;
}

export type VoiceTranscriberModuleType = {
  getPermissions(): Promise<SpeechRecognitionPermissionStatus>;
  requestPermissions(): Promise<SpeechRecognitionPermissionStatus>;
  transcribeFile(audioUri: string): Promise<VoiceTranscriptionResult>;
};

export default requireNativeModule<VoiceTranscriberModuleType>('VoiceTranscriber');
