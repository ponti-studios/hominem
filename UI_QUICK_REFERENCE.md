# @hominem/ui Quick Reference Guide

## File Locations

### Main Package
```
Location: /packages/platform/ui
Mobile App: /apps/mobile
Web App: /apps/web
```

### Key Directories
```
/packages/platform/ui/src/
├── components/mobile/          # Mobile-only components
├── components/chat/            # Chat UI (separate web/mobile)
├── components/ui/              # Core components
├── components/typography/      # Text/Heading
├── components/layout/          # Stack/Inline/Page
├── tokens/                      # Design tokens
├── hooks/                       # React hooks
├── lib/                         # Utilities
└── types/                       # Type definitions
```

## Mobile-Only Components Quick Access

| Component | Location | Export Path | File |
|-----------|----------|-------------|------|
| ListRow | mobile | `@hominem/ui/list-row` | `components/mobile/list-row.native.tsx` |
| ListShell | mobile | `@hominem/ui/list-shell` | `components/mobile/list-shell.native.tsx` |
| EmptyState | mobile | `@hominem/ui/empty-state` | `components/mobile/empty-state.native.tsx` |
| Surface | mobile | `@hominem/ui/surface` | `components/mobile/surface.native.tsx` |

## Native Component Variants

Dual-platform components with separate implementations:

| Component | Web File | Mobile File | Common Export |
|-----------|----------|-------------|----------------|
| Button | `ui/button.tsx` | `ui/button.native.tsx` | `@hominem/ui/button` |
| TextField | `ui/text-field.tsx` | `ui/text-field.native.tsx` | `@hominem/ui/text-field` |
| TextArea | `ui/text-area.tsx` | `ui/text-area.native.tsx` | `@hominem/ui/text-area` |
| Text | `typography/text.tsx` | `typography/text.native.tsx` | `@hominem/ui/text` |
| Heading | `typography/heading.tsx` | `typography/heading.native.tsx` | `@hominem/ui/heading` |
| Card | `ui/card.tsx` | `ui/card.native.tsx` | `@hominem/ui/card` |
| Badge | `ui/badge.tsx` | `ui/badge.native.tsx` | `@hominem/ui/badge` |
| Separator | `ui/separator.tsx` | `ui/separator.native.tsx` | `@hominem/ui/separator` |
| Stack | `layout/stack.tsx` | `layout/stack.native.tsx` | `@hominem/ui/stack` |
| Inline | `layout/inline.tsx` | `layout/inline.native.tsx` | `@hominem/ui/inline` |
| Page | `layout/page.tsx` | `layout/page.native.tsx` | `@hominem/ui/page` |
| Field | `ui/field.tsx` | `ui/field.native.tsx` | `@hominem/ui/field` |

## Chat Components

### Web Exports (`components/chat/index.ts`)
- Chat
- ChatHeader
- ChatMessage
- ChatMessages / ChatMessageList
- ChatSearchModal
- ChatShimmerMessage
- ChatThinkingIndicator
- ChatVoiceModal
- ClassificationReview
- ContextAnchor
- VoiceModeOverlay

### Mobile Exports (`components/chat/index.mobile.ts`)
- Chat (mobile variant)
- ArtifactActions
- ConversationActionsSheet
- ChatHeader (mobile)
- ChatMessageList (mobile)
- ChatMessage (mobile)
- ChatReviewOverlay
- ChatSearchModal (mobile)
- ChatShimmerMessage (mobile)
- ChatThinkingIndicator (mobile)
- getReferencedNoteLabel
- useChatController (hook)

## Design Tokens

### Import Paths
```typescript
import { colors, spacing, fonts } from '@hominem/ui/tokens'
import { shadowsNative } from '@hominem/ui/tokens/shadows'
import { radiiNative } from '@hominem/ui/tokens'
import { fontFamiliesNative } from '@hominem/ui/tokens/typography.native'
import { durations } from '@hominem/ui/tokens'
```

### Available Tokens
- **colors**: Color palette (foreground, background, primary, destructive, etc.)
- **spacing**: Scale 0-12 (px values: 0, 2, 4, 6, 8, 12, 16, 24, 32, 40, 48, 56, 64)
- **radii** / **radiiNative**: Border radius values
- **shadowsNative**: React Native shadow definitions
- **fontSizes**: Font size values
- **fontWeights**: Font weight values
- **fontFamilies** / **fontFamiliesNative**: Font family definitions
- **durations**: Animation durations (motion.ts)

## Type Definitions

### Chat Types
```typescript
import type { ExtendedMessage } from '@hominem/ui/types/chat'
import { filterMessagesByQuery, findPreviousUserMessage } from '@hominem/ui/types/chat'
```

### Upload Types
```typescript
import type { 
  UploadedFile, 
  ProcessedFile, 
  UploadResponse, 
  FailedUpload 
} from '@hominem/ui/types/upload'
```

## Hooks Available

### Shared Hooks
```typescript
import { 
  useApiClient,
  useFilterState,
  useMediaQuery,
  useMobile,
  useCountdown,
  useMaskedInput
} from '@hominem/ui/hooks'
```

