import { Hono } from 'hono';

import type { AppContext } from './middleware/auth';
import { requestIdMiddleware } from './middleware/auth';
import { apiErrorHandler } from './middleware/error';
import { validationErrorMiddleware } from './middleware/validation';
import { chatsRoutes } from './routes/chats';
import { filesRoutes } from './routes/files';
import { notesRoutes } from './routes/notes';
import { tasksRoutes } from './routes/tasks';
import { authenticatedVoiceRoutes } from './routes/voice';

export const rpcApp = new Hono<AppContext>()
  .onError(apiErrorHandler)
  .use(requestIdMiddleware)
  .use(validationErrorMiddleware)
  .basePath('/api')
  .route('/chats', chatsRoutes)
  .route('/files', filesRoutes)
  .route('/notes', notesRoutes)
  .route('/tasks', tasksRoutes)
  .route('/voice', authenticatedVoiceRoutes);
