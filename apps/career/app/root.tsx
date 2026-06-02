import { AuthProvider } from '@hominem/auth/client/provider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { LoaderFunctionArgs } from 'react-router';
import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from 'react-router';

import Navigation from './components/Navigation';

import './app.css';
import { ToastProvider } from './hooks/useToast';
import { getAuthenticatedUser } from './lib/auth.server';

export const links = () => [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap',
  },
  // Favicon
  { rel: 'icon', type: 'image/x-icon', href: '/icons/favicon.ico' },
  { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/icons/favicon-16x16.png' },
  { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/icons/favicon-32x32.png' },
  { rel: 'icon', type: 'image/png', sizes: '96x96', href: '/icons/favicon-96x96.png' },

  // Apple Touch Icons
  { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
  { rel: 'apple-touch-icon', sizes: '57x57', href: '/icons/apple-touch-icon-57x57.png' },
  { rel: 'apple-touch-icon', sizes: '60x60', href: '/icons/apple-touch-icon-60x60.png' },
  { rel: 'apple-touch-icon', sizes: '72x72', href: '/icons/apple-touch-icon-72x72.png' },
  { rel: 'apple-touch-icon', sizes: '76x76', href: '/icons/apple-touch-icon-76x76.png' },
  { rel: 'apple-touch-icon', sizes: '114x114', href: '/icons/apple-touch-icon-114x114.png' },
  { rel: 'apple-touch-icon', sizes: '120x120', href: '/icons/apple-touch-icon-120x120.png' },
  { rel: 'apple-touch-icon', sizes: '144x144', href: '/icons/apple-touch-icon-144x144.png' },
  { rel: 'apple-touch-icon', sizes: '152x152', href: '/icons/apple-touch-icon-152x152.png' },
  { rel: 'apple-touch-icon', sizes: '180x180', href: '/icons/apple-touch-icon-180x180.png' },

  // Android Icons
  { rel: 'icon', type: 'image/png', sizes: '36x36', href: '/icons/android-icon-36x36.png' },
  { rel: 'icon', type: 'image/png', sizes: '48x48', href: '/icons/android-icon-48x48.png' },
  { rel: 'icon', type: 'image/png', sizes: '72x72', href: '/icons/android-icon-72x72.png' },
  { rel: 'icon', type: 'image/png', sizes: '96x96', href: '/icons/android-icon-96x96.png' },
  {
    rel: 'icon',
    type: 'image/png',
    sizes: '144x144',
    href: '/icons/android-icon-144x144.png',
  },
  {
    rel: 'icon',
    type: 'image/png',
    sizes: '192x192',
    href: '/icons/android-icon-192x192.png',
  },

  // Web Manifest
  { rel: 'manifest', href: '/manifest.json' },
];

export const meta = () => [
  // Theme Color
  { name: 'theme-color', content: '#ffffff' },

  // Microsoft Tile Icons
  { name: 'msapplication-TileColor', content: '#ffffff' },
  { name: 'msapplication-TileImage', content: '/icons/ms-icon-144x144.png' },
  { name: 'msapplication-square70x70logo', content: '/icons/ms-icon-70x70.png' },
  { name: 'msapplication-square150x150logo', content: '/icons/ms-icon-150x150.png' },
  { name: 'msapplication-square310x310logo', content: '/icons/ms-icon-310x310.png' },

  // Social Media / OpenGraph
  { property: 'og:image', content: '/icons/og-image.jpg' },
  { property: 'og:image:width', content: '1200' },
  { property: 'og:image:height', content: '630' },

  // Twitter Card
  { name: 'twitter:card', content: 'summary_large_image' },
  { name: 'twitter:image', content: '/icons/twitter-card.jpg' },
];

const API_URL = process.env.VITE_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3000';

// Root loader to get authenticated user
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getAuthenticatedUser(request);
  return { user, apiBaseUrl: API_URL };
}

// Add route handle to enable accessing loader data from child routes
export const handle = {
  id: 'root',
};

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// Instantiate a single QueryClient for the app
const queryClient = new QueryClient();

export default function App({ loaderData }: { loaderData: { apiBaseUrl: string; user: unknown } }) {
  const { apiBaseUrl } = loaderData;
  return (
    <AuthProvider config={{ apiBaseUrl }}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <div className="flex flex-col min-h-screen overflow-hidden">
            <Navigation />
            <div className="w-full max-w-6xl mx-auto font-sans mt-24 pt-8 flex-1 flex flex-col">
              <Outlet />
            </div>
          </div>
        </ToastProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  if (isRouteErrorResponse(error)) {
    const err = error;
    if (err.status === 404) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-linear-to-br from-blue-50 via-white to-purple-50">
          <h1 className="text-9xl font-extrabold text-gray-900">404</h1>
          <p className="mt-4 text-2xl text-gray-700">Page Not Found</p>
          <Link
            to="/"
            className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Home
          </Link>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-red-50">
        <h1 className="text-6xl font-bold text-red-900">{err.status}</h1>
        <p className="mt-2 text-xl text-red-700">{err.statusText}</p>
        <Link to="/" className="mt-6 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700">
          Go Home
        </Link>
      </div>
    );
  }
  const isDev = import.meta.env.DEV;
  const message = isDev && error instanceof Error ? error.message : 'An unexpected error occurred.';
  const stack = isDev && error instanceof Error ? error.stack : null;
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">Oops!</h1>
      <p className="text-gray-700 mb-4">{message}</p>
      {stack && (
        <pre className="w-full max-w-2xl max-h-48 border border-red-200 p-4 bg-white rounded shadow overflow-auto text-sm text-gray-800 mb-4">
          {stack}
        </pre>
      )}
      <Link to="/" className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
        Go Home
      </Link>
    </div>
  );
}
