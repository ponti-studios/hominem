import { Card, CardContent } from '@hominem/ui/card';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
}

export function StatCard({ title, value, subtitle, trend, icon }: StatCardProps) {
  const trendColors = {
    up: 'text-emerald-600',
    down: 'text-red-500',
    neutral: 'text-muted-foreground',
  };

  return (
    <Card className="border-border bg-card  transition-colors hover:border-primary/30">
      <CardContent className="flex items-start justify-between gap-4 p-6">
        <div className="flex-1">
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </h3>
          <p className="mt-2 text-3xl font-semibold text-foreground md:text-4xl">{value}</p>
          {subtitle ? (
            <p className={`mt-2 text-sm ${trend ? trendColors[trend] : 'text-muted-foreground'}`}>
              {subtitle}
            </p>
          ) : null}
        </div>
        {icon ? <div className="text-muted-foreground/70">{icon}</div> : null}
      </CardContent>
    </Card>
  );
}
