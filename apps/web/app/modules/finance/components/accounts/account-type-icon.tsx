import { Building2, CreditCard } from 'lucide-react';

export function AccountTypeIcon({
  type,
  className = 'size-4',
}: {
  type: string;
  className?: string;
}) {
  const Icon = type.toLowerCase() === 'credit' ? CreditCard : Building2;

  return <Icon className={className} aria-hidden />;
}
