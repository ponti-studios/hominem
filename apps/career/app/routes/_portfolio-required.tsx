import { Outlet } from 'react-router';

import { requirePortfolioMiddleware } from '~/lib/middleware';

import type { Route } from './+types/_portfolio-required';

export const middleware: Route.MiddlewareFunction[] = [
  (args, next) => requirePortfolioMiddleware(args, next),
];

export default function PortfolioRequiredLayout() {
  return <Outlet />;
}
