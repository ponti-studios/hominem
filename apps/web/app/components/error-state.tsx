import type { ReactNode } from 'react';

import { StatePanel } from '~/components/surfaces/state-panel';
import { Button } from '~/components/ui/button';

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
      actions={<Button onClick={onAction}>{actionLabel}</Button>}
      layout="centered"
    >
      {stack}
    </StatePanel>
  );
}
