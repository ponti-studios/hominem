import { Linking } from 'react-native';

// x-apple-reminderkit is an undocumented URL scheme; Apple could change or
// remove it without notice, so this always falls back to opening the
// Reminders app generally rather than failing outright.
const REMINDER_DEEP_LINK_SCHEME = 'x-apple-reminderkit://REMCDReminder';
const REMINDERS_APP_SCHEME = 'x-apple-reminder://';

export async function openReminderInSystemApp(id: string): Promise<void> {
  const deepLink = `${REMINDER_DEEP_LINK_SCHEME}/${id}`;
  try {
    if (await Linking.canOpenURL(deepLink)) {
      await Linking.openURL(deepLink);
      return;
    }
  } catch {
    // Fall through to the generic Reminders app link below.
  }
  try {
    await Linking.openURL(REMINDERS_APP_SCHEME);
  } catch {
    throw new Error('Unable to open the Reminders app.');
  }
}
