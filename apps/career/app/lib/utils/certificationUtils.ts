import type { Certification } from '~/types/career-data';

export function getCertificationStatusClasses(status: Certification['status']): string {
  switch (status) {
    case 'active':
      return 'border-success/30 bg-success/10 text-foreground';
    case 'expired':
      return 'border-destructive/30 bg-destructive/10 text-foreground';
    case 'pending_renewal':
      return 'bg-amber-100 text-amber-800';
    case 'archived':
      return 'bg-muted text-foreground';
    default:
      return 'bg-muted text-foreground';
  }
}

export function formatCertificationStatus(status: Certification['status']): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}
