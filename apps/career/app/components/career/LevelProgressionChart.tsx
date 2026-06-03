interface LevelProgressionChartProps {
  data: Array<{
    level: string;
    duration: number;
    startDate: string;
    endDate?: string;
  }>;
}

export function LevelProgressionChart({ data }: LevelProgressionChartProps) {
  if (data.length === 0) return null;

  return (
    <div className="space-y-6">
      {data.map((level, index) => (
        <div key={`level-${level.level}-${index}`} className="relative">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-lg font-medium text-foreground font-sans capitalize">
              {level.level.replace('-', ' ')}
            </h4>
            <span className="text-sm text-muted-foreground font-sans">{level.duration} months</span>
          </div>
          <div className="bg-muted rounded-lg h-2 overflow-hidden">
            <div
              className="h-full rounded-lg bg-accent"
              style={{ width: `${Math.min((level.duration / 36) * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-muted-foreground font-sans">
            <span>{new Date(level.startDate).toLocaleDateString()}</span>
            {level.endDate && <span>{new Date(level.endDate).toLocaleDateString()}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
