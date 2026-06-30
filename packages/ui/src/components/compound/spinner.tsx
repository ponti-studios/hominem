import * as React from "react";
import { cn } from "../../lib/utils";

export interface SpinnerProps extends React.ComponentProps<"div"> {
  label?: string | false;
}

export function Spinner({ label = "Loading", className, ...props }: SpinnerProps) {
  return (
    <div
      className={cn("flex items-center justify-center gap-2 py-12", className)}
      role="status"
      aria-label={label || "Loading"}
      {...props}
    >
      <div className="border-border border-t-muted-foreground h-3 w-3 animate-spin rounded-full border-2" />
      {label && <span className="text-muted-foreground text-xs">{label}</span>}
    </div>
  );
}
