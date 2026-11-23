import { requireNativeModule } from 'expo';

export type RemindersPermissionStatus = 'authorized' | 'denied' | 'notDetermined';

type ReminderPriority = 'none' | 'high' | 'medium' | 'low';

type ReminderStatus = 'pending' | 'completed';

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

type RemindersModuleType = {
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
