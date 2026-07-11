import { CalendarQueryRepository } from '@hominem/db';
import type { z } from 'zod';

import { NotFoundError } from '../errors';
import {
  calendarOccurrenceSchema,
  type CalendarSearchQuery,
  type CalendarUpcomingQuery,
} from '../schemas/calendar.schema';

export type CalendarOccurrenceDto = z.infer<typeof calendarOccurrenceSchema>;

const calendarOccurrencesSchema = calendarOccurrenceSchema.array();

export class CalendarService {
  async getOccurrence(ownerUserId: string, occurrenceId: string): Promise<CalendarOccurrenceDto> {
    const row = await CalendarQueryRepository.getOccurrence(ownerUserId, occurrenceId);
    if (!row) {
      throw new NotFoundError('Calendar occurrence');
    }

    return calendarOccurrenceSchema.parse(row);
  }

  async search(
    ownerUserId: string,
    input: CalendarSearchQuery,
  ): Promise<CalendarOccurrenceDto[]> {
    const rows = await CalendarQueryRepository.search(ownerUserId, input);
    return calendarOccurrencesSchema.parse(rows);
  }

  async upcoming(
    ownerUserId: string,
    input: CalendarUpcomingQuery,
  ): Promise<CalendarOccurrenceDto[]> {
    const rows = await CalendarQueryRepository.upcoming(ownerUserId, input);
    return calendarOccurrencesSchema.parse(rows);
  }
}
