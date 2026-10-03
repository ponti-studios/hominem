import { requireNativeModule } from 'expo';

// Must stay in sync with the `code` values thrown by OnDeviceAIException in
// OnDeviceAIModule.swift -- that's the only other place these strings are
// defined, so a typo on either side would silently break routing.
export const OnDeviceAIErrorCode = {
  MISSING_PERMISSION: 'MISSING_PERMISSION',
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
  recurrenceRule?: string | null;
}

export interface TaskBusyInterval {
  startDate: string;
  endDate: string;
}

export type CalendarEditorResult = 'saved' | 'deleted' | 'cancelled';

export interface CalendarOpening {
  startDate: string;
  endDate: string;
}

export type CalendarEventPatch = {
  title?: string;
  startDate?: string;
  endDate?: string;
  location?: string | null;
  notes?: string | null;
};

export type CalendarRecurrenceScope = 'thisEvent' | 'futureEvents';

export type OnDeviceAIModuleType = {
  getCalendarPermissions(): Promise<CalendarPermissionStatus>;
  requestCalendarPermissions(): Promise<CalendarPermissionStatus>;
  listCalendarEventSummaries(startDate: string, endDate: string): Promise<CalendarEventSummary[]>;
  presentCalendarEvent(id: string): Promise<CalendarEditorResult>;
  presentCalendarDraft(draft: CalendarDraft): Promise<CalendarEditorResult>;
  // Free slots across EventKit events and the given task intervals, computed
  // on-device so calendar data never leaves the phone.
  findCalendarOpenings(
    startDate: string,
    endDate: string,
    durationMinutes: number,
    taskBusyIntervals: TaskBusyInterval[],
  ): Promise<CalendarOpening[]>;
  // Events in the range whose title matches the text, best match first.
  matchCalendarEvents(
    query: string,
    startDate: string,
    endDate: string,
  ): Promise<CalendarEventSummary[]>;
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
  // Fires whenever EventKit's store changes, including once a
  // background CalDAV/Exchange sync lands after our first read.
  addListener(eventName: 'onCalendarStoreChanged', listener: () => void): { remove: () => void };
};

export default requireNativeModule<OnDeviceAIModuleType>('OnDeviceAI');
