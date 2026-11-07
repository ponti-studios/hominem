import { NavLink, Outlet, redirect } from 'react-router';

import { cn } from '~/lib/utils';
import { createCareerServerClient } from '~/modules/career/lib/server-client';

import type { Route } from './+types/layout';

const LINKS = [
  { to: '/career', label: 'Overview', end: true },
  { to: '/career/profile', label: 'Profile' },
  { to: '/career/work', label: 'Work' },
  { to: '/career/projects', label: 'Projects' },
  { to: '/career/skills', label: 'Skills' },
  { to: '/career/testimonials', label: 'Testimonials' },
  { to: '/career/applications', label: 'Applications' },
] as const;

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
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 sm:px-6">
        <nav aria-label="Career" className="min-w-0 flex-1 overflow-x-auto">
          <ul className="flex items-center gap-1 py-1.5">
            {LINKS.map((link) => (
              <li key={link.to}>
                <NavLink
                  className={({ isActive }) =>
                    cn(
                      'inline-flex h-8 items-center rounded-lg px-2.5 font-mono text-xs tracking-wide uppercase transition-colors',
                      isActive
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )
                  }
                  end={'end' in link ? link.end : false}
                  to={link.to}
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
