import { useNavigation } from 'react-router';

/**
 * Route changes show a progress line while the next route loads.
 * Keep the page itself still so large, data-heavy screens do not animate as one surface.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const navigation = useNavigation();
  const loading = navigation.state !== 'idle';

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-30 h-[2px] overflow-hidden"
      >
        {loading ? <div className="route-bar h-full w-1/3" /> : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
