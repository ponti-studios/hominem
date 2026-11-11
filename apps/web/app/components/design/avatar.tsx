import { cn } from '~/lib/utils';

type InitialsAvatarProps = {
  name: string;
  size?: 'sm' | 'md';
  className?: string;
};

/** Initials avatar with the shared monochrome identity treatment. */
export function InitialsAvatar({ name, size = 'sm', className }: InitialsAvatarProps) {
  const source = name.trim();
  const parts = source.split(/\s+/).filter(Boolean);
  const initials =
    parts.length > 1
      ? `${parts[0]?.[0] ?? ''}${parts.at(-1)?.[0] ?? ''}`.toUpperCase()
      : (parts[0]?.slice(0, 2).toUpperCase() ?? '?');
  return (
    <span
      aria-hidden
      className={cn(
        'flex items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground',
        size === 'sm' ? 'size-6 text-xs' : 'size-9 text-sm',
        className,
      )}
    >
      {initials}
    </span>
  );
}
