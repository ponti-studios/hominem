import { UsagePage } from '~/components/account/usage-page';
import { RouteHeader } from '~/components/route-header';

export const meta = () => [{ title: 'AI usage' }];

export default function UsageRoute() {
  return (
    <div className="h-full overflow-auto">
      <RouteHeader />
      <UsagePage />
    </div>
  );
}
