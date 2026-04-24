import type { NoteSearchResult } from '@hominem/rpc/types';

import type { UploadedFile } from '~/types/upload';

export type ComposerMode = 'text' | 'voice';

export interface ComposerAttachment {
  id: string;
  name: string;
  type: string;
  localUri?: string;
  uploadedFile?: UploadedFile;
}

export type ComposerSelectedNote = NoteSearchResult;

export interface ComposerDraft {
  text: string;
  attachments: ComposerAttachment[];
  selectedNotes: ComposerSelectedNote[];
}

export function createEmptyComposerDraft(): ComposerDraft {
  return {
    text: '',
    attachments: [],
    selectedNotes: [],
  };
}
