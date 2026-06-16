interface LevelProgressionChartProps {
  data: Array<{
    level: string;
    duration: number;
    start_date: string;
    end_date?: string;
  }>;
}

export function LevelProgressionChart({ data }: LevelProgressionChartProps) {
  if (data.length === 0) return null;

  return (
    <div className="space-y-6">
      {data.map((level, index) => (
        <div key={`level-${level.level}-${index}`} className="relative">
          <div className="flex items-center justify-between mb-2">
            <h4 className="heading-3 text-foreground capitalize">
              {level.level.replace('-', ' ')}
            </h4>
            <span className="body-3 text-muted-foreground">{level.duration} months</span>
          </div>
          <div className="bg-muted rounded-lg h-2 overflow-hidden">
            <div
              className="h-full rounded-lg bg-accent"
              style={{ width: `${Math.min((level.duration / 36) * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 body-4 text-muted-foreground">
            <span>{new Date(level.start_date).toLocaleDateString()}</span>
            {level.end_date && <span>{new Date(level.end_date).toLocaleDateString()}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
