import { requireNativeModule } from 'expo';

// Must stay in sync with the `code` values thrown by OnDeviceAIException in
// OnDeviceAIModule.swift -- that's the only other place these strings are
// defined, so a typo on either side would silently break routing.
export const OnDeviceAIErrorCode = {
  MODEL_UNAVAILABLE: 'MODEL_UNAVAILABLE',
  MISSING_PERMISSION: 'MISSING_PERMISSION',
  GENERATION_FAILED: 'GENERATION_FAILED',
  INVALID_RECURRENCE_RULE: 'INVALID_RECURRENCE_RULE',
  INVALID_DATE_RANGE: 'INVALID_DATE_RANGE',
  CALENDAR_UNAVAILABLE: 'CALENDAR_UNAVAILABLE',
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
  EVENT_READ_ONLY: 'EVENT_READ_ONLY',
  CALENDAR_WRITE_FAILED: 'CALENDAR_WRITE_FAILED',
} as const;

export type CalendarPermissionStatus = 'authorized' | 'denied' | 'notDetermined';

export interface CalendarEventSummary {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  location: string | null;
  calendarTitle: string | null;
  isEditable: boolean;
}

// Legacy-only view model retained while the unreachable custom event detail
// screen is removed. `listCalendarEventSummaries` never returns these fields.
export interface CalendarEvent extends CalendarEventSummary {
  notes?: string | null;
  participants?: string[];
  recurrenceDescription?: string | null;
}

export interface CalendarDraft {
  title: string;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  location: string | null;
  notes: string | null;
}

export interface TaskBusyInterval {
  startDate: string;
  endDate: string;
}

export type CalendarEditorResult = 'saved' | 'deleted' | 'cancelled';

export type TimeAssistantResult =
  | { kind: 'answer'; answer: string }
  | {
      kind: 'taskDraft';
      taskTitle: string;
      taskDueAt: string | null;
      taskDurationMinutes: number | null;
      taskScheduledStartAt: string | null;
      taskScheduledEndAt: string | null;
      taskSchedulingWindowStartAt: string | null;
      taskSchedulingWindowEndAt: string | null;
      taskLocation: string | null;
    }
  | { kind: 'availability'; availability: { startDate: string; endDate: string }[] }
  | { kind: 'cancelled' }
  | { kind: 'error'; error: string };

export type TimeProcessingStage = 'understanding' | 'checkingSchedule' | 'preparingSuggestion';

export interface TimeProcessingStageEvent {
  stage: TimeProcessingStage;
  requestToken: string;
}

export type CalendarEventPatch = {
  title?: string;
  startDate?: string;
  endDate?: string;
  location?: string | null;
  notes?: string | null;
};

export type CalendarRecurrenceScope = 'thisEvent' | 'futureEvents';

export interface OnDeviceAIResult {
  text: string;
  isOnDevice: true;
}

// Emitted throughout `askCalendar` -- session start, prompt sent, tool calls
// and results, final response -- so the JS side can render the on-device
// steps as they happen instead of only the final text.
export interface OnDeviceAILogEvent {
  type: string;
  message: string;
  timestamp: number;
  durationMs?: number;
}

export type OnDeviceAIModuleType = {
  getCalendarPermissions(): Promise<CalendarPermissionStatus>;
  requestCalendarPermissions(): Promise<CalendarPermissionStatus>;
  listCalendarEventSummaries(startDate: string, endDate: string): Promise<CalendarEventSummary[]>;
  presentCalendarEvent(id: string): Promise<CalendarEditorResult>;
  presentCalendarDraft(draft: CalendarDraft): Promise<CalendarEditorResult>;
  interpretTimeRequest(
    prompt: string,
    taskBusyIntervals: TaskBusyInterval[],
    requestToken: string,
  ): Promise<TimeAssistantResult>;
  cancelTimeAssistant(requestToken: string): Promise<void>;
  createCalendarEvent(
    title: string,
    startDate: string,
    endDate: string,
    location: string | null,
    recurrenceRule?: string | null,
  ): Promise<CalendarEvent>;
  getCalendarEvent(id: string): Promise<CalendarEvent>;
  updateCalendarEvent(
    id: string,
    patch: CalendarEventPatch,
    recurrenceScope: CalendarRecurrenceScope,
  ): Promise<CalendarEvent>;
  deleteCalendarEvent(id: string, recurrenceScope: CalendarRecurrenceScope): Promise<void>;
  askCalendar(prompt: string): Promise<OnDeviceAIResult>;
  addListener(
    eventName: 'onDeviceAILog' | 'onTimeAssistantStage',
    listener: (event: OnDeviceAILogEvent | TimeProcessingStageEvent) => void,
  ): { remove: () => void };
  // Fires whenever EventKit's store changes, including once a
  // background CalDAV/Exchange sync lands after our first read.
  addListener(eventName: 'onCalendarStoreChanged', listener: () => void): { remove: () => void };
};

export default requireNativeModule<OnDeviceAIModuleType>('OnDeviceAI');
