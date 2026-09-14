import { RouteHeader } from '~/components/route-header';
import { TasksPage } from '~/components/tasks/tasks-page';

import type { Route } from './+types/tasks';

export const meta = () => [{ title: 'Tasks' }];

// eslint-disable-next-line no-unused-vars -- route module signature requires the typed props param, matches routes/usage.tsx
export default function TasksRoute(_: Route.ComponentProps) {
  return (
    <div className="h-full overflow-auto">
      <RouteHeader />
      <TasksPage />
    </div>
  );
}
