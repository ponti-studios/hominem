import RemindersModule, {
  type ReminderInput,
  type ReminderRecord,
  type RemindersPermissionStatus,
} from '~/modules/reminders';

export interface RemindersGateway {
  getPermission: () => Promise<RemindersPermissionStatus>;
  requestPermission: () => Promise<RemindersPermissionStatus>;
  listReminders: () => Promise<ReminderRecord[]>;
  getReminder: (id: string) => Promise<ReminderRecord | null>;
  createReminder: (input: ReminderInput) => Promise<ReminderRecord>;
  updateReminder: (id: string, patch: ReminderInput) => Promise<ReminderRecord>;
  completeReminder: (id: string, completed: boolean) => Promise<ReminderRecord>;
  deleteReminder: (id: string) => Promise<void>;
  subscribeToStoreChange: (listener: () => void) => { remove: () => void };
}

export const remindersGateway: RemindersGateway = {
  getPermission: () => RemindersModule.getAuthorizationStatus(),
  requestPermission: () => RemindersModule.requestAccess(),
  listReminders: () => RemindersModule.listReminders(),
  getReminder: (id) => RemindersModule.getReminder(id),
  createReminder: (input) => RemindersModule.createReminder(input),
  updateReminder: (id, patch) => RemindersModule.updateReminder(id, patch),
  completeReminder: (id, completed) => RemindersModule.completeReminder(id, completed),
  deleteReminder: (id) => RemindersModule.deleteReminder(id),
  subscribeToStoreChange: (listener) =>
    RemindersModule.addListener('onRemindersStoreChanged', listener),
};
