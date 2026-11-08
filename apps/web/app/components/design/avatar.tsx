import { cn } from '~/lib/utils';

type InitialsAvatarProps = {
  name: string;
  size?: 'sm' | 'md';
  className?: string;
};

/** Signature gradient avatar. One identity mark across menus and lists. */
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
        'flex items-center justify-center rounded-full font-semibold text-[#101300]',
        size === 'sm' ? 'size-6 text-xs' : 'size-9 text-sm',
        className,
      )}
      style={{
        background: 'linear-gradient(135deg, #d7ff3e, #5eead4)',
        boxShadow: '0 0 16px -2px rgb(215 255 62 / 0.5)',
      }}
    >
      {initials}
    </span>
  );
}