### Advanced Hooks (in lib)
```typescript
import { useAutoScroll } from '@hominem/ui/lib/hooks/use-auto-scroll'
import { useChatMessagesController } from '@hominem/ui/lib/hooks/use-chat-messages-controller'
import { useMessageEdit } from '@hominem/ui/lib/hooks/use-message-edit'
import { useMessageSearch } from '@hominem/ui/lib/hooks/use-message-search'
import { useScrollDetection } from '@hominem/ui/lib/hooks/use-scroll-detection'
import { useSpeech } from '@hominem/ui/lib/hooks/use-speech'
```

## Utility Functions

### Device Detection
```typescript
import { ... } from '@hominem/ui/lib/device'
```

### Clipboard Operations
```typescript
import { ... } from '@hominem/ui/lib/clipboard'
```

### Scroll Utilities
```typescript
import { ... } from '@hominem/ui/lib/scroll'
```

### General Utilities
```typescript
import { ... } from '@hominem/ui/lib/utils'
```

### GSAP Animations
```typescript
import { ... } from '@hominem/ui/lib/gsap/sequences'
```

## Mobile App Component Re-exports

Location: `/apps/mobile/components/ui/`

The mobile app creates wrapper exports:
- `Card.tsx` - Re-exports Card from @hominem/ui
- `Surface.tsx` - Re-exports Surface from @hominem/ui
- `ListRow.tsx` - Re-exports ListRow from @hominem/ui
- `ListShell.tsx` - Re-exports ListShell from @hominem/ui
- `Badge.tsx` - Re-exports Badge from @hominem/ui
- `Separator.tsx` - Re-exports Separator from @hominem/ui
- `EmptyState.tsx` - Re-exports EmptyState from @hominem/ui
- `Button.tsx` - Re-exports Button from @hominem/ui

These re-exports allow custom additions or modifications at the app level.

## Web-Only Components

Components that exist **only** in web (no mobile export):

### Form & Input
- Input
- Label
- Textarea
- SelectField
- InputGroup

### Dialog & Overlays
- Dialog
- AlertDialog
- Sheet
- Popover
- HoverCard

### Menus & Navigation
- DropdownMenu
- CommandPalette (cmdk)
- Tooltip
- ContextMenu
- NavigationMenu
- Menubar

### Data & Lists
- Tabs
- Accordion
- Collapsible
- ScrollArea
- List

### Other
- AspectRatio
- Avatar
- Carousel (embla)
- Calendar
- DatePicker
- Checkbox
- RadioGroup
- Slider
- Switch
- Toggle
- ToggleGroup
- Progress
- Toast/Toaster

## Component-Specific Features

### ListRow
```typescript
interface ListRowProps {
  title: string
  subtitle?: string
  leading?: ReactNode
  trailing?: ReactNode
  onPress?: () => void
  destructive?: boolean
  disabled?: boolean
  accessibilityLabel?: string
}
```
- Auto-shows chevron when onPress provided
- iOS-style styling with SF Symbols
- Accessibility support built-in

### EmptyState
```typescript
interface EmptyStateProps {
  title: string
  description?: string
  sfSymbol: SFSymbol
  action?: { label: string; onPress: () => void }
  bottomOffset?: number
}
```
- Full-screen centered layout
- Fade-in animation
- Optional CTA button

### Button (Native)
- **Variants**: primary, outline, ghost, secondary, destructive
- **Sizes**: xs, sm, md (default), lg, icon, icon-xs
- **Features**: Loading state, disabled state, full width option

### TextField / TextArea (Native)
- Placeholder support
- Error state
- Disabled state
- Clear button (native)
- Accessibility labels

## Accessing the Package

### From Mobile App
```typescript
// Standard import
import { Button } from '@hominem/ui/button'
import { Chat, ChatMessage } from '@hominem/ui/chat'
import { colors, spacing } from '@hominem/ui/tokens'
import { ListRow } from '@hominem/ui/list-row'
```

### From Web App
```typescript
// Standard import
import { Button } from '@hominem/ui/button'
import { Chat, ChatHeader } from '@hominem/ui/chat'
import { Dialog, Popover } from '@hominem/ui'
```

## Package.json Structure

The package uses conditional exports:
```json
{
  "exports": {
    "./button": {
      "types": "./src/components/ui/button.tsx",
      "react-native": "./src/components/ui/button.native.tsx",
      "default": "./src/components/ui/button.tsx"
    }
  }
}
```

This allows:
- **React Native bundlers**: Auto-select `.native.tsx` files
- **Web bundlers**: Use `.tsx` files
- **Type checkers**: Use shared `.tsx` types

## Development Commands

```bash
# Type checking
pnpm --filter @hominem/ui run typecheck

# Linting
pnpm --filter @hominem/ui run lint

# Format code
pnpm --filter @hominem/ui run format

# Run Storybook
pnpm --filter @hominem/ui run storybook

# Test with Storybook
pnpm --filter @hominem/ui run test:storybook

# Build Storybook
pnpm --filter @hominem/ui run build:storybook
```

## Dependencies Summary

### Workspace Packages
- @hominem/auth
- @hominem/chat
- @hominem/rpc
- @hominem/utils

### Web-Focused Libraries
- Radix UI (25+ packages)
- Tailwind CSS
- GSAP (animations)
- React Router
- React Hook Form

### Mobile-Focused Libraries
- React Native
- Expo (expo-symbols, expo-clipboard, expo-file-system, expo-haptics, expo-sharing)
- React Native Reanimated
- React Native Safe Area Context

### Shared Libraries
- @tanstack/react-query
- @tanstack/react-hotkeys
- date-fns
- React Markdown
- class-variance-authority (CVA)

