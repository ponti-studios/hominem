import type { ReactNode } from 'react';

import { List, RowLink } from '~/components/design/lists';
import { PanelState, SectionCard } from '~/components/design/surfaces';

interface CareerCollectionEmptyProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

interface CareerCollectionProps<T> {
  items: T[];
  keyFor: (item: T) => string;
  hrefFor: (item: T) => string;
  title: (item: T) => ReactNode;
  subtitle?: (item: T) => ReactNode;
  meta?: (item: T) => ReactNode;
  trailing?: (item: T) => ReactNode;
  leading?: (item: T) => ReactNode;
  empty: CareerCollectionEmptyProps;
  className?: string;
}

// Use this to render any career collection (positions, projects, testimonials,
// applications...) so the list and empty states look the same everywhere.
export function CareerCollection<T>({
  items,
  keyFor,
  hrefFor,
  title,
  subtitle,
  meta,
  trailing,
  leading,
  empty,
  className,
}: CareerCollectionProps<T>) {
  if (items.length === 0) {
    return (
      <div className={className}>
        <PanelState
          title={typeof empty.title === 'string' ? empty.title : 'Nothing here yet'}
          description={typeof empty.description === 'string' ? empty.description : undefined}
          icon={empty.icon}
          action={empty.action}
        />
      </div>
    );
  }

  return (
    <SectionCard className={className}>
      <List ariaLabel="Items">
        {items.map((item) => (
          <li key={keyFor(item)}>
            <RowLink
              to={hrefFor(item)}
              title={title(item)}
              subtitle={subtitle?.(item) ?? undefined}
              meta={meta?.(item) ?? undefined}
              trailing={trailing?.(item)}
              leading={leading?.(item)}
            />
          </li>
        ))}
      </List>
    </SectionCard>
  );
}
