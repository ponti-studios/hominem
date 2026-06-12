import { Alert, AlertDescription, AlertTitle } from '@hominem/ui';
import { AlertCircle } from 'lucide-react';

import { cn } from '~/lib/utils';

interface FormErrorAlertProps {
  message?: string | null;
  title?: string;
  className?: string;
}

export function FormErrorAlert({
  message,
  title = 'Something went wrong',
  className,
}: FormErrorAlertProps) {
  if (!message) {
    return null;
  }

  return (
    <Alert
      variant="destructive"
      className={cn('border-destructive/30 bg-destructive/10', className)}
    >
      <AlertCircle className="size-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
