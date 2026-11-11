export function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 p-4">
      <h3 className="min-w-0 text-base leading-6 font-semibold text-foreground">{title}</h3>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}
