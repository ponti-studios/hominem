import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { calendarEventGateway } from '~/services/calendar/calendar-event-gateway';
import { CHAT_ROUTE } from '~/services/navigation/routes';

// Only 'event' deep links reach here -- tasks open in the Tasks tab's detail
// sheet, not through a route.
export default function TimeBlockDetailRoute() {
  const { id, source } = useLocalSearchParams<{ id?: string; source?: string }>();

  if (!id || source !== 'event') {
    return <Redirect href={CHAT_ROUTE} />;
  }

  return <NativeCalendarEventRoute id={id} />;
}

function NativeCalendarEventRoute({ id }: { id: string }) {
  const router = useRouter();

  useEffect(() => {
    void calendarEventGateway
      .presentEvent(id)
      .catch(() => undefined)
      .finally(() => router.replace(CHAT_ROUTE));
  }, [id, router]);

  return <Stack.Screen options={{ title: 'Calendar event' }} />;
}
