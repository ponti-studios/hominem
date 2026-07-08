import { Hono } from 'hono';

import type { AppContext } from '../middleware/auth';
import { chatsRoutes } from './chats';
import { enhanceRoutes } from './enhance';
import { filesRoutes } from './files';
import { financeRoutes } from './finance';
import { inboxRoutes } from './inbox';
import { notesRoutes } from './notes';
import { tasksRoutes } from './tasks';
import { voiceRoutes } from './voice';

export const economyRoutes = new Hono<AppContext>()
  .route('/chats', chatsRoutes)
  .route('/enhance', enhanceRoutes)
  .route('/files', filesRoutes)
  .route('/finance', financeRoutes)
  .route('/inbox', inboxRoutes)
  .route('/notes', notesRoutes)
  .route('/tasks', tasksRoutes)
  .route('/voice', voiceRoutes);
