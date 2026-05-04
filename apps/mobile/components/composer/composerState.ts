import type { NoteSearchResult } from '@hominem/rpc/types';

import type { UploadedFile } from '~/types/upload';

export interface ComposerAttachment {
  id: string;
  name: string;
  type: string;
  localUri?: string;
  uploadedFile?: UploadedFile;
}

export interface ComposerDraft {
  text: string;
  attachments: ComposerAttachment[];
  selectedNotes: NoteSearchResult[];
}
