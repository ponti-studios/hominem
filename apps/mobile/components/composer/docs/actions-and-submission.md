# Composer: Actions and Submission

## canSubmit

Computed by `canSubmitComposerDraft` from `composerActions.ts`:

```ts
function canSubmitComposerDraft({ isUploading, message, uploadedAttachmentIds, selectedNotes }) {
  return (
    !isUploading &&
    (message.trim().length > 0 ||
      uploadedAttachmentIds.length > 0 ||
      selectedNotes.length > 0)
  );
}
```

The send button is disabled when:
- An upload is in progress, OR
- None of: non-empty text, at least one uploaded file, at least one selected note

`isChatSending` additionally disables all buttons (including secondary and media buttons) while a chat message send is in-flight.

## Primary action

`handlePrimaryAction` in `useComposerSubmission.ts`:

```ts
const handlePrimaryAction = () => {
  if (!canSubmit) return;

  const action = resolveComposerPrimaryAction(target.kind);

  if (action === 'send_chat') {
    // ...
  }
  if (action === 'create_note') {
    void createNoteFromDraft();
  }
};
```

`resolveComposerPrimaryAction` maps target kind to action:

| Target kind | Action |
|---|---|
| `chat` | `'send_chat'` |
| `feed` | `'create_note'` |
| `notes` | `'create_note'` |
| `hidden` | `null` |

### send_chat

```ts
const noteIds = getSelectedNoteIds(selectedNotes);
void sendChatMessage({
  message: trimmedMessage,
  ...(uploadedAttachmentIds.length > 0 ? { fileIds: uploadedAttachmentIds } : {}),
  ...(noteIds.length > 0 ? { noteIds } : {}),
  ...(selectedNotes.length > 0 ? { referencedNotes: selectedNotes } : {}),
}).then(async () => {
  if (target.chatId && trimmedMessage.length > 0) {
    await maybeUpdateChatTitle(target.chatId, trimmedMessage);
  }
  clearDraft();
});
```

After sending, `maybeUpdateChatTitle` is called to auto-set a chat title from the first message if the chat still has the default title.

### create_note

```ts
const createNoteFromDraft = async () => {
  if (target.kind === 'feed') requestTopReveal();
  await createNote({
    text: message.trim(),
    ...(uploadedAttachmentIds.length > 0 ? { fileIds: uploadedAttachmentIds } : {}),
  });
  donateAddNoteIntent();
  await invalidateInboxQueries(queryClient);
  clearDraft();
};
```

`requestTopReveal` scrolls the feed to the top to show the new note. `donateAddNoteIntent` donates a Siri intent for iOS Shortcuts integration. `invalidateInboxQueries` refreshes the inbox/feed data.

## Secondary action

Available only on the `feed` target. The `bubble.left` button calls `handleSecondaryAction`:

```ts
const handleSecondaryAction = () => {
  if (resolveComposerSecondaryAction(target.kind) === 'create_chat') {
    void createChatFromDraft();
  }
};
```

### createChatFromDraft

```ts
const createChatFromDraft = async () => {
  const chat = await client.chats.create({ title: buildChatTitle(message) });

  if (trimmedMessage || uploadedAttachmentIds.length > 0) {
    await client.chats.send({
      chatId: chat.id,
      message: trimmedMessage,
      ...(uploadedAttachmentIds.length > 0 ? { fileIds: uploadedAttachmentIds } : {}),
    });
  }

  // Update inbox cache
  queryClient.setQueryData(chatKeys.resumableSessions, (prev) =>
    upsertInboxSessionActivity(prev, createChatInboxRefreshSnapshot({ ... }))
  );
  await invalidateInboxQueries(queryClient);
  clearDraft();
  router.push(`/(protected)/(tabs)/chat/${chat.id}`);
  requestTopReveal();
};
```

Creates a new chat, sends the draft message into it, updates the local cache, clears the draft, navigates to the new chat, and reveals the feed top.

## Chat title auto-update

`maybeUpdateChatTitle` runs after a successful `send_chat`:

```ts
const maybeUpdateChatTitle = async (chatId, nextTitleSource) => {
  const currentChat = queryClient.getQueryData(chatKeys.activeChat(chatId));
  if (!currentChat || !isDefaultChatTitle(currentChat.title)) return;

  const nextTitle = buildChatTitle(nextTitleSource);
  if (isDefaultChatTitle(nextTitle)) return;

  // Optimistic update to both active chat and inbox caches
  updateChatTitleCaches(queryClient, { chatId, title: nextTitle, updatedAt });

  try {
    await client.chats.update({ chatId, title: nextTitle });
  } catch {
    // Roll back via cache invalidation
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: chatKeys.activeChat(chatId) }),
      invalidateInboxQueries(queryClient),
    ]);
  }
};
```

The title is only updated if: (1) the chat currently has the default title, and (2) the new title derived from the message is not also the default title.

## clearDraft

Called after any successful submission:

```ts
const clearDraft = () => {
  setDrafts((currentDrafts) => ({
    ...currentDrafts,
    [target.key]: createEmptyComposerDraft(),
  }));
};
```

Resets only the active target's draft, leaving other targets' drafts intact.

## handleRemoveAttachment

```ts
const handleRemoveAttachment = (attachmentId: string) => {
  // Optimistic removal from UI
  setAttachments((current) => current.filter((a) => a.id !== attachmentId));

  // Fire-and-forget server delete
  const attachmentToRemove = attachments.find((a) => a.id === attachmentId);
  if (attachmentToRemove?.uploadedFile?.id) {
    void client.files.delete({ fileId: attachmentToRemove.uploadedFile.id }).catch(() => undefined);
  }
};
```
