import { cn } from "../lib/utils";

interface LoadingSpinnerProps {
  variant?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "loading-size-sm",
  md: "loading-size-md",
  lg: "loading-size-lg",
  xl: "loading-size-xl",
} satisfies Record<NonNullable<LoadingSpinnerProps["variant"]>, string>;

export function LoadingSpinner({ variant = "md" }: LoadingSpinnerProps) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden align-middle",
        sizeClasses[variant],
      )}
      aria-label="Loading"
      role="status"
    >
      <span className="animate-loading-orbit-cw absolute inset-[12%]" aria-hidden="true">
        <span className="bg-accent absolute top-0 left-1/2 size-[16%] -translate-x-1/2 rounded-full shadow-[0_0_12px_rgba(142,141,255,0.45)]" />
        <span className="bg-accent/75 absolute bottom-[10%] left-[12%] size-[11%] rounded-full" />
        <span className="bg-accent/45 absolute top-[34%] right-[12%] size-[11%] rounded-full" />
      </span>
      <span className="animate-loading-orbit-ccw absolute inset-[20%]" aria-hidden="true">
        <span className="bg-accent/85 absolute top-0 left-1/2 size-[11%] -translate-x-1/2 rounded-full" />
        <span className="bg-accent/55 absolute bottom-[6%] left-[18%] size-[8%] rounded-full" />
      </span>
      <span className="bg-accent/15 absolute inset-[39%] rounded-full shadow-[0_0_18px_rgba(142,141,255,0.2)]" />
      <span className="sr-only">Loading...</span>
    </span>
  );
}
