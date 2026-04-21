import * as Device from 'expo-device';
import * as Haptics from 'expo-haptics';

const canUseHaptics = Device.isDevice;

export async function impactHaptic(style: keyof typeof Haptics.ImpactFeedbackStyle) {
  if (!canUseHaptics) return;
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle[style]);
}

export async function notificationHaptic(type: keyof typeof Haptics.NotificationFeedbackType) {
  if (!canUseHaptics) return;
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType[type]);
}
