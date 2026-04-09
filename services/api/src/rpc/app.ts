import { Hono } from 'hono';

import type { AppContext } from './middleware/auth';
import { requestIdMiddleware } from './middleware/auth';
import { apiErrorHandler } from './middleware/error';
import { validationErrorMiddleware } from './middleware/validation';
import { chatsRoutes } from './routes/chats';
import { filesRoutes, uploadBytesRoute } from './routes/files';
import { notesRoutes } from './routes/notes';
import { authenticatedVoiceRoutes } from './routes/voice';

export const rpcApp = new Hono<AppContext>()
  .onError(apiErrorHandler)
  .use(requestIdMiddleware)
  .use(validationErrorMiddleware)
  .basePath('/api')
  .route('/files/upload-bytes', uploadBytesRoute)
  .route('/chats', chatsRoutes)
  .route('/files', filesRoutes)
  .route('/notes', notesRoutes)
  .route('/voice', authenticatedVoiceRoutes);
