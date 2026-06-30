import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as React from "react";

import { cn } from "../lib/utils";

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default";
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "void-focus peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input inline-flex shrink-0 items-center rounded-full border border-transparent p-px outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:justify-end data-[state=unchecked]:justify-start",
        size === "default" ? "h-[1.15rem] w-8" : "h-3.5 w-6",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        data-size={size}
        className={cn(
          "bg-background pointer-events-none block rounded-full ring-0 transition-all",
          size === "default" ? "size-4" : "size-3",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
