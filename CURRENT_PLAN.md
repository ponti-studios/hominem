# Hominem Refactor Plan And Execution Record

## Document Purpose
This document is the current technical plan and execution record for the Hominem refactor initiative.

It serves four purposes:
1. Capture the original multi-phase refactor scope.
2. Record what has already been implemented, including rationale and affected files.
3. Describe the technical decisions and discoveries that shaped the work.
4. Provide a concrete, implementation-ready plan for the remaining Phase 3 work.

This document is intended to be a handoff-quality reference for continuing the refactor without reconstructing context from commit history or chat logs.

## Executive Summary
The refactor was organized into three phases, ordered by risk and dependency:
1. Phase 1: correctness and low-risk cleanup.
2. Phase 2: performance and architecture improvements.
3. Phase 3: larger architectural changes.

Current state:
1. Phase 1 is complete.
2. Phase 2 is complete.
3. Phase 3 has not been started.

High-level outcomes so far:
1. Chat responses now stream end-to-end instead of blocking on full completion.
2. Voice responses now stream through the mobile voice flow.
3. Mobile draft persistence uses MMKV.
4. The mobile composer context has been split to reduce unnecessary re-renders.
5. Mobile shared design tokens now come from `@hominem/ui/tokens` instead of duplicated local definitions.

## Repository Context

### Monorepo Shape
The repo is a `pnpm` workspace with multiple apps and shared packages.

Important areas:
1. `apps/mobile`
2. `apps/web`
3. `services/api`
4. `packages/platform/rpc`
5. `packages/platform/services`
6. `packages/platform/ui`
7. `packages/core/*`

### Relevant Runtime Stack
1. Mobile: Expo / React Native.
2. Web: React Router SSR app with Vite.
3. API: Hono-based API.
4. Data and contracts: shared through RPC and platform packages.
5. AI features: chat and voice generation paths live through API and shared services.

### Validation Runbook
Commands used during this refactor:
1. `pnpm --filter @hominem/api run test`
2. `pnpm --filter @hominem/api run typecheck`
3. `pnpm --filter @hominem/web run test`
4. `pnpm --filter @hominem/web run typecheck`
5. `pnpm --filter @hominem/mobile run typecheck`
6. `pnpm --filter @hominem/rpc run typecheck`

## Planning Principles
The work was sequenced by the following rules:
1. Fix correctness issues before performance work.
2. Ship minimal safe changes first.
3. Preserve existing app behavior unless there is a clear reason to change it.
4. Prefer small local edits over wide rewrites.
5. Validate continuously with typecheck and tests.
6. Avoid speculative architecture until the actual bottlenecks are understood.

## Original Phase Structure

### Phase 1: Correctness And Low-Risk Cleanup
Planned scope:
1. Fix incorrect brand identity usage on web.
2. Fix incorrect inbox ordering logic.
3. Clean up ambiguous chat response contract naming.
4. Review suspicious barrel exports.
5. Review suspicious directory structure patterns.

### Phase 2: Performance And Architecture
Planned scope:
1. Move draft persistence to a more appropriate mobile storage layer.
2. Split the monolithic composer context to reduce render fanout.
3. Verify and fix unstable target derivation if necessary.
4. Convert chat response generation to streaming.
5. Convert voice response flow to streaming.
6. Consolidate duplicated design tokens.

### Phase 3: Major Architecture Work
Planned scope:
1. Introduce clearer service boundaries for shared logic.
2. Improve search pagination behavior.
3. Add rate limiting where request volume risk exists.
4. Improve real-time update delivery.
5. Resolve SSR flash / session hydration mismatch on web.
6. Continue package boundary cleanup where the current structure is too broad.

## Baseline Technical Findings
These findings informed the order and shape of the work.

### Cross-Cutting Findings
1. The composer and chat paths were carrying the most visible user-facing latency.
2. Shared package boundaries were useful but still had some duplication and broad ownership.
3. Several suspicious items in the codebase were actually intentional patterns, not bugs.

