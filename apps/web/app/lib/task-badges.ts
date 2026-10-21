const taskDateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
});

export const taskPriorityVariant: Record<string, 'destructive' | 'secondary' | 'outline'> = {
  high: 'destructive',
  medium: 'secondary',
  low: 'outline',
};

export function formatTaskDate(value: string) {
  return taskDateFormatter.format(new Date(value));
}
