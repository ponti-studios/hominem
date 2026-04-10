import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';

import { useReducedMotion } from './use-reduced-motion';

export function useHaptics() {
  const reduceMotion = useReducedMotion();

  const impact = useCallback(async () => {
    if (reduceMotion) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [reduceMotion]);

  const selection = useCallback(async () => {
    if (reduceMotion) return;
    await Haptics.selectionAsync();
  }, [reduceMotion]);

  const notification = useCallback(
    async (type: Haptics.NotificationFeedbackType) => {
      if (reduceMotion) return;
      await Haptics.notificationAsync(type);
    },
    [reduceMotion],
  );

  return {
    impact,
    selection,
    notification,
  };
}