### Mobile Findings
1. The composer context was too broad and caused subscribers to re-render on unrelated state changes.
2. Draft persistence needed to live on a fast mobile-native storage path.
3. Mobile token definitions duplicated values already present in `@hominem/ui`.
4. The voice UI used transcription and TTS, but the full streamed assistant response path was not wired through the modal yet.

### Web Findings
1. Web chat sending still had a blocking response path before streaming was introduced.
2. Brand identity usage had at least one hardcoded value in layout.
3. There is still a remaining SSR/session flash issue that belongs to Phase 3.

### API Findings
1. Chat generation was still using a non-streaming model path in the request/response cycle.
2. Voice generation had the internal pieces needed for streaming, but the transport path was not exposed end-to-end.
3. The API and RPC layers were already good leverage points for improving behavior without rewriting app surfaces from scratch.

## Phase 1 Detailed Record

### Status
Complete.

### Intent
Remove correctness bugs and confirm whether a few suspicious patterns were actually defects before taking on higher-risk refactors.

### Phase 1 Step 1: Web Brand Identity Fix

#### Problem
Web layout branding used a hardcoded app name instead of the canonical brand source.

#### Goal
Use the shared environment branding constant so the displayed application name matches the actual configured brand.

#### Change
1. Replaced the hardcoded brand string in the web layout.
2. Imported and used `WEB_BRAND.appName` as the source of truth.

#### Primary File
1. `apps/web/app/routes/layout.tsx`

#### Why It Matters
1. Prevents drift between product branding and the rendered UI.
2. Avoids repeated hardcoded brand usage.

### Phase 1 Step 2: Inbox Sort Fix

#### Problem
Inbox items were being sorted via string comparison instead of numeric timestamp comparison.

#### Goal
Sort inbox items chronologically using numeric time values.

#### Change
1. Replaced string-based sort logic.
2. Used `Date.getTime()` for direct numeric comparison.

#### Primary File
1. `apps/mobile/services/inbox/use-inbox-stream-items.ts`

#### Why It Matters
1. Prevents incorrect ordering for valid ISO-like or user-generated date values.
2. Removes subtle sort instability.

### Phase 1 Step 3: Chat Contract Naming Cleanup

#### Problem
The response contract used `streamId`, which was misleading once the meaning of the identifier became clearer.

#### Goal
Rename the field to express that it identifies the assistant message, not the stream transport.

#### Change
1. Renamed `streamId` to `assistantMessageId`.
2. Updated the shared RPC type and the API route accordingly.

#### Primary Files
1. `packages/platform/rpc/src/types/chat.types.ts`
2. `services/api/src/rpc/routes/chats.ts`

#### Why It Matters
1. Makes the contract semantically accurate.
2. Reduces confusion as streaming support grows.

### Phase 1 Step 4: Button Barrel Review

#### Problem
`Button.tsx` looked suspicious and needed review to determine whether it was accidental indirection.

#### Conclusion
It was a legitimate barrel / re-export pattern and did not require change.

### Phase 1 Step 5: `date/date/` Directory Review

#### Problem
The nested `date/date/` pattern looked like possible accidental duplication.

#### Conclusion
The structure was intentional and did not require change.

### Phase 1 Validation
Validation performed during and after these changes:
1. Typechecks passed across affected packages.
2. Mobile tests passed for the scope exercised during the Phase 1 and early Phase 2 work.

### Phase 1 Commit Context
The Phase 1 work was committed together with Phase 2.1 to Phase 2.3 work in:
1. `refactor: Phase 1-2.3 corrections and performance improvements`

## Phase 2 Detailed Record

### Status
Complete.

### Intent
Remove user-visible latency and rendering inefficiency while keeping the implementation incremental and testable.

### Phase 2 Step 1: Draft Persistence Migration

#### Original Goal
Move mobile draft persistence off the slower async path and onto the native storage path better suited for frequent local draft updates.

#### Important Discovery
The repo had already moved toward MMKV in practice. The refactor work finalized and normalized the draft persistence path rather than inventing it from scratch.

