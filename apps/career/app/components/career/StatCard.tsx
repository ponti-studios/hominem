import { Card, CardContent } from '@hominem/ui/card';

interface StatCardProps {
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export function StatCard({ value, subtitle, trend }: StatCardProps) {
  const subtitleClass =
    trend === 'up'
      ? 'text-xs text-emerald-600'
      : trend === 'down'
        ? 'text-xs text-red-500'
        : 'text-xs text-muted-foreground';

  return (
    <Card>
      <CardContent>
        <div className="flex flex-col items-start">
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          {subtitle ? <p className={subtitleClass}>{subtitle}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
