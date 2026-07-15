import { getServerAuth as sharedGetServerAuth } from '@hominem/auth/server';
import type { User } from '@hominem/auth/types';

import { serverEnv } from './env';

export type { User };

const getServerAuth = (request: Request) =>
  sharedGetServerAuth(request, { apiBaseUrl: serverEnv().VITE_PUBLIC_API_URL });

export const getServerSession = async (request: Request) => {
  const { user, headers } = await getServerAuth(request);
  return { user, headers };
};
