import { E2E_TESTING } from '~/constants';
import OnDeviceAIModule, {
  type CalendarEvent,
  type CalendarEventSummary,
  type CalendarDraft,
  type CalendarEditorResult,
  type CalendarEventPatch,
  type CalendarOpening,
  type CalendarPermissionStatus,
  type CalendarRecurrenceScope,
  type TaskBusyInterval,
} from '~/modules/on-device-ai';

export interface CalendarEventGateway {
  findOpenings: (
    startDate: string,
    endDate: string,
    durationMinutes: number,
    taskBusyIntervals: TaskBusyInterval[],
  ) => Promise<CalendarOpening[]>;
  matchEvents: (
    query: string,
    startDate: string,
    endDate: string,
  ) => Promise<CalendarEventSummary[]>;
  createEvent: (
    title: string,
    startDate: string,
    endDate: string,
    location: string | null,
    recurrenceRule?: string | null,
  ) => Promise<CalendarEvent>;
  deleteEvent: (id: string, recurrenceScope: CalendarRecurrenceScope) => Promise<void>;
  getEvent: (id: string) => Promise<CalendarEvent>;
  getPermission: () => Promise<CalendarPermissionStatus>;
  listEvents: (startDate: string, endDate: string) => Promise<CalendarEventSummary[]>;
  presentDraft: (draft: CalendarDraft) => Promise<CalendarEditorResult>;
  presentEvent: (id: string) => Promise<CalendarEditorResult>;
  requestPermission: () => Promise<CalendarPermissionStatus>;
  subscribeToStoreChange: (listener: () => void) => { remove: () => void };
  updateEvent: (
    id: string,
    patch: CalendarEventPatch,
    recurrenceScope: CalendarRecurrenceScope,
  ) => Promise<CalendarEvent>;
}

const productionCalendarEventGateway: CalendarEventGateway = {
  findOpenings: (startDate, endDate, durationMinutes, taskBusyIntervals) =>
    OnDeviceAIModule.findCalendarOpenings(startDate, endDate, durationMinutes, taskBusyIntervals),
  matchEvents: (query, startDate, endDate) =>
    OnDeviceAIModule.matchCalendarEvents(query, startDate, endDate),
  createEvent: (title, startDate, endDate, location, recurrenceRule) =>
    OnDeviceAIModule.createCalendarEvent(title, startDate, endDate, location, recurrenceRule),
  deleteEvent: (id, recurrenceScope) => OnDeviceAIModule.deleteCalendarEvent(id, recurrenceScope),
  getEvent: (id) => OnDeviceAIModule.getCalendarEvent(id),
  getPermission: () => OnDeviceAIModule.getCalendarPermissions(),
  listEvents: (startDate, endDate) =>
    OnDeviceAIModule.listCalendarEventSummaries(startDate, endDate),
  presentDraft: (draft) => OnDeviceAIModule.presentCalendarDraft(draft),
  presentEvent: (id) => OnDeviceAIModule.presentCalendarEvent(id),
  requestPermission: () => OnDeviceAIModule.requestCalendarPermissions(),
  subscribeToStoreChange: (listener) =>
    OnDeviceAIModule.addListener('onCalendarStoreChanged', listener),
  updateEvent: (id, patch, recurrenceScope) =>
    OnDeviceAIModule.updateCalendarEvent(id, patch, recurrenceScope),
};

let resolvedGateway: CalendarEventGateway | null = null;

// E2E_TESTING is only ever true in e2e builds -- load the ~125-line mock-data
// fixture lazily instead of importing it at module scope, so it stays out of
// the production bundle.
async function resolveGateway(): Promise<CalendarEventGateway> {
  if (resolvedGateway) {
    return resolvedGateway;
  }
  if (E2E_TESTING) {
    const { timeFixtureGateway } = await import('./calendar-event-gateway.fixture');
    resolvedGateway = timeFixtureGateway;
  } else {
    resolvedGateway = productionCalendarEventGateway;
  }
  return resolvedGateway;
}

export const calendarEventGateway: CalendarEventGateway = {
  findOpenings: async (startDate, endDate, durationMinutes, taskBusyIntervals) =>
    (await resolveGateway()).findOpenings(startDate, endDate, durationMinutes, taskBusyIntervals),
  matchEvents: async (query, startDate, endDate) =>
    (await resolveGateway()).matchEvents(query, startDate, endDate),
  createEvent: async (title, startDate, endDate, location, recurrenceRule) =>
    (await resolveGateway()).createEvent(title, startDate, endDate, location, recurrenceRule),
  deleteEvent: async (id, recurrenceScope) =>
    (await resolveGateway()).deleteEvent(id, recurrenceScope),
  getEvent: async (id) => (await resolveGateway()).getEvent(id),
  getPermission: async () => (await resolveGateway()).getPermission(),
  listEvents: async (startDate, endDate) => (await resolveGateway()).listEvents(startDate, endDate),
  presentDraft: async (draft) => (await resolveGateway()).presentDraft(draft),
  presentEvent: async (id) => (await resolveGateway()).presentEvent(id),
  requestPermission: async () => (await resolveGateway()).requestPermission(),
  subscribeToStoreChange: (listener) => {
    let disposed = false;
    let remove = () => {};
    void resolveGateway().then((gateway) => {
      const subscription = gateway.subscribeToStoreChange(listener);
      if (disposed) {
        subscription.remove();
      } else {
        remove = subscription.remove;
      }
    });
    return {
      remove: () => {
        disposed = true;
        remove();
      },
    };
  },
  updateEvent: async (id, patch, recurrenceScope) =>
    (await resolveGateway()).updateEvent(id, patch, recurrenceScope),
};
