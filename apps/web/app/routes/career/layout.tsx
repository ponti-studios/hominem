import { Outlet, redirect } from 'react-router';

import { Container } from '~/components/design/container';
import { AppNavLink } from '~/components/shell/app-nav-link';
import { DOMAINS } from '~/domains';
import { createCareerServerClient } from '~/modules/career/lib/server-client';

import type { Route } from './+types/layout';

const CAREER = DOMAINS.find((d) => d.id === 'career');

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
      <div className="glass flex shrink-0 items-center gap-3 border-b border-white/[0.06] px-4 sm:px-6">
        <nav aria-label="Career" className="min-w-0 flex-1 overflow-x-auto">
          <ul className="flex items-center gap-1 py-2">
            {CAREER?.subNav.map((link) => (
              <li key={link.path} className="shrink-0">
                <AppNavLink
                  accent={CAREER.accent}
                  end={link.end}
                  label={link.label}
                  prefetch="intent"
                  to={link.path}
                  variant="pill"
                />
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <Container size="lg">
          <Outlet />
        </Container>
      </div>
    </div>
  );
}
