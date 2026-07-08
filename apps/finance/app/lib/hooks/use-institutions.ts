import type { InstitutionsListOutput } from '@hominem/rpc/finance';

import { useHonoQuery } from '~/lib/api';

export const useAllInstitutions = () =>
  useHonoQuery<InstitutionsListOutput>(['finance', 'institutions', 'list'], ({ finance }) =>
    finance.listInstitutions(),
  );
