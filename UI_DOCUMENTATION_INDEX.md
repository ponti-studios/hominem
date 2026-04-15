# @hominem/ui Documentation Index

This folder contains comprehensive documentation about the `@hominem/ui` package and its integration with the mobile and web applications. The documentation has been organized into focused, accessible documents.

## Documentation Files

### 1. **UI_EXPLORATION_SUMMARY.txt** (9.3 KB) - START HERE
**Best for**: Quick overview and key facts
- Executive summary of findings
- Mobile component inventory (4 components)
- Components used in mobile app (18 imports)
- Design tokens overview
- Architecture decisions
- Key statistics
- Development commands

**Read this first for a 5-minute overview of the entire system.**

---

### 2. **UI_QUICK_REFERENCE.md** (9.2 KB) - DEVELOPER GUIDE
**Best for**: Daily development and quick lookups
- File locations and directory structure
- Mobile-only components quick access table
- Native component variants table
- Chat components (web vs mobile)
- Design tokens import paths
- Type definitions
- Hooks available
- Utility functions
- Component re-exports in mobile app
- Web-only components list
- Component-specific API reference
- Development commands

**Use this when developing - it's your cheat sheet.**

---

### 3. **UI_EXPLORATION_REPORT.md** (16 KB) - COMPREHENSIVE GUIDE
**Best for**: Complete understanding and detailed reference
- Package structure overview
- Mobile components details (ListRow, EmptyState, etc.)
- Mobile app component usage locations
- Overall structure and dependencies
- Shared types and utilities
- Components shared with web vs mobile breakdown
- Architecture decisions explained
- Summary tables and matrices
- Integration points
- Development workflow

**Read this for deep understanding of architecture and decisions.**

---

### 4. **UI_ARCHITECTURE_DIAGRAM.md** (16 KB) - VISUAL REFERENCE
**Best for**: Understanding relationships and data flow
- High-level architecture diagram
- Component organization tree
- Export resolution flow (Mobile vs Web)
- Dependency flow charts
- Used components in mobile app hierarchy
- Mobile vs Web component matrix
- Token system architecture
- Type system organization
- Hooks & utilities architecture

**Reference this when you need to visualize system relationships.**

---

## Quick Navigation by Use Case

### I'm new to the project
1. Read: **UI_EXPLORATION_SUMMARY.txt** (5 min)
2. Skim: **UI_ARCHITECTURE_DIAGRAM.md** (5 min)
3. Review: **UI_EXPLORATION_REPORT.md** sections 1-2 (10 min)

### I need to use a component in the mobile app
1. Find the component: **UI_QUICK_REFERENCE.md** → "Mobile-Only Components" or "Native Component Variants"
2. Learn the API: **UI_QUICK_REFERENCE.md** → "Component-Specific Features"
3. See examples: Check `/apps/mobile` files that import it

### I'm implementing a new component
1. Architecture context: **UI_ARCHITECTURE_DIAGRAM.md** → "Component Organization Tree"
2. Similar components: **UI_QUICK_REFERENCE.md** → Find similar component
3. Pattern reference: Look at source file (e.g., `button.native.tsx` for structure)

### I need to understand platform differences
1. Overview: **UI_EXPLORATION_SUMMARY.txt** → "Mobile Components" section
2. Details: **UI_EXPLORATION_REPORT.md** → "Components Shared with Web vs Mobile"
3. Matrix: **UI_ARCHITECTURE_DIAGRAM.md** → "Mobile vs Web Component Matrix"

### I'm debugging import issues
1. Check imports: **UI_QUICK_REFERENCE.md** → "Accessing the Package"
2. Understand exports: **UI_ARCHITECTURE_DIAGRAM.md** → "Export Resolution Flow"
3. Verify files: Look in `/packages/platform/ui/src/`

### I need to modify a component
1. Understand structure: **UI_QUICK_REFERENCE.md** → File locations
2. Find related files: **UI_ARCHITECTURE_DIAGRAM.md** → "Component Organization Tree"
3. Check usages: Search codebase for component imports

---

## Key Concepts Summary

### Conditional Exports
The `@hominem/ui` package uses `package.json` conditional exports to serve different files to different platforms:
- Mobile apps get `.native.tsx` files via React Native bundler
- Web apps get `.tsx` files via web bundler
- Type definitions are shared via `.tsx` files

### Mobile-Only Components (4)
These exist exclusively for mobile and cannot be used on web:
- **ListRow**: iOS-style list row with auto-chevron
- **ListShell**: List container
- **EmptyState**: Full-screen empty state UI
- **Surface**: Mobile surface container

