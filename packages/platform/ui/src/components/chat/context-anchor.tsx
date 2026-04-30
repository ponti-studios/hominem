import type { SessionSource } from '@hominem/rpc/types';

interface ContextAnchorProps {
  source: SessionSource;
  showTitle?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  note: 'NOTE',
  task: 'TASK',
  task_list: 'LIST',
  tracker: 'TRACKER',
};

export function ContextAnchor({ source, showTitle = true }: ContextAnchorProps) {
  if (source.kind === 'new') {
    return <div className="text-sm font-medium leading-5">New conversation</div>;
  }

  if (source.kind === 'capture') {
    if (!showTitle) {
      return <div className="text-xs uppercase tracking-[0.08em] opacity-70">Conversation</div>;
    }

    return <div className="text-sm font-medium leading-5">{source.preview}</div>;
  }

  if (!showTitle) {
    return (
      <div className="text-xs uppercase tracking-[0.08em] opacity-70">
        {TYPE_LABELS[source.type] ?? source.type}
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="truncate text-sm font-medium leading-5">{source.title}</div>
      <div className="truncate text-xs uppercase tracking-[0.08em] opacity-70">
        {TYPE_LABELS[source.type] ?? source.type}
      </div>
    </div>
  );
}
