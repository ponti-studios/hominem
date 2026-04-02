import { Hono } from 'hono';

import type { AppContext } from '../middleware/auth';
import { filesRoutes } from './files';
import { notesRoutes } from './notes';
export const knowledgeRoutes = new Hono<AppContext>()
  .route('/notes', notesRoutes)
  .route('/files', filesRoutes);
