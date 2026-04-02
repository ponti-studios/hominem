import { Hono } from 'hono';

import type { AppContext } from '../middleware/auth';
import { chatsRoutes } from './chats';

export const socialRoutes = new Hono<AppContext>().route('/chats', chatsRoutes);
