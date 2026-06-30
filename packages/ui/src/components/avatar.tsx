import * as AvatarPrimitive from "@radix-ui/react-avatar";
import type { ClassValue } from "clsx";
import * as React from "react";

import { cn } from "../lib/utils";

type AvatarSize = "sm" | "default" | "lg";

const AvatarContext = React.createContext<{ size: AvatarSize }>({ size: "default" });

const avatarSize: Record<AvatarSize, ClassValue> = {
  sm: "size-6",
  default: "size-6",
  lg: "size-10",
};

const badgeDotSize: Record<AvatarSize, ClassValue> = {
  sm: "size-2",
  default: "size-2.5",
  lg: "size-3",
};

const fallbackText: Record<AvatarSize, ClassValue> = {
  sm: "text-xs",
  default: "text-sm",
  lg: "text-sm",
};

const groupCountSvg: Record<AvatarSize, ClassValue> = {
  sm: "[&>svg]:size-3",
  default: "[&>svg]:size-4",
  lg: "[&>svg]:size-5",
};

function Avatar({
  className,
  size = "default",
  statusBadge = false,
  children,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
  size?: AvatarSize;
  statusBadge?: boolean;
}) {
  return (
    <AvatarContext.Provider value={{ size }}>
      <AvatarPrimitive.Root
        data-slot="avatar"
        className={cn("relative shrink-0 rounded-full select-none", avatarSize[size], className)}
        {...props}
      >
        {children}
        {statusBadge ? (
          <span
            data-slot="avatar-badge"
            className={cn(
              "bg-primary ring-background absolute right-0 bottom-0 z-10 rounded-full ring-2",
              badgeDotSize[size],
            )}
          />
        ) : null}
      </AvatarPrimitive.Root>
    </AvatarContext.Provider>
  );
}

function AvatarImage({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("absolute inset-0 size-full rounded-full object-cover", className)}
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
        "bg-muted text-muted-foreground absolute inset-0 flex items-center justify-center rounded-full",
        fallbackText[size],
        className,
      )}
      {...props}
    />
  );
}

function AvatarGroup({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: AvatarSize }) {
  return (
    <AvatarContext.Provider value={{ size }}>
      <div
        data-slot="avatar-group"
        className={cn(
          "*:data-[slot=avatar]:ring-background flex -space-x-2 *:data-[slot=avatar]:ring-2",
          className,
        )}
        {...props}
      />
    </AvatarContext.Provider>
  );
}

function AvatarGroupCount({ className, ...props }: React.ComponentProps<"div">) {
  const { size } = React.useContext(AvatarContext);

  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "bg-muted text-muted-foreground ring-background relative flex shrink-0 items-center justify-center rounded-full text-sm ring-2",
        avatarSize[size],
        groupCountSvg[size],
        className,
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage };
