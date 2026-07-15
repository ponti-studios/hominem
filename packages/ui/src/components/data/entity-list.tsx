import type { ComponentType, CSSProperties, ReactNode } from 'react';

import { cn } from '../../lib/utils';

export interface EntityListLinkProps {
  href: string;
  className?: string;
  children: ReactNode;
}

function DefaultEntityListLink({ href, className, children }: EntityListLinkProps) {
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

interface ListRowProps {
  href: string;
  className?: string;
  linkComponent: ComponentType<EntityListLinkProps>;
  children: ReactNode;
}

function ListRow({ href, className, linkComponent: LinkComponent, children }: ListRowProps) {
  return (
    <li className="transition-colors duration-150">
      <LinkComponent href={href} className={cn('block', className)}>
        {children}
      </LinkComponent>
    </li>
  );
}

export interface EntityListColumn<T> {
  key: string;
  header: ReactNode;
  /** grid-template-columns track size, e.g. "minmax(0,1.5fr)" */
  width: string;
  render: (item: T) => ReactNode;
  className?: string;
}

export interface EntityListTableProps<T> {
  items: T[];
  columns: EntityListColumn<T>[];
  keyFor: (item: T) => string;
  hrefFor: (item: T) => string;
  linkComponent?: ComponentType<EntityListLinkProps>;
}

export function EntityListTable<T>({
  items,
  columns,
  keyFor,
  hrefFor,
  linkComponent = DefaultEntityListLink,
}: EntityListTableProps<T>) {
  const gridTemplateColumns = columns.map((column) => column.width).join(' ');
  const gridStyle: CSSProperties = { gridTemplateColumns };

  return (
    <div className="hidden md:block">
      <div className="grid gap-3 bg-muted/20 px-4 py-3 ui-data-label" style={gridStyle}>
        {columns.map((column) => (
          <span key={column.key}>{column.header}</span>
        ))}
      </div>

      <ul className="divide-y divide-border">
        {items.map((item) => (
          <ListRow key={keyFor(item)} href={hrefFor(item)} linkComponent={linkComponent}>
            <div className="grid min-h-16 items-center gap-3 px-4 py-3" style={gridStyle}>
              {columns.map((column) => (
                <div key={column.key} className={column.className}>
                  {column.render(item)}
                </div>
              ))}
            </div>
          </ListRow>
        ))}
      </ul>
    </div>
  );
}

export interface EntityListCardsProps<T> {
  items: T[];
  keyFor: (item: T) => string;
  hrefFor: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  linkComponent?: ComponentType<EntityListLinkProps>;
}

export function EntityListCards<T>({
  items,
  keyFor,
  hrefFor,
  renderCard,
  linkComponent = DefaultEntityListLink,
}: EntityListCardsProps<T>) {
  return (
    <div className="md:hidden">
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <ListRow
            key={keyFor(item)}
            href={hrefFor(item)}
            className="p-4"
            linkComponent={linkComponent}
          >
            {renderCard(item)}
          </ListRow>
        ))}
      </ul>
    </div>
  );
}
