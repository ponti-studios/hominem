import type {
  CalendarEvent,
  CalendarEventPatch,
  CalendarOpening,
  CalendarPermissionStatus,
  CalendarRecurrenceScope,
} from '~/modules/on-device-ai';

import type { CalendarEventGateway } from './calendar-event-gateway';

type TimeFixtureScenario = 'authorized' | 'denied' | 'error' | 'loading' | 'notDetermined';

// Relative to now so the fixture events stay upcoming: the Time stream hides
// past events, and fixed dates would silently drop out of every e2e flow.
function fixtureTime(daysFromNow: number, hourUtc: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  date.setUTCHours(hourUtc, 0, 0, 0);
  return date.toISOString();
}

const fixtureEvents: CalendarEvent[] = [
  {
    calendarTitle: 'Omiro test calendar',
    endDate: fixtureTime(-2, 11),
    id: 'time-fixture-past',
    isAllDay: false,
    isEditable: true,
    location: 'Studio',
    notes: null,
    participants: ['Avery'],
    recurrenceDescription: null,
    startDate: fixtureTime(-2, 10),
    title: 'Fixture completed planning',
  },
  {
    calendarTitle: 'Omiro test calendar',
    endDate: fixtureTime(2, 10),
    id: 'time-fixture-editable',
    isAllDay: false,
    isEditable: true,
    location: 'Studio',
    notes: null,
    participants: ['Avery'],
    recurrenceDescription: null,
    startDate: fixtureTime(2, 9),
    title: 'Fixture planning',
  },
  {
    calendarTitle: 'Read-only calendar',
    endDate: fixtureTime(3, 14),
    id: 'time-fixture-read-only',
    isAllDay: false,
    isEditable: false,
    location: null,
    notes: 'Managed by another account',
    participants: [],
    recurrenceDescription: 'Every week',
    startDate: fixtureTime(3, 13),
    title: 'Fixture recurring read-only',
  },
];
let scenario: TimeFixtureScenario = 'authorized';

function permission(): CalendarPermissionStatus {
  if (scenario === 'denied') {
    return 'denied';
  }
  if (scenario === 'notDetermined') {
    return 'notDetermined';
  }
  return 'authorized';
}

async function maybeFail() {
  if (scenario === 'error') {
    throw new Error('Fixture Calendar request failed.');
  }
  if (scenario === 'loading') {
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
}

export const timeFixtureGateway: CalendarEventGateway = {
  findOpenings: async (startDate, endDate, durationMinutes): Promise<CalendarOpening[]> => {
    await maybeFail();
    const start = new Date(startDate);
    return [
      {
        endDate: new Date(start.getTime() + durationMinutes * 60_000).toISOString(),
        startDate: start.toISOString(),
      },
    ];
  },
  matchEvents: async (query, startDate, endDate): Promise<CalendarEvent[]> => {
    await maybeFail();
    const needle = query.trim().toLocaleLowerCase();
    return fixtureEvents.filter(
      (event) =>
        event.title.toLocaleLowerCase().includes(needle) &&
        event.endDate >= startDate &&
        event.startDate <= endDate,
    );
  },
  createEvent: async (title, startDate, endDate, location): Promise<CalendarEvent> => {
    await maybeFail();
    const created = {
      calendarTitle: 'Omiro test calendar',
      endDate,
      id: `time-fixture-created-${fixtureEvents.length}`,
      isAllDay: false,
      isEditable: true,
      location,
      notes: null,
      participants: [],
      recurrenceDescription: null,
      startDate,
      title,
    };
    fixtureEvents.push(created);
    return created;
  },
  deleteEvent: async (id: string, _scope: CalendarRecurrenceScope): Promise<void> => {
    await maybeFail();
    const index = fixtureEvents.findIndex((event) => event.id === id);
    if (index >= 0) {
      fixtureEvents.splice(index, 1);
    }
  },
  getEvent: async (id: string): Promise<CalendarEvent> => {
    await maybeFail();
    const event = fixtureEvents.find((candidate) => candidate.id === id);
    if (!event) {
      throw new Error('Fixture event not found.');
    }
    return event;
  },
  getPermission: async () => permission(),
  listEvents: async (startDate: string, endDate: string): Promise<CalendarEvent[]> => {
    await maybeFail();
    return fixtureEvents.filter((event) => event.startDate < endDate && event.endDate > startDate);
  },
  presentDraft: async (draft) => {
    await maybeFail();
    fixtureEvents.push({
      calendarTitle: 'Omiro test calendar',
      endDate: draft.endDate,
      id: `time-fixture-created-${fixtureEvents.length}`,
      isAllDay: draft.isAllDay,
      isEditable: true,
      location: draft.location,
      notes: draft.notes,
      participants: [],
      recurrenceDescription: null,
      startDate: draft.startDate,
      title: draft.title,
    });
    return 'saved';
  },
  presentEvent: async () => {
    await maybeFail();
    return 'saved';
  },
  requestPermission: async () => {
    scenario = 'authorized';
    return permission();
  },
  subscribeToStoreChange: () => ({ remove: () => {} }),
  updateEvent: async (
    id: string,
    patch: CalendarEventPatch,
    _scope: CalendarRecurrenceScope,
  ): Promise<CalendarEvent> => {
    await maybeFail();
    const index = fixtureEvents.findIndex((event) => event.id === id);
    if (index < 0) {
      throw new Error('Fixture event not found.');
    }
    fixtureEvents[index] = { ...fixtureEvents[index], ...patch };
    return fixtureEvents[index];
  },
};
