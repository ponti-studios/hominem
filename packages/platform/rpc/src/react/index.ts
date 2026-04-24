export { queryKeys, type QueryKeys } from '../core/query-keys';
export { useApiClient } from './context';
export { useRpcMutation, useRpcQuery } from './hooks';
export {
  createNotesMutationSuccessHandler,
  DEFAULT_NOTES_FEED_LIMIT,
  invalidateNotesCaches,
} from './hooks-notes';
export { HonoProvider } from './provider';

export type { OptimisticUpdateConfig } from './hooks';
export type { HonoProviderProps } from './provider';
