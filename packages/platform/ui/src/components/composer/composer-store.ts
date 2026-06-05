/**
 * ComposerStore
 *
 * All composer state lives outside React in a plain observable class.
 * Components subscribe via useSyncExternalStore with fine-grained selectors —
 * only the subscribing component re-renders when its slice changes.
 *
 * The reducer is a pure function — testable with zero React.
 */

import type { Note } from '@hominem/rpc/types/notes.types';

import type { UploadedFile } from '../../types/upload';

export interface ComposerState {
  readonly draft: string;
  readonly attachedNotes: ReadonlyArray<Note>;
  readonly uploadedFiles: ReadonlyArray<UploadedFile>;
  readonly isEnhanceOpen: boolean;
  readonly enhanceInstruction: string;
  readonly isEnhancing: boolean;
  readonly enhanceError: string | null;
  readonly isUploading: boolean;
  readonly uploadProgress: number;
  readonly uploadErrors: ReadonlyArray<string>;
}

export const INITIAL_COMPOSER_STATE: ComposerState = {
  draft: '',
  attachedNotes: [],
  uploadedFiles: [],
  isEnhanceOpen: false,
  enhanceInstruction: '',
  isEnhancing: false,
  enhanceError: null,
  isUploading: false,
  uploadProgress: 0,
  uploadErrors: [],
};

export type ComposerAction =
  | { type: 'SET_DRAFT'; text: string }
  | { type: 'CLEAR_DRAFT' }
  | { type: 'ATTACH_NOTE'; note: Note }
  | { type: 'DETACH_NOTE'; noteId: string }
  | { type: 'CLEAR_NOTES' }
  | { type: 'ADD_FILES'; files: ReadonlyArray<UploadedFile> }
  | { type: 'REMOVE_FILE'; fileId: string }
  | { type: 'CLEAR_FILES' }
  | { type: 'SET_ENHANCE_OPEN'; isOpen: boolean }
  | { type: 'SET_ENHANCE_INSTRUCTION'; instruction: string }
  | { type: 'SET_ENHANCING'; isEnhancing: boolean }
  | { type: 'SET_ENHANCE_ERROR'; error: string | null }
  | { type: 'RESET_ENHANCE' }
  | { type: 'SET_UPLOADING'; isUploading: boolean; progress?: number }
  | { type: 'SET_UPLOAD_ERRORS'; errors: ReadonlyArray<string> }
  | { type: 'CLEAR' };

function reduceComposerState(state: ComposerState, action: ComposerAction): ComposerState {
  switch (action.type) {
    case 'SET_DRAFT':
      return state.draft === action.text ? state : { ...state, draft: action.text };
    case 'CLEAR_DRAFT':
      return state.draft === '' ? state : { ...state, draft: '' };
    case 'ATTACH_NOTE':
      return state.attachedNotes.some((n) => n.id === action.note.id)
        ? state
        : { ...state, attachedNotes: [...state.attachedNotes, action.note] };
    case 'DETACH_NOTE':
      return {
        ...state,
        attachedNotes: state.attachedNotes.filter((n) => n.id !== action.noteId),
      };
    case 'CLEAR_NOTES':
      return state.attachedNotes.length === 0 ? state : { ...state, attachedNotes: [] };
    case 'ADD_FILES':
      return { ...state, uploadedFiles: [...state.uploadedFiles, ...action.files] };
    case 'REMOVE_FILE':
      return {
        ...state,
        uploadedFiles: state.uploadedFiles.filter((f) => f.id !== action.fileId),
      };
    case 'CLEAR_FILES':
      return state.uploadedFiles.length === 0 ? state : { ...state, uploadedFiles: [] };
    case 'SET_ENHANCE_OPEN':
      return state.isEnhanceOpen === action.isOpen
        ? state
        : {
            ...state,
            isEnhanceOpen: action.isOpen,
            enhanceError: action.isOpen ? state.enhanceError : null,
          };
    case 'SET_ENHANCE_INSTRUCTION':
      return state.enhanceInstruction === action.instruction
        ? state
        : { ...state, enhanceInstruction: action.instruction };
    case 'SET_ENHANCING':
      return state.isEnhancing === action.isEnhancing
        ? state
        : { ...state, isEnhancing: action.isEnhancing };
    case 'SET_ENHANCE_ERROR':
      return state.enhanceError === action.error ? state : { ...state, enhanceError: action.error };
    case 'RESET_ENHANCE':
      return {
        ...state,
        isEnhanceOpen: false,
        enhanceInstruction: '',
        isEnhancing: false,
        enhanceError: null,
      };
    case 'SET_UPLOADING':
      return {
        ...state,
        isUploading: action.isUploading,
        uploadProgress: action.progress ?? state.uploadProgress,
        uploadErrors: action.isUploading ? [] : state.uploadErrors,
      };
    case 'SET_UPLOAD_ERRORS':
      return { ...state, uploadErrors: action.errors, isUploading: false };
    case 'CLEAR':
      return {
        ...INITIAL_COMPOSER_STATE,
        isEnhanceOpen: false,
        enhanceInstruction: '',
        isEnhancing: false,
        enhanceError: null,
        isUploading: state.isUploading,
        uploadProgress: state.uploadProgress,
      };
    default:
      return state;
  }
}

export class ComposerStore {
  #state: ComposerState = INITIAL_COMPOSER_STATE;
  readonly #listeners = new Set<() => void>();

  dispatch = (action: ComposerAction): void => {
    const next = reduceComposerState(this.#state, action);
    if (next === this.#state) return;
    this.#state = next;
    for (const listener of this.#listeners) listener();
  };

  getSnapshot = (): ComposerState => this.#state;
  getServerSnapshot = (): ComposerState => INITIAL_COMPOSER_STATE;
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };
}
