import * as Haptics from 'expo-haptics';

const ignore = () => undefined;

export function tapHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(ignore);
}

export function successHaptic() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignore);
}

export function errorHaptic() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(ignore);
}
