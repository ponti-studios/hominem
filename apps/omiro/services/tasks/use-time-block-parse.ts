import { useApiClient } from '@hominem/rpc/react';
import type { TasksParseInput, TasksParseOutput } from '@hominem/rpc/types';
import { useMutation } from '@tanstack/react-query';

import { parseApiError } from '~/services/api/parse-api-error';
import { localTimeZone } from '~/services/date/format-date';

function localISOString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const mo = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const oh = pad(Math.floor(Math.abs(offset) / 60));
  const om = pad(Math.abs(offset) % 60);
  return `${y}-${mo}-${d}T${h}:${mi}:${s}${sign}${oh}:${om}`;
}

// Only the user's text, the current time and the time zone leave the device:
// the calendar is read and matched on-device (see docs/omiro.planning.md).
export function useTimeBlockParse() {
  const client = useApiClient();

  return useMutation<TasksParseOutput, Error, Pick<TasksParseInput, 'transcript'>>({
    mutationFn: async ({ transcript }) => {
      const res = await client.api.tasks.parse.$post({
        json: {
          transcript,
          referenceDate: localISOString(new Date()),
          timezone: localTimeZone(),
        },
      });
      if (!res.ok) {
        const body = await parseApiError(res);
        throw new Error(
          typeof body.error === 'string' ? body.error : `Time block parsing failed (${res.status})`,
        );
      }
      return res.json();
    },
  });
}
