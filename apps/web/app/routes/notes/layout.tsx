import { Outlet, data, redirect } from 'react-router';

import { getServerSession } from '~/lib/auth.server';

import type { Route } from './+types/layout';

export async function loader({ request }: Route.LoaderArgs) {
  const { user, headers } = await getServerSession(request);
  if (!user) {
    throw redirect('/auth', { headers });
  }

  return data({ userId: user.id }, { headers });
}

export default function NotesLayout() {
  return (
    <div className="flex flex-col h-full">
      <Outlet />
    </div>
  );
}
