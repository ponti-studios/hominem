import { UserPlus } from 'lucide-react';

import { StatePanel } from '../surfaces';

export function InvitesEmptyState() {
  return (
    <StatePanel
      icon={<UserPlus className="size-8 text-primary" />}
      title="No invitations yet"
      description="Use the form above to invite others to collaborate on this list."
      variant="dashed"
      className="p-6 md:p-12"
    />
  );
}
