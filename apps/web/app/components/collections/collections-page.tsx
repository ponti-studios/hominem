import { ArrowLeft, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { CollaborationNotifications } from '~/components/collaboration-notifications';
import { Container } from '~/components/design/container';
import { List, RowLink } from '~/components/design/lists';
import { PageHeader } from '~/components/design/page-header';
import { ListSkeleton } from '~/components/design/skeleton';
import { PanelState, SectionCard } from '~/components/design/surfaces';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { useCollectionsList } from '~/hooks/use-collections';

import { CreateCollectionDialog } from './create-collection-dialog';

const PAGE_SIZE = 20;

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function CollectionsPage() {
  const [page, setPage] = useState(0);
  const { data, error, isPending, refetch } = useCollectionsList();
  const collections = data?.collections ?? [];
  const pageCollections = collections.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(collections.length / PAGE_SIZE));

  function handleRetry() {
    // eslint-disable-next-line no-void -- fire-and-forget refetch, result intentionally unused
    void refetch();
  }

  return (
    <main className="h-full overflow-auto">
      <Container size="sm">
        <PageHeader
          eyebrow="Collections"
          title="Collections"
          description="Everything you've grouped together, owned or shared with you."
          actions={
            <div className="flex items-center gap-2">
              <Button aria-label="Back to tasks" asChild size="icon-sm" variant="ghost">
                <Link to="/tasks" viewTransition>
                  <ArrowLeft />
                </Link>
              </Button>
              <CreateCollectionDialog />
            </div>
          }
        />

        <div className="flex flex-col gap-4">
          <SectionCard index={0}>
            <div className="p-5">
              <CollaborationNotifications />
            </div>
          </SectionCard>

          <SectionCard index={1}>
            {isPending ? <ListSkeleton rows={5} label="Loading collections" /> : null}
            {error ? (
              <PanelState
                title="Collections unavailable"
                action={
                  <Button onClick={handleRetry} variant="secondary">
                    Try again
                  </Button>
                }
              />
            ) : null}
            {!isPending && !error && collections.length === 0 ? (
              <PanelState
                title="No collections yet"
                description="Group notes and sets together to find them faster."
                action={<CreateCollectionDialog />}
              />
            ) : null}
            {!isPending && !error && pageCollections.length > 0 ? (
              <List ariaLabel="Collections">
                {pageCollections.map((collection) => (
                  <li key={collection.id}>
                    <RowLink
                      to={`/collections/${collection.id}`}
                      title={collection.name}
                      subtitle={collection.description ?? undefined}
                      badges={
                        collection.visibility === 'shared' ? (
                          <Badge className="gap-1" variant="secondary">
                            <Users className="size-3" /> Shared
                          </Badge>
                        ) : null
                      }
                      meta={
                        <>
                          <span>
                            {collection.itemCount} item{collection.itemCount === 1 ? '' : 's'}
                          </span>
                          <span className="hidden sm:inline">
                            {dateFormatter.format(new Date(collection.updatedAt))}
                          </span>
                        </>
                      }
                    />
                  </li>
                ))}
              </List>
            ) : null}
          </SectionCard>
        </div>

        {collections.length > PAGE_SIZE ? (
          <nav aria-label="Collection pages" className="mt-5 flex items-center justify-between">
            <Button
              disabled={page === 0}
              onClick={() => setPage((current) => current - 1)}
              variant="outline"
            >
              <ChevronLeft /> Previous
            </Button>
            <span className="text-sm text-[#9ba3b4] tabular-nums">
              Page {page + 1} of {pageCount}
            </span>
            <Button
              disabled={page >= pageCount - 1}
              onClick={() => setPage((current) => current + 1)}
              variant="outline"
            >
              Next <ChevronRight />
            </Button>
          </nav>
        ) : null}
      </Container>
    </main>
  );
}
