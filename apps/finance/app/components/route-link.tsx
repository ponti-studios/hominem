import { RouteLink as SharedRouteLink } from '@ponti-studios/ui/navigation';
import type { ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';

import { useRouteLoadingStore } from '../store/route-loading-store';

type RouteLinkProps = LinkProps & { children: ReactNode };

export function RouteLink({ onClick, ...props }: RouteLinkProps) {
  const setIsRouteLoading = useRouteLoadingStore((state) => state.setIsRouteLoading);

  return (
    <SharedRouteLink
      as={Link}
      onNavigate={() => setIsRouteLoading(true)}
      onClick={onClick}
      {...props}
    />
  );
}