### Dual-Platform Components (12+)
These have separate implementations for web and mobile but share the same export path:
- Button, TextField, TextArea, Text, Heading, Card, Badge, Separator
- Stack, Inline, Page, Field
- Chat components (via index.ts vs index.mobile.ts)

### Shared Everything Else
Design tokens, types, utilities, and hooks are platform-agnostic and used by both web and mobile.

---

## File Locations

```
@hominem/ui Package: /packages/platform/ui/
  ├── src/
  │   ├── components/
  │   │   ├── mobile/           (4 mobile-only components)
  │   │   ├── ui/               (core components - dual/web)
  │   │   ├── layout/           (layout primitives - dual/web)
  │   │   ├── typography/       (text components - dual/web)
  │   │   ├── chat/             (chat UI - dual with separate exports)
  │   │   ├── composer/         (web-only)
  │   │   ├── ai-elements/      (web-only)
  │   │   ├── filters/          (web-only)
  │   │   └── ... (other components)
  │   ├── tokens/               (design tokens - shared)
  │   ├── hooks/                (React hooks - shared)
  │   ├── lib/                  (utilities - shared)
  │   ├── types/                (type definitions - shared)
  │   └── theme.ts              (theme config - shared)
  └── package.json              (exports configuration)

Mobile App: /apps/mobile/
  └── components/ui/            (re-exports from @hominem/ui)

Web App: /apps/web/
```

---

## Development Commands

```bash
# In @hominem/ui directory
pnpm --filter @hominem/ui run typecheck       # Type check
pnpm --filter @hominem/ui run lint            # Lint code
pnpm --filter @hominem/ui run format          # Format code
pnpm --filter @hominem/ui run storybook       # Run Storybook
pnpm --filter @hominem/ui run test:storybook  # Test stories
pnpm --filter @hominem/ui run build:storybook # Build stories
```

---

## Useful Imports

```typescript
// Components
import { Button } from '@hominem/ui/button'
import { TextField } from '@hominem/ui/text-field'
import { Text } from '@hominem/ui/text'
import { ListRow } from '@hominem/ui/list-row'
import { EmptyState } from '@hominem/ui/empty-state'

// Layout
import { Stack } from '@hominem/ui/stack'
import { Page } from '@hominem/ui/page'

// Chat
import { Chat, ChatMessage } from '@hominem/ui/chat'

// Design System
import { colors, spacing } from '@hominem/ui/tokens'
import { shadowsNative } from '@hominem/ui/tokens/shadows'

// Types
import type { UploadedFile } from '@hominem/ui/types/upload'
import type { ExtendedMessage } from '@hominem/ui/types/chat'

// Hooks
import { useApiClient, useMobile } from '@hominem/ui/hooks'
```

---

## Related Resources

- **Main codebase**: `/packages/platform/ui/`
- **Mobile app**: `/apps/mobile/` (see `components/ui/` for re-exports)
- **Web app**: `/apps/web/` (see imports for usage patterns)
- **Storybook**: After running `pnpm --filter @hominem/ui run storybook`

---

## Statistics

| Metric | Count |
|--------|-------|
| Mobile-only components | 4 |
| Dual-platform components | 12+ |
| Web-only components | 40+ |
| Named exports | 41+ |
| Native variant files | 17 |
| Component directories | 12 |
| Mobile app imports | 18 paths |

---

## Document Changelog

- **Created**: April 14, 2026
- **Purpose**: Complete exploration and documentation of @hominem/ui package
- **Scope**: Architecture, components, types, utilities, and integration points
- **Audience**: All developers working with UI components

---

## Questions & Answers

**Q: Can I use ListRow in the web app?**
A: No, ListRow is mobile-only. It has no web export.

**Q: How do I import Button for both platforms?**
A: Use the same import: `import { Button } from '@hominem/ui/button'`. The correct version loads automatically based on the platform.

**Q: Where are the design tokens defined?**
A: In `/packages/platform/ui/src/tokens/` directory. Import them with `import { colors, spacing } from '@hominem/ui/tokens'`.

**Q: Can I extend existing components?**
A: Yes, the mobile app does this in `/apps/mobile/components/ui/` by re-exporting and wrapping components.

**Q: How do I find out what mobile components actually use?**
A: Check `/apps/mobile/components/ui/` for re-exports and search `app/` and `components/` for actual imports.

**Q: Is Storybook documentation available?**
A: Yes, run `pnpm --filter @hominem/ui run storybook` and visit `http://localhost:6006`.

---

**Last updated**: April 14, 2026
**Total documentation**: 4 files, ~50 KB