#### Change
1. Draft storage logic was updated to use MMKV APIs.
2. Reads became synchronous through the MMKV interface.
3. Writes and deletes were updated to MMKV equivalents.
4. The draft restoration flow now returns synchronously.

#### Primary Files
1. `apps/mobile/hooks/use-draft-persistence.ts`
2. `apps/mobile/services/storage/mmkv.ts`

#### Why It Matters
1. Draft restore becomes simpler and faster.
2. The persistence layer matches mobile usage better than async storage for this case.

### Phase 2 Step 2: Composer Context Split

#### Problem
`ComposerContext` bundled together frequently changing UI state and slower-changing draft state.

#### Goal
Reduce unnecessary re-renders by separating high-churn and low-churn state domains.

#### Change
1. Split the old context into `ComposerDraftContext` and `ComposerUIContext`.
2. Added `useComposerDraftContext()`.
3. Added `useComposerUIContext()`.
4. Kept `useComposerContext()` as a compatibility layer that combines both.

#### Draft Context Ownership
1. `target`
2. `message`
3. `attachments`
4. `selectedNotes`
5. `clearDraft`

#### UI Context Ownership
1. `isRecording`
2. `mode`
3. `composerClearance`

#### Primary File
1. `apps/mobile/components/composer/ComposerContext.tsx`

#### Why It Matters
1. Subscribers are no longer forced to re-render on unrelated context changes.
2. The state model is clearer and closer to actual usage patterns.

### Phase 2 Step 3: Target Stability Verification

#### Original Concern
`useLocalSearchParams()` can produce unstable references, so there was concern that `target` derivation was still unstable.

#### Finding
The earlier fixes in the codebase had already reduced the relevant dependencies to primitives, so the target derivation was already stable.

#### Outcome
No further code change was required for this step.

### Phase 2 Step 4: Streaming Chat

#### Problem
Chat generation used a blocking request/response flow and returned only after the full model output completed.

#### Goal
Stream assistant output to the client as it is generated.

#### API Changes
1. Added `POST /api/chats/:id/stream`.
2. Switched generation to `streamText()`.
3. Persisted the user message before starting the stream.
4. Persisted the assistant message after the stream completes, using asynchronous execution context handling.

#### RPC Changes
1. Added `chats.stream()` to the RPC client.
2. Returned a `ReadableStream<Uint8Array>` to consumers.

#### Web Changes
1. Added `apps/web/app/lib/hooks/use-stream-message.ts`.
2. The hook reads the stream via `TextDecoder`.
3. It accumulates streamed text in local state.
4. It invalidates chat-related query caches on completion.
5. The hook was corrected to use `useApiClient()` from `@hominem/rpc/react` instead of a non-existent local API client module.

#### Primary Files
1. `services/api/src/rpc/routes/chats.ts`
2. `packages/platform/rpc/src/domains/chats.ts`
3. `packages/platform/rpc/src/types/chat.types.ts`
4. `apps/web/app/lib/hooks/use-stream-message.ts`

#### Why It Matters
1. Users receive tokens progressively instead of waiting for the full response.
2. The chat path now better matches modern LLM UX expectations.
3. The API contract is ready for richer streaming consumers.

#### Validation
1. Web typecheck passed after the hook integration fix.
2. API typecheck passed with the new streaming route.

#### Commit
1. `refactor: Complete Phase 2.4 streaming chat - implement useStreamMessage hook with proper API client integration`

### Phase 2 Step 5: Streaming Voice

#### Problem
Voice response generation still centered on a buffered response model, while the mobile flow only used transcription and TTS instead of a direct streamed assistant response path.

#### Goal
Expose a streamed voice assistant response path end-to-end and wire it into mobile.

#### Key Discovery
The mobile app was not directly calling `/voice/respond`. The realistic integration point was the voice modal, not an existing direct voice-response screen.

#### Service Layer Changes
1. Added `generateVoiceResponseStream()`.
2. Exposed a `ReadableStream<Uint8Array>` from the voice response service.
3. Preserved the ability to collect transcript data while streaming audio chunks.

