import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { calendarEventGateway } from '~/services/calendar/calendar-event-gateway';
import { TIME_ROUTE } from '~/services/navigation/routes';

// Only 'event' deep links reach here -- tasks have no in-app detail screen
// and are opened directly in Reminders.app instead (see open-reminder.ts).
export default function TimeBlockDetailRoute() {
  const { id, source } = useLocalSearchParams<{ id?: string; source?: string }>();

  if (!id || source !== 'event') {
    return <Redirect href={TIME_ROUTE} />;
  }

  return <NativeCalendarEventRoute id={id} />;
}

function NativeCalendarEventRoute({ id }: { id: string }) {
  const router = useRouter();

  useEffect(() => {
    void calendarEventGateway
      .presentEvent(id)
      .catch(() => undefined)
      .finally(() => router.replace(TIME_ROUTE));
  }, [id, router]);

  return <Stack.Screen options={{ title: 'Calendar event' }} />;
}
