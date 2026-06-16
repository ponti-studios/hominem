/**
 * Sort types for use across packages
 * These types are exported from @hominem/ui for shared usage
 */

export type SortField = string;
export type SortDirection = 'asc' | 'desc';

export interface SortOption {
  field: SortField;
  direction: SortDirection;
}