#### API Changes
1. Added `POST /api/voice/respond/stream`.
2. Transcribed the uploaded recording first.
3. Streamed audio bytes from the assistant response back to the client.
4. Added `X-User-Transcript` to the response headers so the mobile UI can insert the recognized text into the composer.

#### RPC Changes
1. Added `voice.respondStream()`.
2. Returned the raw `Response` object so consumers can access both the body stream and headers.

#### Mobile Changes
1. Added `apps/mobile/components/media/voice/useVoiceResponse.ts`.
2. The hook uploads the recorded audio.
3. The hook reads the response stream to completion.
4. The hook writes the audio bytes to a temporary PCM file.
5. The hook plays the generated response audio.
6. The hook returns the user transcript from the response header.
7. `VoiceSessionModal` now records audio, sends it through the streamed voice response path, plays the assistant audio, and forwards the transcript back to the composer through the existing `onAudioTranscribed` callback.

#### Primary Files
1. `packages/platform/services/src/voice-response.service.ts`
2. `services/api/src/rpc/routes/voice.ts`
3. `packages/platform/rpc/src/domains/voice.ts`
4. `apps/mobile/components/media/voice/useVoiceResponse.ts`
5. `apps/mobile/components/media/voice-session-modal.tsx`

#### Why It Matters
1. Removes the hard split between transcription-only and response playback paths.
2. Gives the mobile voice experience a full streamed assistant round-trip.
3. Keeps the integration contained to the modal and supporting hook, avoiding a broad composer rewrite.

#### Validation
1. `pnpm --filter @hominem/mobile run typecheck`
2. `pnpm --filter @hominem/rpc run typecheck`
3. `pnpm --filter @hominem/api run typecheck`

#### Commit
1. `refactor: wire streamed voice responses into mobile voice input`

### Phase 2 Step 6: Token Consolidation

#### Problem
Mobile theme tokens duplicated shared values already defined in `@hominem/ui`.

#### Goal
Make `@hominem/ui/tokens` the canonical shared token source while preserving the mobile theme surface.

#### Change Strategy
The minimal safe change was not to rewrite every mobile import site. Instead:
1. Keep the mobile token barrel as the compatibility surface.
2. Re-export shared tokens from `@hominem/ui/tokens`.
3. Keep only native-specific typography logic local.

#### Changes Made
1. `apps/mobile/components/theme/tokens/index.ts` now re-exports shared token values from `@hominem/ui/tokens`.
2. `colors.ts`, `spacing.ts`, `motion.ts`, `radii.ts`, and `shadows.ts` under the mobile token directory were reduced to thin re-export files.
3. `typography.native.ts` remained local because it defines native platform font family mapping.
4. Added missing canonical shared token `border-faint` to `packages/platform/ui/src/tokens/colors.ts` after typecheck revealed that mobile relied on it.

#### Primary Files
1. `apps/mobile/components/theme/tokens/index.ts`
2. `apps/mobile/components/theme/tokens/colors.ts`
3. `apps/mobile/components/theme/tokens/spacing.ts`
4. `apps/mobile/components/theme/tokens/motion.ts`
5. `apps/mobile/components/theme/tokens/radii.ts`
6. `apps/mobile/components/theme/tokens/shadows.ts`
7. `packages/platform/ui/src/tokens/colors.ts`

#### Why It Matters
1. Shared tokens now have a single canonical source.
2. Mobile keeps compatibility without a large import rewrite.
3. The remaining local token surface is only the platform-specific typography mapping.

#### Validation
1. `pnpm --filter @hominem/mobile run typecheck`
2. `pnpm --filter @hominem/web run typecheck`

#### Commit
1. `refactor: consolidate mobile tokens onto shared ui package`

## Summary Of Files Most Relevant To Completed Work

### Chat Streaming
1. `services/api/src/rpc/routes/chats.ts`
2. `packages/platform/rpc/src/domains/chats.ts`
3. `packages/platform/rpc/src/types/chat.types.ts`
4. `apps/web/app/lib/hooks/use-stream-message.ts`

