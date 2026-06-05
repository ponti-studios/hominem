import { data } from 'react-router';

import { getServerSession } from '../../../lib/auth.server';

export async function loader({ request }: { request: Request }) {
  const { user } = await getServerSession(request);

  if (!user) {
    return data({ error: 'Not authenticated' }, { status: 401 });
  }

  return {
    googleTokens: [],
    message: 'Google provider token passthrough is disabled in Better Auth mode.',
  };
}
