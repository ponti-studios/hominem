/**
 * ComposerAttachmentList
 *
 * Subscribes directly to the store's uploadedFiles and uploadErrors slices.
 * Only re-renders when file state changes — not on draft keystrokes.
 * Dispatches REMOVE_FILE directly without callback props.
 */

import { X } from 'lucide-react';
import { memo } from 'react';

import { useComposerSlice, useComposerStore } from './composer-provider';

export const ComposerAttachmentList = memo(function ComposerAttachmentList() {
  const store = useComposerStore();
  const uploadedFiles = useComposerSlice((s) => s.uploadedFiles);
  const uploadErrors = useComposerSlice((s) => s.uploadErrors);

  if (uploadedFiles.length === 0 && uploadErrors.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {uploadedFiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {uploadedFiles.map((file) => (
            <button
              key={file.id}
              type="button"
              onClick={() => store.dispatch({ type: 'REMOVE_FILE', fileId: file.id })}
              aria-label={`Remove ${file.originalName}`}
              className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-2.5 py-2 text-left void-hover [--void-hover-bg:var(--color-background)] [--void-hover-border:var(--color-border-default)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="body-4 min-w-0 max-w-45 truncate text-text-primary">
                {file.originalName}
              </span>
              <X className="size-3 shrink-0 text-text-tertiary" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      {uploadErrors.map((error) => (
        <div
          key={error}
          className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          <span className="size-1.5 shrink-0 rounded-full bg-destructive" aria-hidden="true" />
          <span className="min-w-0">{error}</span>
        </div>
      ))}
    </div>
  );
});
