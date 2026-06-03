export function getStatusColor(status: string) {
  switch (status) {
    case 'APPLIED':
      return 'border-accent/30 bg-accent/10 text-foreground';
    case 'PHONE_SCREEN':
      return 'border-warning/30 bg-warning/10 text-foreground';
    case 'INTERVIEW':
      return 'border-accent/30 bg-accent/10 text-foreground';
    case 'OFFER':
      return 'border-success/30 bg-success/10 text-foreground';
    case 'ACCEPTED':
      return 'border-success/40 bg-success/15 text-foreground';
    case 'REJECTED':
      return 'border-destructive/30 bg-destructive/10 text-foreground';
    case 'WITHDRAWN':
      return 'bg-muted text-foreground';
    default:
      return 'bg-muted text-foreground';
  }
}
