# @hominem/ui Architecture & Component Hierarchy

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     @hominem/ui Package                          │
│               /packages/platform/ui                              │
└─────────────────────────────────────────────────────────────────┘
           │
           ├─ Conditional Exports (package.json)
           │  ├─ React Native bundlers → .native.tsx files
           │  ├─ Web bundlers → .tsx files
           │  └─ Type checkers → shared .tsx types
           │
           ├─ Design System (Tokens)
           │  ├─ Colors, Spacing, Typography
           │  ├─ Radii, Shadows, Motion
           │  └─ Shared across ALL platforms
           │
           ├─ Shared Components & Utils
           │  ├─ Hooks (useApiClient, useFilterState, etc.)
           │  ├─ Types (chat, upload)
           │  ├─ Libraries (clipboard, scroll, device)
           │  └─ Theme configuration
           │
           └─ Platform-Specific Components
              ├─ Web-Only (40+ components)
              │  ├─ Dialog, Dropdown, Tabs, etc.
              │  ├─ Composer, AI Elements
              │  └─ Radix UI based
              │
              ├─ Dual-Platform (12 components)
              │  ├─ Button, TextField, Text, Heading
              │  ├─ Card, Badge, Separator
              │  ├─ Stack, Inline, Page, Field
              │  └─ Conditional exports
              │
              └─ Mobile-Only (4 components)
                 ├─ ListRow (iOS-style list)
                 ├─ ListShell (list container)
                 ├─ EmptyState (full-screen state)
                 └─ Surface (mobile container)
```

## Component Organization Tree

```
/packages/platform/ui/src/components/
│
├── mobile/ (React Native only)
│   ├── list-row.native.tsx
│   ├── list-shell.native.tsx
│   ├── empty-state.native.tsx
│   └── surface.native.tsx
│
├── ui/ (Core UI Components)
│   ├── button.tsx + button.native.tsx         ← Dual
│   ├── text-field.tsx + text-field.native.tsx ← Dual
│   ├── text-area.tsx + text-area.native.tsx   ← Dual
│   ├── card.tsx + card.native.tsx             ← Dual
│   ├── badge.tsx + badge.native.tsx           ← Dual
│   ├── separator.tsx + separator.native.tsx   ← Dual
│   ├── field.tsx + field.native.tsx           ← Dual
│   │
│   ├── dialog.tsx                              ← Web only
│   ├── alert-dialog.tsx                        ← Web only
│   ├── input.tsx                               ← Web only
│   ├── label.tsx                               ← Web only
│   ├── textarea.tsx                            ← Web only
│   ├── select-field.tsx                        ← Web only
│   ├── dropdown-menu.tsx                       ← Web only
│   ├── input-group.tsx                         ← Web only
│   ├── popover.tsx                             ← Web only
│   ├── hover-card.tsx                          ← Web only
│   ├── sheet.tsx                               ← Web only
│   ├── tabs.tsx                                ← Web only
│   ├── accordion.tsx                           ← Web only
│   ├── checkbox.tsx                            ← Web only
│   ├── radio-group.tsx                         ← Web only
│   ├── slider.tsx                              ← Web only
│   ├── switch.tsx                              ← Web only
│   ├── toggle.tsx                              ← Web only
│   ├── toggle-group.tsx                        ← Web only
│   ├── progress.tsx                            ← Web only
│   ├── toast.tsx + toaster.tsx                 ← Web only
│   ├── aspect-ratio.tsx                        ← Web only
│   ├── avatar.tsx                              ← Web only
│   ├── calendar.tsx                            ← Web only
│   ├── carousel.tsx                            ← Web only
│   ├── carousel.stories.tsx                    ← Web only
│   ├── button-group.tsx                        ← Web only
│   ├── command.tsx                             ← Web only
│   ├── scroll-area.tsx                         ← Web only
│   └── collapsible.tsx                         ← Web only
│
├── typography/ (Text Components)
│   ├── text.tsx + text.native.tsx              ← Dual
│   ├── heading.tsx + heading.native.tsx        ← Dual
│   ├── typography-scale.stories.tsx
│   └── text.types.ts
│
├── layout/ (Layout Primitives)
│   ├── stack.tsx + stack.native.tsx            ← Dual
│   ├── inline.tsx + inline.native.tsx          ← Dual
│   ├── page.tsx + page.native.tsx              ← Dual
│   ├── center.tsx                              ← Web only
│   ├── header.tsx                              ← Web only
│   ├── page-container.tsx                      ← Web only
│   ├── landing-page.tsx                        ← Web only
│   └── shared.tsx
│
├── chat/ (Chat UI Components)
│   ├── index.ts                  ← Web exports
│   ├── index.mobile.ts           ← Mobile exports
│   │
│   ├── Web-only:
│   │   ├── chat.tsx
│   │   ├── chat-header.tsx
│   │   ├── chat-message.tsx
│   │   ├── chat-messages.tsx
│   │   ├── chat-search-modal.tsx
│   │   ├── chat-voice-modal.tsx
│   │   ├── voice-mode-overlay.tsx
│   │   ├── classification-review.tsx
│   │   └── context-anchor.tsx
│   │
│   ├── Mobile-only:
│   │   ├── chat.mobile.tsx
│   │   ├── chat-header.mobile.tsx
│   │   ├── chat-message.mobile.tsx
│   │   ├── chat-message-list.mobile.tsx
│   │   ├── chat-search-modal.mobile.tsx
│   │   ├── chat-review-overlay.mobile.tsx
│   │   ├── artifact-actions.mobile.tsx
│   │   ├── conversation-actions.mobile.tsx
│   │   ├── context-anchor.mobile.tsx
│   │   ├── classification-review.mobile.tsx
│   │   ├── use-chat-controller.mobile.ts
│   │   └── chat-thinking-indicator.mobile.tsx
│   │
│   └── Shared:
│       ├── chat-shimmer-message.tsx
│       ├── chat-thinking-indicator.tsx
│       ├── chat.types.ts
│       ├── chat-story-data.tsx
│       ├── referenced-notes.ts
│       ├── conversation-actions.model.ts
│       └── conversation-actions.model.test.ts
│
├── composer/ (Rich Text Editing - Web only)
│   ├── index.ts
│   ├── composer-shell.tsx
│   ├── composer-provider.tsx
│   ├── composer-tools.tsx
│   ├── composer-actions-row.tsx
│   ├── composer-attachment-list.tsx
│   ├── attached-notes-list.tsx
│   ├── note-picker-dialog.tsx
│   ├── voice-dialog.tsx
│   ├── mobile-gestures.ts
│   ├── recording-clock.ts
│   └── (multiple .stories.tsx files)
│
├── ai-elements/ (AI UI Components - Web only)
│   ├── index.ts
│   ├── markdown-content.tsx
│   ├── code-block.tsx
│   ├── tool.tsx
│   ├── reasoning.tsx
│   ├── checkpoint.tsx
│   ├── sources.tsx
│   ├── confirmation.tsx
│   ├── attachments.tsx
│   ├── speech-input.tsx
│   └── (multiple .stories.tsx files)
│
├── filters/ (Filter UI - Web only)
│   ├── index.ts
│   ├── active-filters-bar.tsx
│   ├── filter-chip.tsx
│   ├── filter-controls.tsx
│   ├── filter-select.tsx
│   └── (multiple .stories.tsx files)
│
├── auth/
│   └── (authentication components)
│
├── finance/
│   └── (financial components)
│
├── invites/
│   └── (invite components)
│
├── surfaces/
│   └── (surface components)
│
├── loading-state.tsx + loading-state.native.tsx
├── page-title.tsx
├── date-picker.tsx
├── list.tsx
└── update-guard.tsx
```

## Export Resolution Flow

### When Mobile App Imports Button

```
Mobile App: import { Button } from '@hominem/ui/button'
                    ↓
            package.json exports config
                    ↓
    "react-native" condition matches
                    ↓
    Resolves to: ./src/components/ui/button.native.tsx
                    ↓
            React Native Pressable Component
            StyleSheet-based styling
            Native text rendering
