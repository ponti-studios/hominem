import { Hono } from 'hono';

import type { AppContext } from '../middleware/auth';
import { authenticatedVoiceRoutes } from './voice';

export const systemRoutes = new Hono<AppContext>().route('/voice', authenticatedVoiceRoutes);
