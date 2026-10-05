import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';

import { calendarEventGateway } from '~/services/calendar/calendar-event-gateway';

import type { TimeToastModel } from './TimeToast';
import { useTimeComposer } from './use-time-composer';

const SUCCESS_TOAST_MS = 2600;

// Natural-language planning ("lunch with Sam Friday at noon", "find time to
// call mum") for the Stream composer. Omiro keeps no calendar of its own: a
// request ends in a task, a draft handed to Apple's event editor, or a plain
// answer read from the user's calendar.
export function usePlanner() {
  const [toast, setToast] = useState<TimeToastModel | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastCounter = useRef(0);
  // Where the words go back to if a request fails or is cancelled.
  const restoreRef = useRef<((message: string) => void) | null>(null);

  const dismissToast = useCallback(() => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
      toastTimer.current = null;
    }
    setToast(null);
  }, []);

  const showToast = useCallback(
    (next: Omit<TimeToastModel, 'id'>, autoHide = false) => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
      toastCounter.current += 1;
      setToast({ ...next, id: toastCounter.current });
      toastTimer.current = autoHide ? setTimeout(dismissToast, SUCCESS_TOAST_MS) : null;
    },
    [dismissToast],
  );

  useEffect(
    () => () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    },
    [],
  );

  const showError = useCallback(
    (message: string, action?: TimeToastModel['action']) =>
      showToast({ action, detail: 'Your words are saved.', message, tone: 'error' }),
    [showToast],
  );

  const openEvent = useCallback(
    async (event: { id: string }) => {
      try {
        await calendarEventGateway.presentEvent(event.id);
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Unable to open this calendar event.');
      }
    },
    [showError],
  );

  const composer = useTimeComposer({
    onError: (message) => showError(message, { label: 'Retry', onPress: () => composer.retry() }),
    onOpenEvent: openEvent,
  });

  // The time composer puts the submitted words back as its prompt when a
  // request fails or is cancelled; hand them back to the Stream composer.
  const { prompt, setPrompt } = composer;
  useEffect(() => {
    if (prompt) {
      restoreRef.current?.(prompt);
      setPrompt('');
    }
  }, [prompt, setPrompt]);

  const plan = useCallback(
    (message: string, restore: (message: string) => void) => {
      restoreRef.current = restore;
      void composer.run(message.trim());
    },
    [composer],
  );

  const submitDraft = useCallback(async () => {
    const saved = await composer.submitDraft();
    if (!saved) {
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    showToast(
      {
        badge: '+1',
        detail: saved.onCalendar ? 'Also added to your calendar' : 'Find it in Tasks',
        message: 'Task added',
        tone: 'success',
      },
      true,
    );
  }, [composer, showToast]);

  return {
    composer,
    dismissToast,
    isPlanning: composer.interaction.kind === 'parsing',
    plan,
    submitDraft,
    toast,
  };
}

export type Planner = ReturnType<typeof usePlanner>;
