import { index, layout, type RouteConfig, route } from '@react-router/dev/routes';

export default [
  // API Routes (specific handlers)
  route('api/auth/google', 'routes/api/auth/google.ts'),

  layout('routes/auth/layout.tsx', [
    route('/auth', 'routes/auth/index.tsx'),
    route('/auth/verify', 'routes/auth/verify.tsx'),
    route('/auth/passkey/callback', 'routes/auth/passkey.callback.tsx'),
  ]),

  layout('routes/layout.tsx', [
    index('routes/home.tsx'),

    route('inbox', 'routes/notes/page.tsx'),
    route('inbox/note/:noteId', 'routes/notes/$noteId.tsx'),
    route('inbox/chat/:chatId', 'routes/chat/chat.$chatId.tsx'),

    // Compatibility redirects
    route('chat', 'routes/redirect-to-inbox.tsx'),
    route('chat/:chatId', 'routes/redirect-chat-detail.tsx'),

    layout('routes/notes/layout.tsx', [
      route('notes', 'routes/redirect-notes-index.tsx'),
      route('notes/:noteId', 'routes/redirect-note-detail.tsx'),
      route('notes/:noteId/edit', 'routes/redirect-note-edit.tsx'),
      route('notes/:noteId/chat', 'routes/redirect-note-chat.tsx'),
    ]),

    route('/account', 'routes/account.tsx'),
    route('/settings/security', 'routes/settings.security.tsx'),

    // Catch-all 404 route
    route('*', 'routes/$.tsx'),
  ]),
] as RouteConfig;
