import { LogOut, Mail, Pencil, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useRouteLoaderData } from 'react-router';

import {
  BackLink,
  DeleteButton,
  DetailHero,
  PanelState,
  SectionHeader,
  SelectField,
} from '~/components/design';
import { Container } from '~/components/design/container';
import { TextAreaInput, TextInput } from '~/components/design/forms';
import { List } from '~/components/design/lists';
import { SectionCard } from '~/components/design/surfaces';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import {
  isInvitableRole,
  memberDisplayName,
  useCollectionDetail,
  useDeleteCollection,
  useInviteMember,
  useLeaveCollection,
  useRemoveCollectionItem,
  useRemoveMember,
  useUpdateCollection,
} from '~/hooks/use-collections';
import type { User } from '~/lib/auth.server';

import { RoleSelect } from './role-select';
import { VisibilitySelect } from './visibility-select';

function EditCollectionDialog({
  collectionId,
  name,
  description,
  visibility,
}: {
  collectionId: string;
  name: string;
  description: string | null;
  visibility: 'private' | 'shared';
}) {
  const [open, setOpen] = useState(false);
  const [nameValue, setNameValue] = useState(name);
  const [descriptionValue, setDescriptionValue] = useState(description ?? '');
  const [visibilityValue, setVisibilityValue] = useState(visibility);
  const updateCollection = useUpdateCollection(collectionId);

  const trimmedName = nameValue.trim();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setNameValue(name);
      setDescriptionValue(description ?? '');
      setVisibilityValue(visibility);
    }
  }

  function handleSubmit() {
    if (!trimmedName) return;
    updateCollection.mutate(
      {
        name: trimmedName,
        description: descriptionValue.trim() || null,
        visibility: visibilityValue,
      },
      { onSuccess: () => setOpen(false) },
    );
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button aria-label="Edit collection" size="icon-sm" variant="ghost">
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit collection</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <TextInput
            label="Name"
            name="name"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
          />
          <TextAreaInput
            label="Description (optional)"
            name="description"
            rows={3}
            value={descriptionValue}
            onChange={(e) => setDescriptionValue(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[#f2f4f8]">Visibility</span>
            <VisibilitySelect onChange={setVisibilityValue} value={visibilityValue} />
          </div>
          {updateCollection.isError ? (
            <p className="text-sm text-[#ff9d9d]">Could not save changes.</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            disabled={updateCollection.isPending || !trimmedName}
            onClick={handleSubmit}
            type="button"
          >
            {updateCollection.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function InviteMemberDialog({
  collectionId,
  ownEmail,
}: {
  collectionId: string;
  ownEmail: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('viewer');
  const inviteMember = useInviteMember(collectionId);

  const trimmedEmail = email.trim();
  const isSelfInvite =
    !!ownEmail && !!trimmedEmail && trimmedEmail.toLowerCase() === ownEmail.toLowerCase();

  function handleSubmit() {
    if (!trimmedEmail || isSelfInvite) return;
    inviteMember.mutate(
      { email: trimmedEmail, role },
      {
        onSuccess: () => {
          setEmail('');
          setOpen(false);
        },
      },
    );
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <UserPlus /> Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a collaborator</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <TextInput
            label="Email"
            name="email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <SelectField
            label="Role"
            name="role"
            value={role}
            onChange={(v) => {
              if (isInvitableRole(v)) setRole(v);
            }}
            options={[
              { value: 'viewer', label: 'Viewer' },
              { value: 'editor', label: 'Editor' },
            ]}
          />
          {isSelfInvite ? (
            <p className="text-sm text-[#ff9d9d]">You can't invite yourself.</p>
          ) : null}
          {inviteMember.isError ? (
            <p className="text-sm text-[#ff9d9d]">Could not send invite.</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            disabled={inviteMember.isPending || !trimmedEmail || isSelfInvite}
            onClick={handleSubmit}
            type="button"
          >
            {inviteMember.isPending ? 'Inviting…' : 'Send invite'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CollectionDetailPage({ collectionId }: { collectionId: string }) {
  const navigate = useNavigate();
  const layoutData = useRouteLoaderData<{ user: User | null }>('routes/layout');
  const currentUserId = layoutData?.user?.id;
  const currentUserEmail = layoutData?.user?.email;
  const { data, error, isPending, refetch } = useCollectionDetail(collectionId);
  const removeMember = useRemoveMember(collectionId);
  const removeItem = useRemoveCollectionItem(collectionId);
  const deleteCollection = useDeleteCollection(collectionId);
  const leaveCollection = useLeaveCollection(collectionId);

  const collection = data?.collection;
  const items = data?.items ?? [];
  const members = data?.members ?? [];
  const viewerRole = data?.viewerRole ?? null;
  const isOwner = viewerRole === 'owner';
  const canManageItems = isOwner || viewerRole === 'editor';
  const canLeave = viewerRole === 'editor' || viewerRole === 'viewer';

  function goToCollectionsList() {
    // eslint-disable-next-line no-void -- fire-and-forget navigation, result intentionally unused
    void navigate('/collections', { viewTransition: true });
  }

  function handleLeave() {
    if (!window.confirm(`Leave "${collection?.name}"?`)) return;
    leaveCollection.mutate(undefined, { onSuccess: goToCollectionsList });
  }

  function handleRetry() {
    // eslint-disable-next-line no-void -- fire-and-forget refetch, result intentionally unused
    void refetch();
  }

  return (
    <main className="h-full overflow-auto">
      <Container size="sm">
        <div className="mb-6 flex items-center gap-3">
          <BackLink to="/collections" label="Back to collections" variant="icon" />
          <div className="min-w-0 flex-1">
            <DetailHero
              title={collection?.name ?? (isPending ? 'Loading…' : 'Collection')}
              subtitle={collection?.description ?? undefined}
              actions={
                <>
                  {collection && isOwner ? (
                    <>
                      <EditCollectionDialog
                        collectionId={collectionId}
                        description={collection.description}
                        name={collection.name}
                        visibility={collection.visibility}
                      />
                      <DeleteButton
                        itemName={collection.name}
                        onConfirm={() =>
                          deleteCollection.mutate(undefined, { onSuccess: goToCollectionsList })
                        }
                      />
                    </>
                  ) : null}
                  {collection && canLeave ? (
                    <Button
                      disabled={leaveCollection.isPending}
                      onClick={handleLeave}
                      size="sm"
                      variant="outline"
                    >
                      <LogOut className="size-4" /> Leave
                    </Button>
                  ) : null}
                </>
              }
            />
          </div>
        </div>

        {error ? (
          <PanelState
            title="Collection unavailable"
            action={
              <Button onClick={handleRetry} variant="secondary">
                Try again
              </Button>
            }
          />
        ) : null}

        {!isPending && !error && !collection ? (
          <PanelState
            title="Not found"
            description="This collection doesn't exist, or you don't have access to it."
          />
        ) : null}

        {collection ? (
          <div className="flex flex-col gap-4">
            <SectionCard>
              <div className="p-5">
                <SectionHeader
                  title={`Items · ${items.length} item${items.length === 1 ? '' : 's'}`}
                />
                <div className="mt-3">
                  {items.length === 0 ? (
                    <PanelState title="Nothing in this collection yet" />
                  ) : (
                    <List ariaLabel="Collection items">
                      {items.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium text-[#f2f4f8]">
                                {item.entityName ?? '(unnamed)'}
                              </span>
                              <Badge variant="secondary">{item.entityType}</Badge>
                            </div>
                            {item.note ? (
                              <p className="truncate text-[13px] text-[#9ba3b4]">{item.note}</p>
                            ) : null}
                          </div>
                          <span className="shrink-0 font-mono text-[11px] text-[#5e6678] tabular-nums">
                            {dateFormatter.format(new Date(item.addedAt))}
                          </span>
                          {canManageItems ? (
                            <DeleteButton
                              itemName={item.entityName ?? 'this item'}
                              label="Remove"
                              variant="ghost"
                              onConfirm={() =>
                                removeItem.mutate({
                                  entityType: item.entityType,
                                  entityId: item.entityId,
                                })
                              }
                            />
                          ) : null}
                        </li>
                      ))}
                    </List>
                  )}
                </div>
              </div>
            </SectionCard>

            <SectionCard>
              <div className="p-5">
                <SectionHeader
                  title={`Collaborators · ${members.length} member${members.length === 1 ? '' : 's'}`}
                  actions={
                    isOwner ? (
                      <InviteMemberDialog collectionId={collectionId} ownEmail={currentUserEmail} />
                    ) : undefined
                  }
                />
                <div className="mt-3">
                  <List ariaLabel="Collaborators">
                    {members.map((member) => {
                      const isSelf = member.userId === currentUserId;
                      const isPendingInvite = !member.acceptedAt;
                      const canManage = isOwner && !isSelf && member.role !== 'owner';
                      return (
                        <li
                          key={member.id}
                          className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-sm text-[#f2f4f8]">
                              {memberDisplayName(member)}
                            </span>
                            {isOwner && !isSelf && member.role !== 'owner' ? (
                              <RoleSelect
                                collectionId={collectionId}
                                memberId={member.id}
                                role={member.role}
                              />
                            ) : (
                              <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                                {member.role}
                              </Badge>
                            )}
                            {isPendingInvite ? (
                              <Badge className="gap-1" variant="outline">
                                <Mail className="size-3" /> Pending
                              </Badge>
                            ) : null}
                          </div>
                          {canManage ? (
                            <DeleteButton
                              itemName={memberDisplayName(member)}
                              label="Remove collaborator"
                              variant="ghost"
                              disabled={
                                removeMember.isPending &&
                                removeMember.variables?.memberId === member.id
                              }
                              onConfirm={() => removeMember.mutate({ memberId: member.id })}
                            />
                          ) : null}
                        </li>
                      );
                    })}
                  </List>
                </div>
              </div>
            </SectionCard>
          </div>
        ) : null}
      </Container>
    </main>
  );
}