### Voice Streaming
1. `packages/platform/services/src/voice-response.service.ts`
2. `services/api/src/rpc/routes/voice.ts`
3. `packages/platform/rpc/src/domains/voice.ts`
4. `apps/mobile/components/media/voice/useVoiceResponse.ts`
5. `apps/mobile/components/media/voice-session-modal.tsx`

### Composer And Mobile Performance
1. `apps/mobile/components/composer/ComposerContext.tsx`
2. `apps/mobile/hooks/use-draft-persistence.ts`

### Shared Tokens
1. `apps/mobile/components/theme/tokens/index.ts`
2. `packages/platform/ui/src/tokens/colors.ts`
3. `packages/platform/ui/src/tokens/index.ts`

## Commit Record
Known commits associated with the completed refactor work:
1. `refactor: Phase 1-2.3 corrections and performance improvements`
2. `refactor: Complete Phase 2.4 streaming chat - implement useStreamMessage hook with proper API client integration`
3. `refactor: wire streamed voice responses into mobile voice input`
4. `refactor: consolidate mobile tokens onto shared ui package`

## Phase 3 Detailed Plan

### Status
Not started.

### Intent
Phase 3 is where the remaining architectural debt should be addressed. This work should be sequenced carefully because it has a larger blast radius than the Phase 1 and Phase 2 changes.

### Recommended Execution Order
1. Fix SSR/session flash on web.
2. Improve real-time update flows.
3. Improve search pagination.
4. Add rate limiting.
5. Split shared service boundaries.
6. Perform final package boundary cleanup.

This order prioritizes user-visible correctness and product behavior before deeper package reorganization.

### Phase 3 Step 1: Fix Web SSR Flash / Session Hydration Mismatch

#### Problem
The web app still has a client/session hydration mismatch leading to a flash during SSR hydration.

#### Likely Root Shape
The layout or auth/session ownership still depends on client-only session resolution where server-derived initial auth state should be used.

#### Goal
Make the initial render and hydrated render agree on auth/session state so protected layout rendering does not visibly flash.

#### Planned Approach
1. Audit the web layout and auth provider boundary.
2. Identify whether `useSession()` or equivalent client-only hooks are controlling initial layout state.
3. Move initial auth/session resolution to the server-rendered boundary where possible.
4. Ensure hydrated client state uses the same source of truth or a seeded cache.
5. Remove transitional UI states that only exist because the initial session is unknown on the client.

#### Likely Files To Inspect
1. `apps/web/app/routes/layout.tsx`
2. `apps/web/app/lib/api/provider.tsx`
3. Relevant auth provider/session modules under web and shared auth packages.

#### Risks
1. Accidentally changing protected-route behavior.
2. Introducing auth race conditions between server and client caches.

#### Validation Plan
1. Web typecheck.
2. Manual SSR navigation verification.
3. Manual authenticated and unauthenticated route verification.

### Phase 3 Step 2: Improve Real-Time Update Flows

#### Problem
The app still lacks a fully consistent real-time update strategy across chat and related views.

#### Goal
Make real-time updates more coherent, likely centered around SSE or a similarly explicit server-to-client update mechanism.

#### Planned Approach
1. Audit current chat refresh and invalidation behavior.
2. Define which surfaces truly need live updates and which can stay query-driven.
3. Introduce a single real-time transport path for the relevant domain.
4. Ensure cache invalidation and streamed updates do not fight each other.

#### Likely Areas
1. Chat list refresh.
2. Active conversation updates.
3. Possibly inbox or task-like streams if they currently rely on polling or manual invalidation.

#### Risks
1. Duplicate messages or duplicate invalidation.
2. Race conditions between streamed content and persisted server state.

#### Validation Plan
1. Multi-client manual verification.
2. Network interruption handling.
3. Cache consistency checks after reconnect.

### Phase 3 Step 3: Improve Search Pagination

#### Problem
Search pagination needs architectural cleanup, likely around query boundaries, page state, or how search results are loaded and appended.

