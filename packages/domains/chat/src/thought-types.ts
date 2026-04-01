/**
 * Shared domain types for the thought lifecycle.
 *
 * Import from @hominem/chat-services in both mobile and Notes web.
 * No surface may redefine these locally.
 *
 * Canonical UI-contract types are owned by @hominem/rpc/types as the single
 * source of truth. This module re-exports them so domain internals
 * (session-artifacts, use-chat-lifecycle, etc.) resolve to the same
 * declaration, making return types portable across packages.
 */

// Re-export canonical types from @hominem/rpc/types as the single source of truth.
export type {
  ArtifactType,
  CaptureBarProps,
  ClassificationReviewProps,
  ReviewItem,
  SessionSource,
} from '@hominem/rpc/types';

// Re-export runtime values from @hominem/rpc/types.
export { ENABLED_ARTIFACT_TYPES, isArtifactTypeEnabled } from '@hominem/rpc/types';

import type { ArtifactType } from '@hominem/rpc/types';

// ─── Classification API Contract ─────────────────────────────────────────────

/**
 * Request body sent to the classification endpoint.
 *
 * POST /api/chat/:chatId/classify
 */
export interface ClassificationRequest {
  /** The chat ID whose messages are being classified. */
  chatId: string;
  /**
   * The artifact type to classify as.
   * In v1, always 'note'. Clients must pass this explicitly; the server
   * does not infer the type.
   */
  targetType: ArtifactType;
}

/**
 * Response body returned by the classification endpoint on success.
 *
 * The client uses this to populate ClassificationReview.
 * In v1, proposedType is always 'note'. If the server returns anything else,
 * the client falls back to 'note' and logs a warning.
 */
export interface ClassificationResponse {
  proposedType: ArtifactType;
  proposedTitle: string;
  /** Ordered list of human-readable change descriptions. Max 5 items. */
  proposedChanges: string[];
  /** Markdown string of the proposed artifact body. */
  previewContent: string;
  /** Server-generated review item ID. Used to accept or reject via API. */
  reviewItemId: string;
}

/**
 * Request body to accept a review item (persist the artifact).
 *
 * POST /api/review/:reviewItemId/accept
 */
export interface ReviewAcceptRequest {
  reviewItemId: string;
  /** Optional user-edited title that overrides the proposed title. */
  finalTitle?: string;
}

/**
 * Request body to reject a review item (discard the proposal).
 *
 * POST /api/review/:reviewItemId/reject
 */
export interface ReviewRejectRequest {
  reviewItemId: string;
}
