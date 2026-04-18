import * as Device from 'expo-device';
import * as Haptics from 'expo-haptics';

const canUseHaptics = Device.isDevice;

export async function impactHaptic(style: Haptics.ImpactFeedbackStyle) {
  if (!canUseHaptics) return;
  await Haptics.impactAsync(style);
}

export async function notificationHaptic(type: Haptics.NotificationFeedbackType) {
  if (!canUseHaptics) return;
  await Haptics.notificationAsync(type);
}
