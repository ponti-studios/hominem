import { AccountTypeIcon } from '~/modules/finance/components/accounts/account-type-icon';

export function AccountName({ name, type }: { name: string; type: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2" title={`${name} · ${type}`}>
      <AccountTypeIcon type={type} />
      <span className="truncate">{name}</span>
    </span>
  );
}
