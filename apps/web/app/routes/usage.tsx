import { redirect } from 'react-router';

import { serverEnv } from '~/lib/env.server';

// AI usage lives on the API-hosted page; this keeps old /usage links working.
const usageUrl = new URL('/auth/settings/ai', serverEnv.VITE_PUBLIC_API_URL).toString();

export const loader = () => redirect(usageUrl);
