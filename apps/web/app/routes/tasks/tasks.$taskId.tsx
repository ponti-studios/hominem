import { RouteHeader } from '~/components/route-header';
import { TaskDetailPage } from '~/components/tasks/task-detail-page';

import type { Route } from './+types/tasks.$taskId';

export const meta = () => [{ title: 'Task' }];

export default function TaskDetailRoute({ params }: Route.ComponentProps) {
  return (
    <div className="h-full overflow-auto">
      <RouteHeader />
      <TaskDetailPage taskId={params.taskId} />
    </div>
  );
}
