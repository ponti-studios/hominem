import { ProactivityDashboard } from '~/components/proactivity/proactivity-dashboard';

export const meta = () => [{ title: 'Proactivity' }];

export default function ProactivityRoute() {
  return (
    <div className="h-full overflow-auto">
      <ProactivityDashboard />
    </div>
  );
}
