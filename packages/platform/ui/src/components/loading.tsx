type LoadingSize = 'sm' | 'md' | 'lg' | 'xl';

type LoadingProps = {
  size?: LoadingSize;
};

export function Loading({ size = 'md' }: LoadingProps) {
  return (
    <output data-testid="loading-spinner">
      <span
        className={`block border-2 border-border border-t-blue-600 border-r-blue-600 loading-size-${size}`}
      />
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
