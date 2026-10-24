import { fileStorageService } from '@hominem/storage';
import { logger } from '@hominem/telemetry';

// Rows and chat messages persist the object's old permanent URL. Anything we hand to a client is
// swapped for a short-lived signed one here, so the bucket can stay private. URLs that aren't ours
// (a Google avatar, say) pass through untouched.
export async function signFileUrl(
  url: string,
  file: { mimetype?: string | undefined; originalName?: string | undefined },
): Promise<string> {
  if (!url) return url;
  try {
    return await fileStorageService.signStoredUrl(url, {
      // No known type means no inline rendering: it downloads instead.
      mimetype: file.mimetype ?? 'application/octet-stream',
      ...(file.originalName ? { filename: file.originalName } : {}),
    });
  } catch (error) {
    // Don't take a whole note or chat down because signing hiccuped; the client just gets the
    // stored URL, which only works while the bucket is still public.
    logger.warn('file_url_sign_failed', {
      operation: 'file.sign_url',
      failureType: 'file.storage.failed',
      error_name: error instanceof Error ? error.name : 'unknown',
    });
    return url;
  }
}
