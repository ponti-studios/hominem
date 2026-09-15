import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { TimeBlockDetail } from '~/components/time/TimeBlockDetail';
import { calendarEventGateway } from '~/services/calendar/calendar-event-gateway';
import { TIME_ROUTE } from '~/services/navigation/routes';

export default function TimeBlockDetailRoute() {
  const { id, mode, source } = useLocalSearchParams<{
    id?: string;
    mode?: string;
    source?: string;
  }>();
  const router = useRouter();

  if (!id || (source !== 'task' && source !== 'event')) {
    return <Redirect href={TIME_ROUTE} />;
  }

  if (source === 'event') {
    return <NativeCalendarEventRoute id={id} />;
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Time block' }} />
      <TimeBlockDetail
        id={id}
        initialActiveField={mode === 'schedule' ? 'time' : undefined}
        onClose={() => router.back()}
        source="task"
      />
    </>
  );
}

function NativeCalendarEventRoute({ id }: { id: string }) {
  const router = useRouter();

  useEffect(() => {
    void calendarEventGateway.presentEvent(id).finally(() => router.replace(TIME_ROUTE));
  }, [id, router]);

  return <Stack.Screen options={{ title: 'Calendar event' }} />;
}
