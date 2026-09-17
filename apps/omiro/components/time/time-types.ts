import type {
  CalendarEvent,
  CalendarEventSummary,
  TimeProcessingStage,
} from '~/modules/on-device-ai';
import type { TaskListItem } from '~/services/tasks/task-types';

export type TimeItem =
  | { kind: 'event'; value: CalendarEventSummary }
  | { kind: 'task'; value: TaskListItem };

export type TimeStreamRow = TimeItem;

// Populated entirely by the on-device Apple Intelligence time assistant
// (see nativeTimeBlock() in use-time-composer.ts) -- never by a backend call.
export interface TimeBlock {
  primary_intent:
    | 'add_task'
    | 'add_event'
    | 'add_recurring_event'
    | 'edit_event'
    | 'cancel_event'
    | 'search'
    | 'schedule_gap_fill';
  title: string | null;
  target_title: string | null;
  participants: string[] | null;
  location: string | null;
  duration: number | null;
  start_time: string | null;
  end_time: string | null;
  scheduling_window_start: string | null;
  scheduling_window_end: string | null;
  deadline_fixed: string | null;
  recurrence_rule: string | null;
}

export type EditableTimeBlockField =
  | 'title'
  | 'target_title'
  | 'participants'
  | 'location'
  | 'start_time'
  | 'end_time'
  | 'scheduling_window_start'
  | 'scheduling_window_end'
  | 'deadline_fixed'
  | 'recurrence_rule';

export type TimeInteractionState =
  | { kind: 'idle' }
  | { kind: 'parsing'; submittedPrompt: string }
  | { kind: 'error'; message: string; submittedPrompt: string }
  | { kind: 'draft'; block: TimeBlock; submittedPrompt: string }
  | { kind: 'answer'; answer: string }
  | { kind: 'availability'; block: TimeBlock; openings: TimeOpening[]; submittedPrompt: string }
  | { kind: 'event-choice'; candidates: CalendarEvent[]; submittedPrompt: string };

export interface TimeOpening {
  end: string;
  start: string;
}

export type { TimeProcessingStage };
