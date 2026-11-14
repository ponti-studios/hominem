import { Outlet, redirect } from 'react-router';

import { Container } from '~/components/design/container';
import { createCareerServerClient } from '~/modules/career/lib/server-client';

import type { Route } from './+types/layout';

export const meta = () => [{ title: 'Career' }];

export async function loader({ request }: Route.LoaderArgs) {
  const response = await createCareerServerClient(request).profile.detail.$get();
  const profile = response.ok ? (await response.json()).profile : null;
  const path = new URL(request.url).pathname;

  if (!profile && path !== '/career' && !path.startsWith('/career/onboarding')) {
    throw redirect('/career/onboarding');
  }

  return { hasProfile: Boolean(profile) };
}

export default function CareerLayout() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-auto">
        <Container size="lg">
          <Outlet />
        </Container>
      </div>
    </div>
  );
}
