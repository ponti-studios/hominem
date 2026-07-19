import { requireNativeModule } from 'expo';

// Must stay in sync with the `code` values thrown by OnDeviceAIException in
// OnDeviceAIModule.swift — that's the only place these strings are otherwise
// defined, so a typo on either side would silently break routing.
export const OnDeviceAIErrorCode = {
  MODEL_UNAVAILABLE: 'MODEL_UNAVAILABLE',
  MISSING_PERMISSION: 'MISSING_PERMISSION',
  GENERATION_FAILED: 'GENERATION_FAILED',
} as const;

export type OnDeviceAIAvailability = 'available' | 'unavailable' | 'unsupported';

export type CalendarPermissionStatus = 'authorized' | 'denied' | 'notDetermined';

export interface OnDeviceAIResult {
  text: string;
  isOnDevice: true;
}

// Emitted throughout `askCalendar` — session start, prompt send, tool calls
// and results, and the final response — so the JS side can render the
// on-device processing steps as they happen instead of only the final text.
export interface OnDeviceAILogEvent {
  type: string;
  message: string;
  timestamp: number;
}

export type OnDeviceAIModuleType = {
  getAvailability(): Promise<OnDeviceAIAvailability>;
  getCalendarPermissions(): Promise<CalendarPermissionStatus>;
  requestCalendarPermissions(): Promise<CalendarPermissionStatus>;
  askCalendar(prompt: string): Promise<OnDeviceAIResult>;
  addListener(
    eventName: 'onDeviceAILog',
    listener: (event: OnDeviceAILogEvent) => void,
  ): { remove: () => void };
};

export default requireNativeModule<OnDeviceAIModuleType>('OnDeviceAI');
