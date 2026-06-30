/**
 * Sort types for use across packages
 * These types are exported from the shared UI package for shared usage
 */

export type SortField = string;
export type SortDirection = "asc" | "desc";

export interface SortOption {
  field: SortField;
  direction: SortDirection;
}
