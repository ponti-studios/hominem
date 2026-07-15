import type { EntityListLinkProps } from '@hominem/ui';
import { Link } from 'react-router';

export function RouterListLink({ href, className, children }: EntityListLinkProps) {
  return (
    <Link to={href} className={className}>
      {children}
    </Link>
  );
}
