import type { DeliveryIntent, Evidence, ProactivityDecision } from '../types.js';

export type DecisionKind = 'propose' | 'defer' | 'quiet';

export type ResultSource = 'model' | 'preflight' | 'cached';

export type StudioOwner = {
  id: string;
  name: string;
  firstName: string;
  initials: string;
  email: string;
};

export type StudioGoal = {
  id: string;
  title: string;
  domains: string[];
  status: 'active' | 'paused' | 'achieved';
  state: 'attention' | 'waiting' | 'on-track' | 'unchecked';
  lastCheckedAt: string | null;
};

export type StudioOutcomeCounts = {
  propose: number;
  defer: number;
  quiet: number;
  pending: number;
};

export type StudioDay = {
  index: number;
  date: string;
  weekday: string;
  dayNumber: string;
  month: string;
  isStoryDay: boolean;
  isPast: boolean;
  isFuture: boolean;
  counts: StudioOutcomeCounts;
};

export type StudioResult = {
  id: string;
  eventId: string;
  goalId: string;
  goalTitle: string;
  decision: ProactivityDecision;
  delivery: DeliveryIntent | null;
  held: boolean;
  heldUntil: string | null;
  evidence: Evidence[];
  previousEvidence: Evidence[];
  latencyMs: number;
  source: ResultSource;
  model: string;
  evaluatedAt: string;
  expected: DecisionKind | null;
  error: string | null;
};

export type StudioPreset = {
  id: string;
  label: string;
  hint: string;
};

export type StudioEvent = {
  id: string;
  dayIndex: number;
  at: string;
  goalIds: string[];
  title: string;
  summary: string;
  domainLabel: string;
  sourceLabel: string;
  channelLabel: string;
  status: 'pending' | 'done' | 'error';
  injected: boolean;
  results: StudioResult[];
  error: string | null;
};

export type StudioAction = {
  id: string;
  goalId: string;
  eventId: string;
  title: string;
  nextStep: string;
  status: 'open' | 'done';
  createdAt: string;
};

export type StudioPreference = {
  goalId: string;
  mode: 'snooze' | 'mute';
  until: string;
};

export type StudioStats = {
  proposals: number;
  deferred: number;
  quiet: number;
  checks: number;
  avoided: number;
  modelCalls: number;
  preflightDefers: number;
  averageLatencyMs: number;
};

export type StudioView = {
  now: string;
  weekLabel: string;
  owner: StudioOwner;
  model: string;
  modelReady: boolean;
  days: StudioDay[];
  goals: StudioGoal[];
  events: StudioEvent[];
  actions: StudioAction[];
  preferences: StudioPreference[];
  presets: StudioPreset[];
  stats: StudioStats;
  storyDayIndex: number;
};

export type StudioApiError = {
  error: string;
  detail?: string;
};
