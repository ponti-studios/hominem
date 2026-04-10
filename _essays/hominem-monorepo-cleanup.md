# Hominem Monorepo Cleanup

## Problem

The monorepo had accreted 30-40% unnecessary abstraction layers applied without intention or cost-benefit evaluation. Repositories existed without interfaces, services were pass-through wrappers, and configuration was replicated across four separate locations. Beyond structural issues, the codebase harbored critical bugs like the archive operation performing hard deletion instead of soft deletion, and type-unsafe JSON column handling that risked runtime failures.

A comprehensive forensic audit identified 50+ issues spanning architecture, TypeScript quality, React patterns, configuration, and tooling. This technical debt created cognitive overhead during development, bred code duplication, and reduced confidence in the system's reliability. The cost manifested as slower feature velocity and recurring categorized defects.

## Exploration

Several approaches could address the structural problems. One path would involve systematically refactoring—converting the repository pattern to interfaces, maintaining service abstractions while reducing passthrough methods, and distributing code extraction across multiple changes. Another approach would treat each layer as a unit for evaluation: remove repositories entirely if they add no encapsulation, consolidate service layer to only orchestration logic, and aggressively extract shared code between web and mobile.

The team considered whether to preserve the repository pattern by introducing interfaces, making it testable and explicit. However, analysis revealed repositories were thin wrappers around Kysely queries with zero domain logic, provided no actual database abstraction (callers knew it was Postgres), and couldn't be mocked (static objects). Keeping them would preserve a pattern without benefit.

For shared code between web and mobile, centralizing it faced questions about which package layer was appropriate—whether shared hooks should live in the domain layer or as infrastructure in a dedicated platform package. The concern was ensuring hooks remained thin logic abstractions rather than growing into platform-specific UI, which would violate the separation.

Environment configuration duplication presented the tradeoff between a single mega-schema containing all keys (inflexible and leaking secrets across layers) versus layered schemas with base and per-layer extensions (more maintainable but requiring coordination across configuration sites).

## Solution

The team chose deletion over refactoring for the repository layer—removing entirely any repository objects that existed only as pass-through wrappers. Routes now import and call Kysely queries directly, clarifying data flow and reducing indirection.

For service consolidation, methods containing zero business logic were deleted; services retained only orchestration methods like `createNote()` that performed derived computations, file syncing, and validation. Simple CRUD calls now went directly to repositories (or queries post-deletion).

The `@hominem/services` junk drawer package was restructured into focused sub-packages: utilities like AI model factories went to `@hominem/platform/ai`, voice services to `@hominem/platform/voice`, and API-only dependencies were inlined into the API service itself.

Code sharing between web and mobile was extracted to `packages/platform/hooks/` and `packages/platform/query-keys/`. Hooks like `use-note-editor` returned pure logic objects (`{ title, setTitle, content, setContent, debouncedSave }`) that each app could wrap with platform-specific UI and navigation, avoiding premature convergence while eliminating duplication of logic.

Environment configuration was consolidated into `packages/core/config` with a base schema for shared keys (database URL, API provider credentials) and per-layer extensions for specific needs (API requires COOKIE_SECRET, web requires VITE_* variables). This provided a single source of truth while preventing secrets leakage.

The critical archive bug was addressed by adding an `archived_at` timestamp column, converting the operation to a soft delete that users could recover from. A background job hard-deletes archives older than 30 days for compliance.

## Learnings

Unnecessary abstraction layers accumulated because teams applied "enterprise patterns" uniformly without evaluating whether each pattern solved a real problem. The cost appears invisible at first (one more indirection layer) but compounds across the codebase through increased cognitive load and reduced confidence in the system.

Deleting code is often simpler than refactoring it. The team found more value in removing thin wrappers that added no behavior than in preserving them with architectural improvements. This inverted the usual pressure to "improve" legacy code; instead, the question became "does this layer solve any problem?" If not, delete it.

Duplication between apps is visible and feels wrong, but the right remedy depends on the nature of duplicated code. Logic duplication (auth flows, note editor operations) merits extraction to shared hooks. UI duplication does not—each platform should own its user-facing code. The extraction created a clear boundary: shared `packages/platform/hooks` contain pure logic, apps provide UI and navigation.

Configuration duplication breeds drift. Consolidating schemas with a layered structure (base + extensions) prevents the same configuration key from being defined four times in four locations. This requires intentional coordination, but the alternative—distributed schemas—is unmaintainable.

Critical bugs like archive-as-delete escape notice because they're behavior bugs dressed as feature code. A cleanup pass that reviews and tests critical paths often catches these issues alongside structural problems.

Breaking changes are necessary when fixing architecture. The team chose to update all consumers of removed service methods and repository calls in the same change, treating it as a compatibility change that must update consumers immediately. Leaving deprecated aliases would only preserve the ambiguity the cleanup was meant to resolve.
