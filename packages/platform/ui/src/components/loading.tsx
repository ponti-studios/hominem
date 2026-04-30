type LoadingSize = 'sm' | 'md' | 'lg' | 'xl';

type LoadingProps = {
  size?: LoadingSize;
  className?: string;
};

export function Loading({ size = 'md', className }: LoadingProps) {
  return (
    <output data-testid="loading-spinner" className={className}>
      <span className={`block border-2 border-border border-t-blue-600 border-r-blue-600 loading-size-${size}`} />
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
