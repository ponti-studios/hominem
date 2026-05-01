import { LoadingSpinner } from './loading-spinner';

type LoadingSize = 'sm' | 'md' | 'lg' | 'xl';

type LoadingProps = {
  size?: LoadingSize;
};

export function Loading({ size = 'md' }: LoadingProps) {
  return (
    <output data-testid="loading-spinner">
      <LoadingSpinner variant={size} />
      <span className="sr-only">Loading...</span>
    </output>
  );
}

export function LoadingScreen() {
  return (
    <div className="flex items-center justify-center max-h-[300px] mx-auto w-full">
      <Loading size="xl" />
    </div>
  );
}
