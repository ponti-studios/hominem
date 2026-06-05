import { cn } from "~/lib/utils";

export interface MetricsGridProps {
  items: Array<{
    label: string;
    value: string;
    tone?: "default" | "success" | "warning" | "accent" | "muted";
  }>;
}

export function MetricsGrid({ items }: MetricsGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-6 md:grid-cols-3",
        getGridColumnsClassName(items.length),
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-md border border-border/50 bg-card p-6"
        >
          <div
            className={cn(
              "text-2xl font-bold",
              getMetricToneClassName(item.tone),
            )}
          >
            {item.value}
          </div>
          <div className="text-sm text-muted-foreground">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

function getMetricToneClassName(
  tone: MetricsGridProps["items"][number]["tone"],
) {
  switch (tone) {
    case "success":
      return "text-success";
    case "warning":
      return "text-warning";
    case "accent":
      return "text-primary";
    case "muted":
      return "text-muted-foreground";
    default:
      return "text-foreground";
  }
}

function getGridColumnsClassName(itemCount: number) {
  if (itemCount >= 6) {
    return "lg:grid-cols-6";
  }

  if (itemCount >= 4) {
    return "lg:grid-cols-4";
  }

  if (itemCount === 3) {
    return "lg:grid-cols-3";
  }

  return "lg:grid-cols-2";
}
