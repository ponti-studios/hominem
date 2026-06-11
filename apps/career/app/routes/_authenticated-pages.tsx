import { Outlet } from 'react-router';

import { loadPortfolioMiddleware } from '~/lib/middleware';

import type { Route } from './+types/_authenticated-pages';

export const middleware: Route.MiddlewareFunction[] = [
  (args, next) => loadPortfolioMiddleware(args, next),
];

export default function AuthenticatedPagesLayout() {
  return <Outlet />;
}
