import { Button, StatePanel } from '@hominem/ui';
import type { ReactNode } from 'react';

interface ErrorStateProps {
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
  stack?: ReactNode;
}

export function ErrorState({ title, message, actionLabel, onAction, stack }: ErrorStateProps) {
  return (
    <StatePanel
      title={title}
      description={message}
      actions={<Button onClick={onAction} title={actionLabel} />}
      layout="centered"
    >
      {stack}
    </StatePanel>
  );
}
