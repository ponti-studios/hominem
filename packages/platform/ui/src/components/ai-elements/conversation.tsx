import { ChevronDown, Download, MessageSquare } from 'lucide-react';
import { type ReactNode } from 'react';

import { Button } from '../button';

interface ConversationProps {
  children: ReactNode;
}

export function Conversation({ children }: ConversationProps) {
  return <div className="flex flex-col">{children}</div>;
}

interface ConversationContentProps {
  children: ReactNode;
}

export function ConversationContent({ children }: ConversationContentProps) {
  return <div className="flex flex-col gap-4">{children}</div>;
}

interface ConversationEmptyStateProps {
  icon?: ReactNode;
  title?: string;
  description?: string;
}

export function ConversationEmptyState({
  icon,
  title = 'Start a conversation',
  description = 'Messages will appear here as the conversation progresses.',
}: ConversationEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      {icon || <MessageSquare className="mb-4 size-12 text-muted-foreground" />}
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

interface ConversationScrollButtonProps {
  onClick?: () => void;
}

export function ConversationScrollButton({ onClick }: ConversationScrollButtonProps) {
  return (
    <Button variant="icon" size="icon-sm" onClick={onClick}>
      <ChevronDown className="size-4" />
    </Button>
  );
}

interface ConversationDownloadProps {
  messages: Array<{ role: string; content: string }>;
}

export function ConversationDownload({ messages }: ConversationDownloadProps) {
  const handleDownload = () => {
    const markdown = messages
      .map((msg) => {
        const role = msg.role === 'user' ? '**User**' : '**Assistant**';
        return `${role}:\n\n${msg.content}\n\n---\n`;
      })
      .join('\n');

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleDownload}>
      <Download className="size-4" />
      Export
    </Button>
  );
}
