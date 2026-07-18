import { StatusBadge, type StatusBadgeConfig } from '@ponti-studios/ui/primitives';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';

type PlaidConnectionStatus = 'active' | 'error' | 'pending_expiration' | 'revoked';

const PLAID_STATUS_CONFIG: Record<PlaidConnectionStatus, StatusBadgeConfig> = {
  active: {
    label: 'Active',
    variant: 'default',
    className: 'bg-muted text-foreground border-border',
    icon: <CheckCircle className="size-3 mr-1" />,
  },
  error: {
    label: 'Error',
    variant: 'destructive',
    icon: <AlertCircle className="size-3 mr-1" />,
  },
  pending_expiration: {
    label: 'Expiring Soon',
    variant: 'secondary',
    className: 'bg-warning-subtle text-warning border-warning-subtle',
    icon: <Clock className="size-3 mr-1" />,
  },
  revoked: {
    label: 'Revoked',
    variant: 'outline',
    className: 'text-muted-foreground',
  },
};

export function PlaidStatusBadge({ status }: { status: string | null }) {
  return (
    <StatusBadge
      status={status as PlaidConnectionStatus | null}
      config={PLAID_STATUS_CONFIG}
      fallback={{ label: 'Unknown', variant: 'outline' }}
    />
  );
}