```

### When Web App Imports Button

```
Web App: import { Button } from '@hominem/ui/button'
                    ↓
            package.json exports config
                    ↓
    "default" condition matches
                    ↓
    Resolves to: ./src/components/ui/button.tsx
                    ↓
            HTML Button Element
            Tailwind + CVA styling
            Radix UI accessibility
```

## Dependency Flow

```
@hominem/ui
├── Depends on:
│   ├── @hominem/auth (workspace)
│   ├── @hominem/chat (workspace)
│   ├── @hominem/rpc (workspace)
│   └── @hominem/utils (workspace)
│
├── Web Dependencies:
│   ├── Radix UI (25+ components)
│   ├── Tailwind CSS
│   ├── GSAP (animations)
│   ├── React Router
│   ├── React Hook Form
│   ├── React Markdown
│   ├── React Syntax Highlighter
│   ├── Lucide React (icons)
│   └── ... (others)
│
├── Mobile Dependencies:
│   ├── React Native
│   ├── Expo (symbols, clipboard, etc.)
│   ├── React Native Reanimated
│   ├── React Native Safe Area
│   └── ... (others)
│
└── Shared Dependencies:
    ├── @tanstack/react-query
    ├── @tanstack/react-hotkeys
    ├── React Hook Form
    ├── date-fns
    ├── class-variance-authority
    └── clsx
