import { fileStorageService, isTestMode } from '@hominem/utils/storage';
import type { TestStorageService } from '@hominem/utils/storage';
import type { Context } from 'hono';
import { Hono } from 'hono';

export const testRoutes = new Hono();

testRoutes.put('/upload/:filePath*', async (c: Context) => {
  if (!isTestMode) {
    return c.json({ error: 'not_found' }, 404);
  }

  const filePath = c.req.param('filePath');
  if (!filePath) {
    return c.json({ error: 'file_path_required' }, 400);
  }

  const body = await c.req.arrayBuffer();
  const buffer = Buffer.from(body);

  try {
    (fileStorageService as unknown as TestStorageService).__testOnlyStoreFile(filePath, buffer);
    return c.json({ success: true, filePath }, 200);
  } catch (error) {
    return c.json(
      {
        error: 'upload_failed',
        message: error instanceof Error ? error.message : 'Upload failed',
      },
      500,
    );
  }
});