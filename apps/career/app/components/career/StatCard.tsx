import { Card, CardContent } from '@hominem/ui';

interface StatCardProps {
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export function StatCard({ value, subtitle, trend }: StatCardProps) {
  const subtitleClass =
    trend === 'up'
      ? 'caption1 text-success'
      : trend === 'down'
        ? 'caption1 text-destructive'
        : 'body-4 text-muted-foreground';

  return (
    <Card>
      <CardContent>
        <div className="flex flex-col items-start">
          <p className="heading-2 tabular-nums">{value}</p>
          {subtitle ? <p className={subtitleClass}>{subtitle}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
