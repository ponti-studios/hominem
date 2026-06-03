import * as AvatarPrimitive from '@radix-ui/react-avatar';
import * as React from 'react';

import { cn } from '../lib/utils';

type AvatarSize = 'sm' | 'default' | 'lg';

const AvatarContext = React.createContext<{ size: AvatarSize }>({ size: 'default' });

const avatarSize: Record<AvatarSize, string> = {
  sm: 'size-6',
  default: 'size-8',
  lg: 'size-10',
};

const badgeSize: Record<AvatarSize, string> = {
  sm: 'size-2 [&>svg]:hidden',
  default: 'size-2.5 [&>svg]:size-2',
  lg: 'size-3 [&>svg]:size-2',
};

const fallbackText: Record<AvatarSize, string> = {
  sm: 'text-xs',
  default: 'text-sm',
  lg: 'text-sm',
};

const groupCountSize: Record<AvatarSize, string> = {
  sm: 'size-6 [&>svg]:size-3',
  default: 'size-8 [&>svg]:size-4',
  lg: 'size-10 [&>svg]:size-5',
};

function Avatar({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & { size?: AvatarSize }) {
  return (
    <AvatarContext.Provider value={{ size }}>
      <AvatarPrimitive.Root
        data-slot="avatar"
        className={cn(
          'relative flex shrink-0 overflow-hidden rounded-full select-none',
          avatarSize[size],
          className,
        )}
        {...props}
      />
    </AvatarContext.Provider>
  );
}

function AvatarImage({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn('aspect-square size-full', className)}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  const { size } = React.useContext(AvatarContext);
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        'bg-muted text-muted-foreground flex size-full items-center justify-center rounded-full',
        fallbackText[size],
        className,
      )}
      {...props}
    />
  );
}

function AvatarBadge({ className, ...props }: React.ComponentProps<'span'>) {
  const { size } = React.useContext(AvatarContext);
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        'bg-primary text-primary-foreground ring-background absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full ring-2 select-none',
        badgeSize[size],
        className,
      )}
      {...props}
    />
  );
}

function AvatarGroup({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<'div'> & { size?: AvatarSize }) {
  return (
    <AvatarContext.Provider value={{ size }}>
      <div
        data-slot="avatar-group"
        className={cn(
          'flex -space-x-2 *:data-[slot=avatar]:ring-background *:data-[slot=avatar]:ring-2',
          className,
        )}
        {...props}
      />
    </AvatarContext.Provider>
  );
}

function AvatarGroupCount({ className, ...props }: React.ComponentProps<'div'>) {
  const { size } = React.useContext(AvatarContext);
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        'bg-muted text-muted-foreground ring-background relative flex shrink-0 items-center justify-center rounded-full text-sm ring-2',
        groupCountSize[size],
        className,
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback, AvatarBadge, AvatarGroup, AvatarGroupCount };
