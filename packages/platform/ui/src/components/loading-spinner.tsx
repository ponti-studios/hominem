interface LoadingSpinnerProps {
  variant?: 'sm' | 'md' | 'lg' | 'xl';
}

export function LoadingSpinner({ variant = 'md' }: LoadingSpinnerProps) {
  return (
    <span
      aria-label="Loading"
      className={`block animate-spin rounded-full border-2 border-border border-r-primary border-t-primary loading-size-${variant}`}
      role="status"
    />
  );
}
