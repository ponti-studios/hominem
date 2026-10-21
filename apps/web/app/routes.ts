import { index, layout, type RouteConfig, route } from '@react-router/dev/routes';

export default [
  route('health', 'routes/health.ts'),

  // Hosted-login shims — the API's hosted /login page owns the OTP surface.
  route('/auth', 'routes/auth/index.tsx'),
  route('/logout', 'routes/auth/logout.tsx'),

  layout('routes/_authenticated.tsx', [
    layout('routes/layout.tsx', [
      index('routes/home.tsx'),
      route('collections', 'routes/collections/collections.tsx'),
      route('collections/:collectionId', 'routes/collections/collections.$collectionId.tsx'),
      route('tasks', 'routes/tasks/tasks.tsx'),
      route('tasks/:taskId', 'routes/tasks/tasks.$taskId.tsx'),
    ]),
    // Redirect-only shims to the API-hosted settings pages — no web layout needed.
    route('settings', 'routes/settings.tsx'),
    route('usage', 'routes/usage.tsx'),
  ]),

  // Catch-all 404 route
  route('*', 'routes/$.tsx'),
] satisfies RouteConfig;
