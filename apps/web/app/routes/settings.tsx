import { redirect } from 'react-router';

import { serverEnv } from '~/lib/env.server';

// Account settings live on the API-hosted page; this keeps old /settings links working.
const settingsUrl = new URL('/auth/settings', serverEnv.VITE_PUBLIC_API_URL).toString();

export const loader = () => redirect(settingsUrl);
