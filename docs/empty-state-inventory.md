# Empty State Inventory

This document inventories user-facing empty states across the apps.

It focuses on content-empty and search/filter-empty UI, not error states like "not found" or transport failures.

## Current Shared Primitive

- `StatePanel`
  File: [packages/platform/ui/src/components/surfaces/state-panel.tsx](/Users/charlesponti/Developer/hominem/packages/platform/ui/src/components/surfaces/state-panel.tsx)
  Shape: optional icon, title, description, actions, children
  Variants: `default`, `dashed`
  Layouts: `centered`, `inline`

## Pattern Groups

### 1. Base Empty: centered card/panel with title and optional description

- Web inbox
  File: [apps/web/app/routes/notes/page.tsx](/Users/charlesponti/Developer/hominem/apps/web/app/routes/notes/page.tsx:230)
  Copy: `Your inbox is empty.`
  Notes: already uses `StatePanel`

- Web chat list
  File: [apps/web/app/routes/chat/index.tsx](/Users/charlesponti/Developer/hominem/apps/web/app/routes/chat/index.tsx:114)
  Copy: `No chats yet.`
  Notes: inline dashed panel

- Web chat thread
  File: [apps/web/app/routes/chat/chat.$chatId.tsx](/Users/charlesponti/Developer/hominem/apps/web/app/routes/chat/chat.$chatId.tsx:323)
  Copy: `No messages yet.`
  Notes: inline dashed panel with guidance text

- Mobile workspace stream
  File: [apps/mobile/components/workspace/InboxStream.tsx](/Users/charlesponti/Developer/hominem/apps/mobile/components/workspace/InboxStream.tsx:101)
  Copy: translation-backed
  Notes: richer custom card with icon and sample content

- Mobile archived chats
  File: [apps/mobile/app/(protected)/(tabs)/settings/archived-chats.tsx](/Users/charlesponti/Developer/hominem/apps/mobile/app/%28protected%29/%28tabs%29/settings/archived-chats.tsx:96)
  Copy: translation-backed
  Notes: simple text-only empty state

- Career applications table
  File: [apps/career/app/components/career/ApplicationTable.tsx](/Users/charlesponti/Developer/hominem/apps/career/app/components/career/ApplicationTable.tsx:153)
  Copy: `No applications found`
  Notes: includes CTA

- Career applications cards
  File: [apps/career/app/components/career/ApplicationCards.tsx](/Users/charlesponti/Developer/hominem/apps/career/app/components/career/ApplicationCards.tsx:37)
  Copy: `No applications found`
  Notes: same content family as table, no CTA

- Career certifications
  File: [apps/career/app/routes/career.certifications.tsx](/Users/charlesponti/Developer/hominem/apps/career/app/routes/career.certifications.tsx:143)
  Copy: `No certifications yet`
  Notes: icon, description, CTA

- Career projects
  File: [apps/career/app/routes/career.projects.tsx](/Users/charlesponti/Developer/hominem/apps/career/app/routes/career.projects.tsx:153)
  Copy: `No projects yet`
  Notes: icon, description, CTA

- Career experience projects
  File: [apps/career/app/routes/career.experience.$id.projects.tsx](/Users/charlesponti/Developer/hominem/apps/career/app/routes/career.experience.$id.projects.tsx:163)
  Copy: `No projects yet`
  Notes: nested-detail variation

- Career history
  File: [apps/career/app/components/career/CareerHistory.tsx](/Users/charlesponti/Developer/hominem/apps/career/app/components/career/CareerHistory.tsx:47)
  Copy: `No work experience yet`
  Notes: icon, text-only

### 2. Search / Filter Empty: results exist in system, but not for current query

- Web chat search
  File: [apps/web/app/routes/chat/index.tsx](/Users/charlesponti/Developer/hominem/apps/web/app/routes/chat/index.tsx:120)
  Copy: `No chats match "...".`
  Notes: inline dashed panel

- Mobile chat message search
  File: [apps/mobile/components/chat/chat-message-list.tsx](/Users/charlesponti/Developer/hominem/apps/mobile/components/chat/chat-message-list.tsx:135)
  Copy: `No messages matching "..."`
  Notes: lightweight inline text block

- Career applications filters
  File: [apps/career/app/components/career/ApplicationTable.tsx](/Users/charlesponti/Developer/hominem/apps/career/app/components/career/ApplicationTable.tsx:304)
  Copy: `No applications match your filters`
  Notes: same visual family as applications base-empty

### 3. Lightweight Editor Empty: short instructional text only

- Career editor projects
  File: [apps/career/app/routes/editor.projects.tsx](/Users/charlesponti/Developer/hominem/apps/career/app/routes/editor.projects.tsx:418)
  Copy: `No projects added yet. Click "Add New Project" to get started.`

- Career editor testimonials
  File: [apps/career/app/routes/editor.testimonials.tsx](/Users/charlesponti/Developer/hominem/apps/career/app/routes/editor.testimonials.tsx:340)
  Copy: `No testimonials added yet. Click "Add New Testimonial" to get started.`

- Career editor work
  File: [apps/career/app/routes/editor.work.tsx](/Users/charlesponti/Developer/hominem/apps/career/app/routes/editor.work.tsx:386)
  Copy: `No work experiences added yet. Click "Add New Experience" to get started.`

### 4. Analytics / Secondary Data Empty

- Career top companies
  File: [apps/career/app/components/career/TopCompaniesTable.tsx](/Users/charlesponti/Developer/hominem/apps/career/app/components/career/TopCompaniesTable.tsx:12)
  Copy: `No company data available`
  Notes: icon emoji + description

- Career source performance
  File: [apps/career/app/components/career/SourcePerformanceChart.tsx](/Users/charlesponti/Developer/hominem/apps/career/app/components/career/SourcePerformanceChart.tsx:12)
  Copy: `No source performance data available`
  Notes: plain text only

### 5. Detail Pane Empty

- Career application notes
  File: [apps/career/app/components/career/ApplicationNotesTab.tsx](/Users/charlesponti/Developer/hominem/apps/career/app/components/career/ApplicationNotesTab.tsx:102)
  Copy: `No notes yet. Add your first note above.`

- Career application files
  File: [apps/career/app/components/career/ApplicationFilesTab.tsx](/Users/charlesponti/Developer/hominem/apps/career/app/components/career/ApplicationFilesTab.tsx:49)
  Copy: `No files uploaded yet. File upload functionality coming soon.`

## Reuse Opportunities

### Strong candidates for a shared component

- Web chat list empty
- Web chat thread empty
- Career certifications empty
- Career projects empty
- Career history empty
- Career top companies empty

These all follow a similar "centered card with optional icon, title, description, optional CTA" structure.

### Strong candidates for a shared search/filter-empty pattern

- Web chat search empty
- Mobile chat message search empty
- Career applications filtered empty

These are not "nothing exists" states. They should stay distinct from base-empty states.

### Probably should stay local

- Mobile workspace empty state
  Reason: richer, onboarding-like content with example workspace material

- Career application notes/files empty states
  Reason: these are tab/detail-pane hints, not full-page empty states

- Career editor empty text blocks
  Reason: these are lightweight authoring affordances and may not need a component

## Recommendation

If we standardize, do it with a small pattern set rather than one universal abstraction:

- `EmptyStatePanel`
  For base empty states with optional icon, description, and actions

- `EmptyResults`
  For search/filter no-match states

- Keep detail-pane and onboarding-heavy empty states local

`StatePanel` is already close to `EmptyStatePanel` for web, so the lowest-friction path may be extending or formalizing that component rather than introducing something entirely new.
