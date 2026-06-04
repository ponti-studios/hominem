import { BarChart3, Briefcase, Code, FolderOpen, Link2, MessageSquare, User } from 'lucide-react';
import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import { Link, Outlet, redirect, useLoaderData, useLocation } from 'react-router';

import { cn } from '~/lib/utils';

import type { FullPortfolio } from '../lib/portfolio.server';
import { getFullUserPortfolio } from '../lib/portfolio.server';
import { withAuthLoader } from '../lib/route-utils';
export const meta: MetaFunction = () => {
  return [
    { title: 'Portfolio Editor | Craftd' },
    {
      name: 'description',
      content: 'Edit and customize your professional portfolio',
    },
  ];
};

export async function loader(args: LoaderFunctionArgs) {
  return withAuthLoader(args, async ({ user }) => {
    const portfolio = await getFullUserPortfolio(user.id);
    if (!portfolio) {
      throw redirect('/onboarding');
    }
    return portfolio;
  });
}

const editorSteps = [
  { path: '/editor', value: 'editor', label: 'Basic Info', icon: User },
  { path: '/editor/work', value: 'work', label: 'Work', icon: Briefcase },
  { path: '/editor/skills', value: 'skills', label: 'Skills', icon: Code },
  { path: '/editor/social', value: 'social', label: 'Social', icon: Link2 },
  { path: '/editor/stats', value: 'stats', label: 'Stats', icon: BarChart3 },
  { path: '/editor/projects', value: 'projects', label: 'Projects', icon: FolderOpen },
  {
    path: '/editor/testimonials',
    value: 'testimonials',
    label: 'Testimonials',
    icon: MessageSquare,
  },
];

export default function EditorLayout() {
  const location = useLocation();
  const portfolio = useLoaderData<FullPortfolio>();

  const currentStepIndex = editorSteps.findIndex((step) => location.pathname.startsWith(step.path));

  return (
    <div className="w-full flex-1 space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Portfolio Editor
        </p>
        <p className="text-sm text-muted-foreground">
          Refine the content and sections that power your public portfolio.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="md:col-span-1">
          <div className="sticky top-6 rounded-md border bg-card p-3">
            <nav className="space-y-0.5">
              {editorSteps.map((step, index) => {
                const is_active = step.value === location.pathname.split('/').pop();
                const isCompleted = index < currentStepIndex;
                const Icon = step.icon;

                return (
                  <Link
                    key={step.path}
                    to={step.path}
                    className={cn(
                      'flex items-center gap-2.5 rounded px-2.5 py-2 text-sm transition-colors',
                      is_active
                        ? 'bg-accent/10 text-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <Icon
                      className={cn(
                        'size-4 shrink-0',
                        is_active
                          ? 'text-primary'
                          : isCompleted
                            ? 'text-success'
                            : 'text-muted-foreground',
                      )}
                    />
                    <span className={is_active ? 'font-medium' : ''}>{step.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="md:col-span-3">
          <Outlet context={portfolio} />
        </div>
      </div>
    </div>
  );
}
