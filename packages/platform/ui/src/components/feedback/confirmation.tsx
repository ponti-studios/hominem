import { AlertTriangle, CheckCircle, HelpCircle, Info } from 'lucide-react';
import type { HTMLAttributes } from 'react';

import { cn } from '../../lib/utils';
import { Button } from '../button';

type ConfirmationType = 'info' | 'success' | 'warning' | 'error' | 'question';

interface ConfirmationBannerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'className'> {
  type?: ConfirmationType;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export function ConfirmationBanner({
  type = 'info',
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  ...props
}: ConfirmationBannerProps) {
  const icons = {
    info: <Info className="size-5" />,
    success: <CheckCircle className="size-5 text-success" />,
    warning: <AlertTriangle className="size-5 text-warning" />,
    error: <AlertTriangle className="size-5 text-destructive" />,
    question: <HelpCircle className="size-5" />,
  };

  const typeStyles = {
    info: 'border-primary/20 bg-primary/5',
    success: 'border-success/20 bg-success/5',
    warning: 'border-warning/20 bg-warning/5',
    error: 'border-destructive/20 bg-destructive/5',
    question: 'border-muted bg-muted/50',
  };

  return (
    <div
      className={cn('flex items-start gap-3 p-4 rounded-md border', typeStyles[type])}
      {...props}
    >
      <div className="mt-0.5">{icons[type]}</div>
      <div className="flex-1">
        <h4 className="text-sm font-medium">{title}</h4>
        {message && <p className="text-xs text-muted-foreground mt-1">{message}</p>}
        <div className="flex gap-2 mt-3">
          <Button type="button" variant="outline" size="xs" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" size="xs" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
