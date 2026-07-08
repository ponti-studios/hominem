import type { CareerJobApplicationRecord as ApplicationWithCompany } from '@hominem/db';
import { useOutletContext } from 'react-router';

import { ApplicationFilesTab } from '~/components/career';

export default function ApplicationFilesRoute() {
  const application = useOutletContext<ApplicationWithCompany>();
  return <ApplicationFilesTab application={application} />;
}
