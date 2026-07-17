import { Link } from 'react-router';

import { EntityListLinkProps } from '~/components/patterns';

export function RouterListLink({ href, className, children }: EntityListLinkProps) {
  return (
    <Link to={href} className={className}>
      {children}
    </Link>
  );
}
