import { redirect } from 'react-router';

import { serverEnv } from '~/lib/env.server';

// Hand the API our origin so sign-out lands back on its sign-in page for this app.
const logoutUrl = () => {
  const url = new URL('/logout', serverEnv.VITE_PUBLIC_API_URL);
  url.searchParams.set('next', serverEnv.PUBLIC_APP_URL);
  return url.toString();
};

export const action = () => redirect(logoutUrl());
export const loader = () => redirect(logoutUrl());
