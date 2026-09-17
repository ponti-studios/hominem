import { requireNativeModule } from 'expo';

// Must stay in sync with the `code` values thrown by RemindersException in
// RemindersModule.swift -- that's the only other place these strings are
// defined, so a typo on either side would silently break routing.
export const RemindersErrorCode = {
  MISSING_PERMISSION: 'MISSING_PERMISSION',
  REMINDER_NOT_FOUND: 'REMINDER_NOT_FOUND',
  REMINDERS_LIST_UNAVAILABLE: 'REMINDERS_LIST_UNAVAILABLE',
  REMINDER_WRITE_FAILED: 'REMINDER_WRITE_FAILED',
  INVALID_DATE_RANGE: 'INVALID_DATE_RANGE',
} as const;

export type RemindersPermissionStatus = 'authorized' | 'denied' | 'notDetermined';

export type ReminderPriority = 'none' | 'high' | 'medium' | 'low';

export type ReminderStatus = 'pending' | 'completed';

export interface ReminderRecord {
  id: string;
  title: string;
  notes: string | null;
  status: ReminderStatus;
  completedAt: string | null;
  priority: ReminderPriority;
  startAt: string | null;
  dueAt: string | null;
  location: string | null;
  listTitle: string | null;
  createdAt: string | null;
}

export interface ReminderInput {
  title?: string;
  notes?: string | null;
  priority?: ReminderPriority;
  startAt?: string | null;
  dueAt?: string | null;
  location?: string | null;
}

export type RemindersModuleType = {
  getAuthorizationStatus(): Promise<RemindersPermissionStatus>;
  requestAccess(): Promise<RemindersPermissionStatus>;
  listReminders(): Promise<ReminderRecord[]>;
  getReminder(id: string): Promise<ReminderRecord | null>;
  createReminder(input: ReminderInput): Promise<ReminderRecord>;
  updateReminder(id: string, patch: ReminderInput): Promise<ReminderRecord>;
  completeReminder(id: string, completed: boolean): Promise<ReminderRecord>;
  deleteReminder(id: string): Promise<void>;
  // Fires whenever EventKit's store changes, including a reminder edited
  // directly in Reminders.app or synced in from iCloud.
  addListener(eventName: 'onRemindersStoreChanged', listener: () => void): { remove: () => void };
};

export default requireNativeModule<RemindersModuleType>('Reminders');
