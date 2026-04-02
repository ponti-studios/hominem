import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import {
  CreateNoteInputSchema,
  NotesListQuerySchema,
  UpdateNoteInputSchema,
} from '../schemas/notes.schema';
import type { Note } from '../types/notes.types';

const stub = () => new Response(null);

const chatsContract = new Hono()
  .get('/', stub)
  .post('/', stub)
  .get('/:id', stub)
  .get('/:id/messages', stub)
  .post('/:id/send', stub)
  .post('/:id/archive', stub);

const filesContract = new Hono()
  .post('/prepare-upload', stub)
  .post('/complete-upload', stub)
  .delete('/:fileId', stub);

const messagesContract = new Hono().patch('/:messageId', stub).delete('/:messageId', stub);

const mobileContract = new Hono()
  .route('/intents', new Hono().get('/suggestions', stub))
  .route('/voice', new Hono().post('/speech', stub));

const voiceContract = new Hono().post('/speech', stub);

const notesContract = new Hono()
  // List notes — query params typed via NotesListQuerySchema
  .get('/', zValidator('query', NotesListQuerySchema), (c) => {
    return c.json({ notes: [] as Note[] });
  })
  .get('/search', stub)
  // Create note
  .post('/', zValidator('json', CreateNoteInputSchema), (c) => {
    return c.json({} as Note, 201 as const);
  })
  // Get single note
  .get('/:id', (c) => {
    return c.json({} as Note);
  })
  // Update note
  .patch('/:id', zValidator('json', UpdateNoteInputSchema), (c) => {
    return c.json({} as Note);
  })
  // Delete note
  .delete('/:id', (c) => {
    return c.json({} as Note);
  })
  // Archive note
  .post('/:id/archive', (c) => {
    return c.json({} as Note);
  });

const focusContract = new Hono().get('/', stub);

const reviewContract = new Hono()
  .post('/:reviewItemId/accept', stub)
  .post('/:reviewItemId/reject', stub);

export const app = new Hono()
  .basePath('/api')
  .route('/chats', chatsContract)
  .route('/files', filesContract)
  .route('/focus', focusContract)
  .route('/messages', messagesContract)
  .route('/mobile', mobileContract)
  .route('/notes', notesContract)
  .route('/review', reviewContract)
  .route('/voice', voiceContract);
