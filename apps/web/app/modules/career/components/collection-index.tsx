import { PlusIcon } from 'lucide-react';
import { Link } from 'react-router';

import { AddButton } from '~/components/design';
import { PageHeader } from '~/components/design/page-header';
import { ExpandableSearch } from '~/modules/career/components/career/ExpandableSearch';

type CollectionSearch = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
};

type CollectionIndexProps = {
  eyebrow: string;
  title: string;
  addTo?: string;
  addLabel?: string;
  actions?: React.ReactNode;
  search?: CollectionSearch;
  showSearch?: boolean;
  children: React.ReactNode;
};

/**
 * Standard career collection page: PageHeader with add action, optional
 * search, then the list. Replaces the SectionIntro + AddButton +
 * ExpandableSearch glue repeated on every list route.
 */
export function CollectionIndex({
  eyebrow,
  title,
  addTo,
  addLabel,
  actions,
  search,
  showSearch,
  children,
}: CollectionIndexProps) {
  return (
    <div>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        actions={
          actions ??
          (addTo && addLabel ? (
            <AddButton asChild label={addLabel}>
              <Link to={addTo}>
                <PlusIcon aria-hidden />
              </Link>
            </AddButton>
          ) : undefined)
        }
      />
      {showSearch && search ? (
        <div className="mb-4">
          <ExpandableSearch
            id={search.id}
            value={search.value}
            onChange={search.onChange}
            placeholder={search.placeholder}
            ariaLabel={search.ariaLabel}
          />
        </div>
      ) : null}
      {children}
    </div>
  );
}
