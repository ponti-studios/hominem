import { ArrowDown, ArrowUp } from 'lucide-react';

import { cn } from '~/lib/utils';

export type DataTableSort = {
  direction: 'asc' | 'desc' | null;
  onSort: () => void;
  label: string;
};

export type DataTableColumn<T> = {
  key: string;
  header: string;
  align?: 'left' | 'right';
  tabular?: boolean;
  sort?: DataTableSort;
  render: (row: T, index: number) => React.ReactNode;
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  keyOf: (row: T, index: number) => string;
  ariaLabel: string;
  dense?: boolean;
  onRowClick?: (row: T, index: number) => void;
  rowLabel?: (row: T, index: number) => string;
};

/**
 * The single table primitive. Replaces every hand-rolled `<table>` in
 * routes and modules — runway trajectory, reconcile, analytics tags,
 * monthly breakdown. Dark-first, tabular numerals, hairline dividers,
 * with optional sortable headers and clickable rows.
 */
export function DataTable<T>({
  columns,
  rows,
  keyOf,
  ariaLabel,
  dense,
  onRowClick,
  rowLabel,
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table aria-label={ariaLabel} className="w-full text-sm">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                aria-sort={
                  column.sort
                    ? column.sort.direction === 'asc'
                      ? 'ascending'
                      : column.sort.direction === 'desc'
                        ? 'descending'
                        : 'none'
                    : undefined
                }
                className={cn(
                  'pb-2 font-mono text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase',
                  column.align === 'right' ? 'text-right' : 'text-left',
                )}
              >
                {column.sort ? (
                  <button
                    type="button"
                    onClick={column.sort.onSort}
                    aria-label={column.sort.label}
                    className={cn(
                      'inline-flex items-center gap-1 transition-colors hover:text-foreground',
                      column.align === 'right' && 'ml-auto flex-row-reverse',
                    )}
                  >
                    {column.header}
                    {column.sort.direction === 'asc' ? (
                      <ArrowUp aria-hidden className="size-3.5" />
                    ) : column.sort.direction === 'desc' ? (
                      <ArrowDown aria-hidden className="size-3.5" />
                    ) : null}
                  </button>
                ) : (
                  column.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={keyOf(row, index)}
              onClick={onRowClick ? () => onRowClick(row, index) : undefined}
              onKeyDown={
                onRowClick
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onRowClick(row, index);
                      }
                    }
                  : undefined
              }
              tabIndex={onRowClick ? 0 : undefined}
              aria-label={onRowClick && rowLabel ? rowLabel(row, index) : undefined}
              className={cn(
                'border-t border-border transition-colors hover:bg-muted/50',
                onRowClick && 'cursor-pointer',
              )}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    dense ? 'py-1.5' : 'py-2.5',
                    column.align === 'right' && 'text-right',
                    column.tabular !== false && 'tabular-nums',
                    'text-foreground',
                  )}
                >
                  {column.render(row, index)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
