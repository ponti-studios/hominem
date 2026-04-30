import { cn } from '../lib/utils';

interface LoadingSpinnerProps {
  variant?: 'sm' | 'md' | 'lg' | 'xl';
}

export function LoadingSpinner({ variant = 'md' }: LoadingSpinnerProps) {
  return <div className={cn('border-b-2 border-foreground', `loading-size-${variant}`)} />;
}
