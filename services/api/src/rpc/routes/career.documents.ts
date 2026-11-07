import { ValidationError } from '@hominem/db/errors';
import { Hono } from 'hono';
import { z } from 'zod';

import {
  deleteCareerDocument,
  listCareerDocuments,
  storeCareerDocument,
} from '../../application/career-documents.service';
import { authMiddleware, type AppContext } from '../middleware/auth';

const documentSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string(),
  size: z.number(),
  lastModified: z.string().nullable(),
});

const documentsOutputSchema = z.object({ documents: z.array(documentSchema) });

export const careerDocumentsRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .get('/', async (c) => {
    const documents = await listCareerDocuments(c.get('auth')!.userId);
    return c.json(documentsOutputSchema.parse({ documents }));
  })
  .post('/', async (c) => {
    const formData = await c.req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      throw new ValidationError('Choose a document to upload.');
    }
    const stored = await storeCareerDocument(c.get('auth')!.userId, file);
    return c.json({ document: { ...stored, displayName: stored.name, lastModified: null } });
  })
  .delete('/:id', async (c) => {
    const deleted = await deleteCareerDocument(c.get('auth')!.userId, c.req.param('id'));
    return c.json({ deleted });
  });