#### Goal
Make search pagination predictable, efficient, and easy to reason about in both API and client layers.

#### Planned Approach
1. Audit current search endpoints and cursor/page contract.
2. Check whether pagination is offset-based, cursor-based, or inconsistent across surfaces.
3. Normalize search result contract shape.
4. Ensure client query keys and pagination state align with the API contract.
5. Add clear empty-state and end-of-list handling if missing.

#### Likely Risks
1. Breaking existing pagination cursors.
2. Losing backward compatibility if pagination shape is already consumed by multiple surfaces.

#### Validation Plan
1. API typecheck.
2. Web and mobile typecheck.
3. Manual pagination traversal forward and backward.
4. Verify behavior around filters and search term changes.

### Phase 3 Step 4: Add Rate Limiting

#### Problem
The chat and voice endpoints are now more powerful and can be expensive under load.

#### Goal
Add rate limiting where it meaningfully protects cost, abuse, and system stability without harming normal UX.

#### Planned Approach
1. Identify sensitive endpoints first.
2. Prioritize chat generation and voice generation / transcription endpoints.
3. Choose the scope of limiting per user, session, IP, or a combination.
4. Add explicit error responses and user-facing handling for throttled requests.
5. Keep the implementation centralized instead of duplicating per-route logic where possible.

#### Likely Routes
1. Chat stream send route.
2. Voice response route.
3. Voice transcription and speech generation routes if still separately exposed.

#### Risks
1. Over-throttling legitimate users.
2. Inconsistent identifiers in authenticated versus unauthenticated contexts.

#### Validation Plan
1. Unit or integration tests around throttle boundaries if added.
2. Manual burst testing against protected endpoints.
3. Confirm error handling on mobile and web.

### Phase 3 Step 5: Split Shared Service Boundaries

#### Problem
Some shared service/package boundaries are still too broad and need more intentional separation.

#### Goal
Reduce coupling between unrelated service domains and make package ownership clearer.

#### Planned Approach
1. Audit the current `packages/platform/services` responsibility map.
2. Group modules by actual domain ownership.
3. Split packages only where the boundary is already clear and beneficial.
4. Avoid package churn without meaningful dependency simplification.

#### Candidates
Likely domains to review:
1. Chat-specific services.
2. Voice-specific services.
3. File/media-specific services.
4. Utility modules that may not belong in a service package at all.

#### Risks
1. Creating too many packages with weak value.
2. Increasing import friction without materially improving architecture.

#### Validation Plan
1. Full workspace typecheck.
2. Verify package exports remain coherent.
3. Verify circular dependency risk is reduced, not increased.

### Phase 3 Step 6: Final Package Boundary Cleanup

#### Problem
Even after service splitting, some cross-package contracts may still be broader than necessary.

#### Goal
Finish the architectural cleanup by tightening ownership of types, services, and package exports.

#### Planned Approach
1. Audit package exports actually used by apps.
2. Remove accidental leakage of implementation-only modules.
3. Ensure shared tokens, RPC contracts, and services each have clear ownership.
4. Revisit whether any app-specific concerns still live in shared packages.

#### Validation Plan
1. Workspace typecheck.
2. Confirm apps consume only intended public package APIs.

## Open Technical Notes
1. Chat streaming currently persists the assistant message after stream completion. If future UX needs partial persistence or resumability, the persistence model will need further refinement.
2. The voice stream integration currently returns the user transcript through a response header. If richer voice metadata is needed later, the transport may need to move toward multipart events or structured streamed envelopes.
3. Token consolidation was intentionally minimal. The mobile compatibility layer still exists, but it now points to the shared token source rather than owning duplicated values.
4. Phase 3 should avoid broad package splitting until the SSR/session and real-time product issues are addressed, because those are more immediately user-visible.

## Recommended Next Action
Begin Phase 3 with the web SSR/session flash investigation.

That work should start by tracing the initial auth/session state through the web layout, provider boundary, and hydrated client caches before making any package-level architectural changes.
