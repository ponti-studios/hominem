import type {
  AppCareerEngagementKind,
  AppCareerProjectStatus,
} from '~/modules/career/lib/types/records';

export const ENGAGEMENT_KINDS: readonly AppCareerEngagementKind[] = [
  'CONTRACT',
  'EMPLOYMENT',
  'FREELANCE',
  'OTHER',
  'VOLUNTEER',
];

export const PROJECT_STATUSES: readonly AppCareerProjectStatus[] = [
  'BACKLOG',
  'CANCELED',
  'DONE',
  'IN_PROGRESS',
];
