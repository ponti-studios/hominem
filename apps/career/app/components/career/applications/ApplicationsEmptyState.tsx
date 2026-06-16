import { EmptyState } from '@hominem/ui';

import type { ApplicationsEmptyStateProps } from './types';

export function ApplicationsEmptyState({
  kind,
  emptyTitle,
  emptyDescription,
}: ApplicationsEmptyStateProps) {
  if (kind === 'filtered') {
    return (
      <EmptyState title={emptyTitle} description={emptyDescription} variant="search" size="md" />
    );
  }

  return <EmptyState title={emptyTitle} description={emptyDescription} variant="dashed" />;
}
