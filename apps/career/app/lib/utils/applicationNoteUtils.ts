export function getApplicationNoteTone(type: string): string {
  switch (type) {
    case 'interview':
      return 'border-accent/30 bg-accent/10 text-foreground';
    case 'research':
      return 'border-accent/30 bg-accent/10 text-primary';
    case 'follow_up':
      return 'border-warning/30 bg-warning/10 text-foreground';
    default:
      return 'border-border bg-muted text-muted-foreground';
  }
}
