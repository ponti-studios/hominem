import { Outlet, data } from 'react-router';

import { AppHeader } from '~/components/app-header';
import { TooltipProvider } from '~/components/ui/tooltip';
import { userContext } from '~/lib/middleware';

import type { Route } from './+types/layout';

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  return data({ user });
}

export default function Layout({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;

  return (
    <TooltipProvider>
      <div className="flex h-[100svh] min-h-[100svh] w-full flex-col overflow-hidden bg-background text-foreground">
        {user ? <AppHeader user={user} /> : null}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Outlet />
        </div>
      </div>
    </TooltipProvider>
  );
}
