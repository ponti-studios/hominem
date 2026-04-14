export { AttachedNotesList } from './attached-notes-list';
export { Composer } from './composer';
export type { ComposerProps } from './composer';
export { ComposerActionsRow } from './composer-actions-row';
export { ComposerAttachmentList } from './composer-attachment-list';
export { ComposerShell } from './composer-shell';
export { ComposerTools } from './composer-tools';
export { NotePickerDialog } from './note-picker-dialog';
export { VoiceDialog } from './voice-dialog';

export {
  ComposerProvider,
  ComposerStore,
  INITIAL_COMPOSER_STATE,
  useComposerActionsRef,
  useComposerSlice,
  useComposerStore,
} from './composer-provider';
export type {
  ComposerAction,
  ComposerActions,
  ComposerMode,
  ComposerProviderProps,
  ComposerState,
} from './composer-provider';

export { buildNoteContext, resolveComposerActions, toNoteTitle } from './composer-actions';
export type { ResolveComposerActionsInput, ResolvedComposerActions } from './composer-actions';

export { deriveComposerPresentation } from './composer-presentation';
export type { ComposerPosture, ComposerPresentation } from './composer-presentation';

export {
  appendChatAttachmentContext,
  appendNoteAttachments,
  formatNoteAttachmentsSection,
  formatUploadedFileContext,
} from './composer-attachments';

export {
  COMPOSER_RESTING_HEIGHT,
  MOBILE_EXPANDED_HEIGHT_VH,
  PILL_HEIGHT,
  playSwipeSnap,
} from './animations';
export { useSwipeGesture } from './mobile-gestures';
