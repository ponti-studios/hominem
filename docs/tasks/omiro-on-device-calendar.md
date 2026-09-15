---
title: 'Make Omiro Calendar device-only'
status: 'Proposed'
priority: 'high'
labels: [omiro, calendar, ios, foundation-models]
depends_on: []
blocks: []
estimated_size: 'L'
---

## Outcome

EventKit is the sole source of truth for calendar data. Omiro keeps tasks in
the Hominem database, but reads and writes calendar events only on the user's
Apple device. Natural-language Time requests are interpreted by the on-device
Foundation Model and use native EventKit and EventKitUI tools.

## Delivery sequence

1. Extract an Expo-independent Swift calendar assistant package with typed
   models, bounded EventKit queries, an in-memory test store, and four native
   tools: event search, event editor, availability, and task proposal.
2. Keep the Expo adapter thin. It exposes summaries, permissions, model
   availability, `interpretTimeRequest`, and EventKitUI presentation; it does
   not bridge low-level CRUD patches or calendar data beyond summaries.
3. Replace the Omiro Time parser with the native assistant. Task drafts remain
   normal API-backed tasks. Calendar writes use `EKEventEditViewController`.
4. Remove the server calendar product surface while preserving trip history in
   travel-owned code, then drop the calendar tables with a reversible Goose
   migration and regenerate Kysely types.

## Acceptance criteria

- [ ] Calendar events are never sent to the Hominem API by current Omiro
  builds; EventKit is authoritative.
- [ ] `swift test --package-path apps/omiro/modules/on-device-ai` runs without
  React Native, CocoaPods, or a simulator.
- [ ] Apple editor handles calendar create, edit, delete, calendar selection,
  recurrence, attendees, alarms, save, and cancellation.
- [ ] `/api/tasks/parse` remains supported for web task management and older
  Omiro builds, and receives no calendar payload from current Omiro builds.
- [ ] Calendar MCP tools, calendar scope, People calendar activity, exports,
  evaluations, metadata, and database tables are removed; travel trip history
  remains available.

## Rollout boundary

No production deployment occurs as part of this task. Before production schema
deployment, the database runbook requires a verified private backup. The
server parser remains supported; any future removal requires an explicit
product decision covering web task management and older Omiro clients.
