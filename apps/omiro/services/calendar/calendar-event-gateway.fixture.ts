import type {
  CalendarEvent,
  CalendarEventPatch,
  CalendarPermissionStatus,
  CalendarRecurrenceScope,
  OnDeviceAIResult,
  TimeProcessingStageEvent,
} from '~/modules/on-device-ai';

import type { CalendarEventGateway } from './calendar-event-gateway';

type TimeFixtureScenario = 'authorized' | 'denied' | 'error' | 'loading' | 'notDetermined';

const fixtureEvents: CalendarEvent[] = [
  {
    calendarTitle: 'Omiro test calendar',
    endDate: '2026-07-26T11:00:00.000Z',
    id: 'time-fixture-past',
    isAllDay: false,
    isEditable: true,
    location: 'Studio',
    notes: null,
    participants: ['Avery'],
    recurrenceDescription: null,
    startDate: '2026-07-26T10:00:00.000Z',
    title: 'Fixture completed planning',
  },
  {
    calendarTitle: 'Omiro test calendar',
    endDate: '2026-07-28T10:00:00.000Z',
    id: 'time-fixture-editable',
    isAllDay: false,
    isEditable: true,
    location: 'Studio',
    notes: null,
    participants: ['Avery'],
    recurrenceDescription: null,
    startDate: '2026-07-28T09:00:00.000Z',
    title: 'Fixture planning',
  },
  {
    calendarTitle: 'Read-only calendar',
    endDate: '2026-07-29T14:00:00.000Z',
    id: 'time-fixture-read-only',
    isAllDay: false,
    isEditable: false,
    location: null,
    notes: 'Managed by another account',
    participants: [],
    recurrenceDescription: 'Every week',
    startDate: '2026-07-29T13:00:00.000Z',
    title: 'Fixture recurring read-only',
  },
];
let scenario: TimeFixtureScenario = 'authorized';
const processingStageListeners = new Set<(event: TimeProcessingStageEvent) => void>();

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
  askSchedule: async (prompt): Promise<OnDeviceAIResult> => {
    await maybeFail();
    return { isOnDevice: true, text: `Fixture answer for ${prompt}` };
  },
  interpret: async (prompt, _taskBusyIntervals, requestToken) => {
    const emit = (stage: TimeProcessingStageEvent['stage']) => {
      processingStageListeners.forEach((listener) => listener({ requestToken, stage }));
    };
    emit('understanding');
    await maybeFail();
    emit('preparingSuggestion');
    return { kind: 'answer', answer: `Fixture answer for ${prompt}` };
  },
  cancelInterpretation: async () => {},
  subscribeToProcessingStage: (listener: (event: TimeProcessingStageEvent) => void) => {
    processingStageListeners.add(listener);
    return { remove: () => processingStageListeners.delete(listener) };
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