```

## Used Components in Mobile App

```
/apps/mobile uses:
│
├── Layout
│   ├── Screen (Page)
│   └── Navigation containers
│
├── Forms & Input
│   ├── TextField (login, verification, onboarding)
│   └── TextArea
│
├── Display
│   ├── Text (content rendering)
│   ├── Heading
│   ├── Button (actions, forms)
│   ├── Badge (status indicators)
│   └── Card (containers)
│
├── Lists
│   ├── ListRow (settings, navigation)
│   ├── ListShell (list container)
│   └── Separator (dividers)
│
├── Chat
│   ├── Chat (main container)
│   ├── ChatMessage
│   ├── ChatMessageList
│   ├── ChatHeader
│   ├── ChatThinkingIndicator
│   ├── ChatShimmerMessage
│   └── ChatSearchModal
│
├── Empty States
│   └── EmptyState (no data screens)
│
└── Design System
    ├── colors
    ├── spacing
    ├── typography tokens
    ├── shadows
    └── motion tokens
```

## Mobile vs Web Component Matrix

```
┌──────────────────┬────────────┬────────────┐
│    Component     │   Mobile   │    Web     │
├──────────────────┼────────────┼────────────┤
│ ListRow          │     ✓      │            │
│ ListShell        │     ✓      │            │
│ EmptyState       │     ✓      │            │
│ Surface          │     ✓      │            │
│ Button           │  ✓ (dual)  │  ✓ (dual)  │
│ TextField        │  ✓ (dual)  │  ✓ (dual)  │
│ TextArea         │  ✓ (dual)  │  ✓ (dual)  │
│ Text             │  ✓ (dual)  │  ✓ (dual)  │
│ Heading          │  ✓ (dual)  │  ✓ (dual)  │
│ Card             │  ✓ (dual)  │  ✓ (dual)  │
│ Badge            │  ✓ (dual)  │  ✓ (dual)  │
│ Separator        │  ✓ (dual)  │  ✓ (dual)  │
│ Stack            │  ✓ (dual)  │  ✓ (dual)  │
│ Inline           │  ✓ (dual)  │  ✓ (dual)  │
│ Page             │  ✓ (dual)  │  ✓ (dual)  │
│ Field            │  ✓ (dual)  │  ✓ (dual)  │
│ Chat             │  ✓ (mobile)│  ✓ (web)   │
│ Dialog           │            │     ✓      │
│ Dropdown         │            │     ✓      │
│ Popover          │            │     ✓      │
│ Tabs             │            │     ✓      │
│ Accordion        │            │     ✓      │
│ Composer         │            │     ✓      │
│ AI Elements      │            │     ✓      │
│ Filters          │            │     ✓      │
└──────────────────┴────────────┴────────────┘

Legend:
  ✓ (dual)   = Same export path, different impl
  ✓ (mobile) = Mobile-specific export
  ✓ (web)    = Web-specific export
  ✓          = Available for that platform
  blank      = Not available
```

## Token System Architecture

```
@hominem/ui/tokens
│
├── colors.ts
│   └── Color palette object
│       ├── foreground, background
│       ├── primary, secondary, destructive
│       ├── text-primary, text-secondary, text-tertiary
│       └── bg-elevated, border, etc.
│
├── spacing.ts
│   └── [0, 2, 4, 6, 8, 12, 16, 24, 32, 40, 48, 56, 64]
│
├── typography.ts
│   └── Font sizes, weights, families (web)
│
├── typography.native.ts
│   └── Font families specific to React Native
│
├── typography.shared.ts
│   └── Shared font definitions
│
├── radii.ts
│   └── Border radius tokens (web)
│
├── radii.native.ts (via tokens export)
│   └── radiiNative border radius (mobile)
│
├── shadows.ts
│   └── Web shadows
│
├── shadows.ts (shadowsNative)
│   └── React Native shadow definitions
│
├── motion.ts
│   └── durations, easing, delays
│
└── index.ts
    └── Main export barrel file
        ├── colors
        ├── spacing
        ├── typography
        ├── radii / radiiNative
        ├── shadows / shadowsNative
        ├── motion tokens
        └── types
```

## Type System

```
@hominem/ui/types/
│
├── chat.ts
│   ├── ExtendedMessage type
│   ├── filterMessagesByQuery()
│   └── findPreviousUserMessage()
│
└── upload.ts
    ├── ProcessedFile interface
    ├── UploadedFile interface
    ├── FailedUpload interface
    └── UploadResponse interface
```

## Hooks & Utilities Architecture

```
@hominem/ui/hooks/
├── useApiClient()
├── useFilterState()
├── useMediaQuery()
├── useMobile()
├── useCountdown()
└── useMaskedInput()

@hominem/ui/lib/
├── device.ts (device detection)
├── clipboard.ts (clipboard ops)
├── scroll.ts (scroll utilities)
├── utils.ts (general utilities)
├── gsap/ (animation sequences)
└── hooks/
    ├── useAutoScroll()
    ├── useChatMessagesController()
    ├── useMessageEdit()
    ├── useMessageSearch()
    ├── useScrollDetection()
    └── useSpeech()
```

