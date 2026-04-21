import { Button } from '@hakumi/ui/button';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { useChatsList, useCreateChat } from '~/hooks/use-chats';
import { useNote } from '~/hooks/use-notes';

export default function ChatIndexPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const noteId = searchParams.get('noteId') ?? '';
  const { data: chats = [] } = useChatsList();
  const { data: note } = useNote(noteId);
  const createChat = useCreateChat();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Chat</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Start a new conversation and pull in notes explicitly with mentions.
          </p>
        </div>
        <Button
          type="button"
          onClick={async () => {
            const chat = await createChat.mutateAsync({
              title: note?.title || 'New chat',
            });
            navigate(`/chat/${chat.id}${noteId ? `?noteId=${noteId}` : ''}`);
          }}
        >
          New chat
        </Button>
      </div>

      {note ? (
        <div className="rounded-2xl border border-border-subtle bg-surface p-4">
          <p className="text-sm text-text-secondary">
            This chat can start with note context from{' '}
            <span className="font-medium text-foreground">{note.title || 'Untitled note'}</span>.
          </p>
        </div>
      ) : null}

      <div className="grid gap-3">
        {chats.map((chat) => (
          <Link
            key={chat.id}
            to={`/chat/${chat.id}`}
            className="rounded-2xl border border-border-subtle bg-surface p-4 transition hover:border-foreground/30"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-foreground">{chat.title}</h3>
                <p className="mt-1 text-sm text-text-secondary">
                  Updated {new Date(chat.updatedAt).toLocaleString()}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {chats.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-subtle bg-surface p-10 text-center">
          <p className="text-base text-foreground">No chats yet.</p>
          <p className="mt-2 text-sm text-text-secondary">
            Create one and mention a note with <code>#note-title</code>.
          </p>
        </div>
      ) : null}
    </div>
  );
}
