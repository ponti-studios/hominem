import { index, layout, type RouteConfig, route } from '@react-router/dev/routes';

export default [
  // API Routes (specific handlers)
  route('api/auth/google', 'routes/api.auth.google.ts'),


  layout('routes/layout.tsx', [
    index('routes/home.tsx'),

    route('/auth', 'routes/login.tsx'),
    route('inbox', 'routes/inbox.tsx'),
    route('note/:noteId', 'routes/note.$noteId.tsx'),
    route('chat/:chatId', 'routes/chat.$chatId.tsx'),

    route('/account', 'routes/account.tsx'),
    route('/settings/security', 'routes/settings.security.tsx'),

    // Catch-all 404 route
    route('*', 'routes/$.tsx'),
  ]),
] as RouteConfig;
