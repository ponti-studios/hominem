import { AuthProvider } from '@hominem/auth/client';
import { COMMON_FONT_LINKS, UpdateGuard } from '@hominem/ui';
import type React from 'react';
import {
  data,
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from 'react-router';

import { WEB_BRAND } from '~/lib/brand';
import { AnalyticsProvider } from '~/lib/posthog';
import { TelemetryProvider } from '~/lib/telemetry';

import type { Route } from './+types/root';

import './globals.css';
import { HonoProvider } from './lib/api';
import { authConfig } from './lib/auth.server';
import { serverEnv } from './lib/env';
import './lib/i18n';

const ICON_VERSION = '20260314';

const NOTES_ICON_LINKS = [
  { rel: 'icon', type: 'image/x-icon', href: `/favicon.ico?v=${ICON_VERSION}` },
  {
    rel: 'icon',
    type: 'image/png',
    sizes: '16x16',
    href: `/icons/favicon-16x16.png?v=${ICON_VERSION}`,
  },
  {
    rel: 'icon',
    type: 'image/png',
    sizes: '32x32',
    href: `/icons/favicon-32x32.png?v=${ICON_VERSION}`,
  },
  {
    rel: 'icon',
    type: 'image/png',
    sizes: '96x96',
    href: `/icons/favicon-96x96.png?v=${ICON_VERSION}`,
  },
  { rel: 'apple-touch-icon', href: `/icons/apple-touch-icon.png?v=${ICON_VERSION}` },
  {
    rel: 'apple-touch-icon',
    sizes: '180x180',
    href: `/icons/apple-touch-icon-180x180.png?v=${ICON_VERSION}`,
  },
  { rel: 'manifest', href: `/manifest.json?v=${ICON_VERSION}` },
] as const;

export async function loader(_: Route.LoaderArgs) {
  return data(
    {
      authEnv: {
        apiBaseUrl: authConfig.apiBaseUrl,
      },
      apiBaseUrl: serverEnv.VITE_PUBLIC_API_URL,
    },
  );
}

export const meta: Route.MetaFunction = () => {
  return [
    { title: WEB_BRAND.meta.title },
    { name: 'description', content: WEB_BRAND.meta.description },
  ];
};

export const links: Route.LinksFunction = () => [...COMMON_FONT_LINKS, ...NOTES_ICON_LINKS];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.ENV = window.ENV || {}; Object.assign(window.ENV, { OTEL_SERVICE_NAME: 'hominem-web', OTEL_DEPLOYMENT_ENVIRONMENT: '${process.env.NODE_ENV || 'development'}', OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318' });`,
          }}
        />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App({ loaderData }: Route.ComponentProps) {
  const { authEnv, apiBaseUrl } = loaderData;

  return (
    <AuthProvider config={authEnv}>
      <HonoProvider baseUrl={apiBaseUrl}>
        <TelemetryProvider>
          <AnalyticsProvider>
            <UpdateGuard logo={WEB_BRAND.logoPath} appName={WEB_BRAND.appName}>
              <Outlet />
            </UpdateGuard>
          </AnalyticsProvider>
        </TelemetryProvider>
      </HonoProvider>
    </AuthProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = 'Oops!';
  let details = 'An unexpected error occurred.';
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : 'Error';
    details =
      error.status === 404 ? 'The requested page could not be found.' : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
