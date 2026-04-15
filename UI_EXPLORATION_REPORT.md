# @hominem/ui Package Exploration Report

## Executive Summary

The `@hominem/ui` package at `/packages/platform/ui` is a comprehensive, cross-platform component library that serves both the web and mobile applications. It implements a sophisticated dual-target strategy using conditional exports and platform-specific implementations (`.native.tsx` for React Native, `.tsx` for web).

**Key Statistics:**
- Location: `/packages/platform/ui`
- Native Components: 7 components with `.native.tsx` variants
- Mobile-only Components: 4 mobile-specific components
- Total Export Points: 41+ named exports through package.json
- Shared Dependencies: auth, chat, rpc, utils packages
- UI Framework: Radix UI (web), React Native + expo-symbols (mobile)

---

## 1. Package Structure Overview

### Root Files
```
/packages/platform/ui/
├── package.json              # Exports configuration + dependencies
├── tailwind.config.ts        # Web styling configuration
├── shell-theme.cjs           # Node-compatible theme export
├── components.json           # Component library metadata
├── .storybook/              # Storybook configuration
├── tsconfig.json            # TypeScript configuration
└── src/
```

### Source Directory Structure
```
src/
├── components/              # All UI components
│   ├── ui/                 # Core UI components (button, input, etc.)
│   ├── layout/             # Layout primitives (stack, page, inline)
│   ├── typography/         # Text components (heading, text)
│   ├── mobile/             # Mobile-specific components
│   ├── chat/               # Chat-related components
│   ├── composer/           # Text composition UI (web-only)
│   ├── ai-elements/        # AI-related visual components (web-only)
│   ├── auth/               # Authentication components
│   ├── finance/            # Finance-related components
│   ├── invites/            # Invitation components
│   ├── surfaces/           # Surface/container components
│   ├── filters/            # Filter UI components
│   └── ...
├── hooks/                   # Reusable React hooks
├── lib/                     # Utility functions and helpers
├── types/                   # Shared TypeScript types
├── tokens/                  # Design tokens (colors, spacing, typography)
├── styles/                  # Global CSS
├── constants/               # Constants (chart colors, etc.)
└── theme.ts                 # Theme configuration
```

---

## 2. Mobile Components in the UI Package

### Mobile-Only Components (4 React Native Components)

These components exist **exclusively** for mobile and have `.native.tsx` implementations:

#### 1. **ListRow** (`./components/mobile/list-row.native.tsx`)
- **Purpose**: Renders a standard iOS-style list row
- **Props**:
  - `title` (string) - Primary text
  - `subtitle?` (string) - Secondary text
  - `leading?` (ReactNode) - Icon/element on left
  - `trailing?` (ReactNode) - Custom trailing element (auto-shows chevron if not provided)
  - `onPress?` (callback) - Touch handler
  - `destructive?` (boolean) - Red text styling
  - `disabled?` (boolean) - Grayed out state
- **Features**: 
  - Uses expo-symbols for SF Symbols
  - Pressable with visual feedback
  - Auto-chevron indicator for clickable rows
  - Accessibility support

#### 2. **ListShell** (`./components/mobile/list-shell.native.tsx`)
- **Purpose**: Container for list items with consistent styling
- **Usage**: Wraps ListRow components for consistency

#### 3. **EmptyState** (`./components/mobile/empty-state.native.tsx`)
- **Purpose**: Full-screen empty state UI
- **Props**:
  - `title` (string) - Main message
  - `description?` (string) - Secondary message
  - `sfSymbol` (SFSymbol) - SF Symbol icon name
  - `action?` ({ label, onPress }) - Optional action button
  - `bottomOffset?` (number) - Bottom padding override
- **Features**:
  - Fade-in animation using react-native-reanimated
  - Icon in circular background
  - Centered layout
  - Optional call-to-action button

#### 4. **Surface** (`./components/mobile/surface.native.tsx`)
- **Purpose**: Basic container/surface component for React Native
- **Usage**: Foundational layout primitive for mobile screens

### Native Component Variants (7 Components with Web + Mobile)

These components have both web (`.tsx`) and mobile (`.native.tsx`) implementations:

#### Layout Components
1. **Stack** - Vertical flexbox container
   - Web: CSS Flexbox
   - Mobile: RN View with flexDirection: 'column'

2. **Inline** - Horizontal flexbox container
   - Web: CSS Flexbox (flex-direction: row)
   - Mobile: RN View with flexDirection: 'row'

3. **Page** - Full-page layout container
   - Web: HTML div with layout styles
   - Mobile: RN View with safe area insets

#### Typography Components
4. **Text** - Text rendering component
   - Web: Custom styled component
   - Mobile: RN Text with style variants

5. **Heading** - Heading/title component
   - Web: Semantic HTML heading
   - Mobile: RN Text with heading styles

#### UI Components
6. **Button** - Interactive button element
   - Web: HTML button with Tailwind/CVA styling
   - Mobile: RN Pressable with StyleSheet
   - **Features**: Loading state, variants (primary, outline, ghost), sizes (xs, sm, md, lg, icon)

7. **Card** - Card container
   - Web: Div with shadow and border
   - Mobile: RN View with elevation/shadow

#### Form Components
8. **TextField** - Single-line text input
   - Web: HTML input
   - Mobile: RN TextInput

9. **TextArea** - Multi-line text input
   - Web: HTML textarea
   - Mobile: RN TextInput with multiline

10. **Field** - Form field wrapper
    - Web: Div with label integration
    - Mobile: RN View layout

11. **Badge** - Small label/badge
    - Web: Span with CVA styling
    - Mobile: RN View with background

12. **Separator** - Visual divider
    - Web: HR element
    - Mobile: RN View divider

#### Mobile-Only Chat Components
13. **Chat Components** - Multiple `.mobile.tsx` variants for chat UI:
    - `chat.mobile.tsx` - Main chat container
    - `chat-message.mobile.tsx` - Individual message rendering
    - `chat-message-list.mobile.tsx` - List of messages
    - `chat-header.mobile.tsx` - Chat header
    - `chat-thinking-indicator.mobile.tsx` - AI thinking animation
    - `chat-shimmer-message.mobile.tsx` - Loading skeleton
    - `chat-search-modal.mobile.tsx` - Search interface
    - `chat-review-overlay.mobile.tsx` - Message review UI
    - `artifact-actions.mobile.tsx` - Actions for artifacts
    - `conversation-actions.mobile.tsx` - Conversation menu
    - `context-anchor.mobile.tsx` - Context/reference display
    - `classification-review.mobile.tsx` - Classification UI

---

## 3. Components Actually Used in Mobile App

### Direct UI Imports in Mobile App (18 import paths)

The mobile app (`/apps/mobile`) imports from @hominem/ui package:

```
@hominem/ui/button           ✓ (Button component)
@hominem/ui/badge            ✓ (Badge component)
@hominem/ui/card             ✓ (Card component)
@hominem/ui/chat             ✓ (Chat components - uses index.mobile.ts)
@hominem/ui/chat/referenced-notes  ✓ (Chat utilities)
@hominem/ui/empty-state      ✓ (EmptyState component)
@hominem/ui/list-row         ✓ (ListRow component)
@hominem/ui/list-shell       ✓ (ListShell component)
@hominem/ui/page             ✓ (Page layout component)
@hominem/ui/separator        ✓ (Separator component)
@hominem/ui/surface          ✓ (Surface component)
@hominem/ui/text-field       ✓ (TextField input)
@hominem/ui/text             ✓ (Text component)
@hominem/ui/theme            ✓ (Theme configuration)
@hominem/ui/tokens           ✓ (Design tokens)
@hominem/ui/tokens/shadows   ✓ (Shadow tokens)
@hominem/ui/tokens/typography.native  ✓ (Native typography)
@hominem/ui/types/upload     ✓ (Upload type definitions)
```

### Component Usage Locations
- **Button**: Auth screens, forms, error boundaries, empty states
- **TextField/TextArea**: Login, verification, onboarding forms
- **Text**: Content rendering, labels, headings
- **Screen/Page**: Layout container for all screens
- **Chat Components**: Chat tab, message display, thinking indicators
- **ListRow/ListShell**: Settings, lists, navigation
- **EmptyState**: No data states, placeholder screens
- **Card**: Note previews, UI containers
- **Badge**: Status indicators, tags
- **Tokens/Styling**: Color, spacing, typography throughout

---

## 4. Overall Structure and Dependencies

### Package.json Dependencies

#### Internal Workspace Packages
```json
"@hominem/auth": "workspace:*"       // Authentication utilities
"@hominem/chat": "workspace:*"       // Chat logic and types
"@hominem/rpc": "workspace:*"        // RPC types and definitions
"@hominem/utils": "workspace:*"      // Utility functions
```

#### External UI Libraries (Web-focused)
```json
// Radix UI (Web component primitives)
@radix-ui/react-*: 25+ packages
  - dialog, dropdown-menu, popover, tooltip, select
  - checkbox, radio-group, switch, slider
  - tabs, accordion, collapsible, alert-dialog
  - scroll-area, hover-card, context-menu, etc.

// Web Utilities
"class-variance-authority": CVA for variant styling
"clsx": Class name utility
"cmdk": Command palette
"date-fns": Date manipulation
"react-day-picker": Calendar component
"react-markdown": Markdown rendering
"react-syntax-highlighter": Code highlighting
"embla-carousel-react": Carousel/slider
"vaul": Drawer/sidebar component
"gsap": Animation library
"tailwindcss": Utility CSS framework
"lucide-react": Icon library
```

#### Mobile/Cross-platform Libraries
```json
"expo-symbols": SF Symbols for iOS
"react-native-reanimated": Native animations
"react-native-safe-area-context": Safe area handling
"react-native-markdown-display": Mobile markdown
"react-hook-form": Form state management
"@tanstack/react-query": Data fetching
```

### Export Configuration Strategy

The package uses **conditional exports** in package.json:

```json
{
  "exports": {
    "./button": {
      "types": "./src/components/ui/button.tsx",
      "react-native": "./src/components/ui/button.native.tsx",
      "default": "./src/components/ui/button.tsx"
    },
    "./chat": {
      "types": "./src/components/chat/index.ts",
      "react-native": "./src/components/chat/index.mobile.ts",
      "default": "./src/components/chat/index.ts"
    }
  }
}
```

This allows:
- Web apps to use standard web exports
- Mobile apps to use `.native.tsx` and `.mobile.ts` variants
- Type definitions available for both

---

## 5. Shared Types and Utilities

### Type Definitions

#### Chat Types (`src/types/chat.ts`)
```typescript
type ExtendedMessage = ChatMessageDto & {
  isStreaming?: boolean;
};

// Utilities
filterMessagesByQuery(messages, query)
findPreviousUserMessage(messages, startIndex)
```

#### Upload Types (`src/types/upload.ts`)
```typescript
interface ProcessedFile {
  id, originalName, type, mimetype, size
  content?, textContent?, metadata?
  thumbnail?, duration?, transcription?
}

interface UploadedFile extends ProcessedFile {
  url, uploadedAt, vectorIds?
}

interface UploadResponse {
  success, files, failed, message, error?
}
```

### Design Tokens (`src/tokens/`)

Exported as constants for consistent styling across platforms:

```typescript
// colors.ts - Color palette
export const colors = {
  foreground, background, 'bg-elevated'
  primary, secondary, destructive
  'text-tertiary', 'text-secondary'
  // etc...
}

// spacing.ts - Spacing scale [0-12]
export const spacing = [0, 2, 4, 6, 8, 12, 16, 24, 32, 40, 48, 56, 64]

// typography.ts / typography.native.ts
export const fontSizes, fontWeights, fontFamilies
export const fontFamiliesNative (mobile-specific)

// radii.ts / radii.native.ts - Border radius tokens
export const radii, radiiNative

// shadows.ts - Shadow definitions
export const shadowsNative (mobile shadows)

// motion.ts - Animation/transition tokens
export const durations, easing, etc.
```

### Utility Functions & Hooks

#### Hooks (`src/hooks/`)
```typescript
useApiClient()          // API client factory
useFilterState()        // Filter state management
useMediaQuery()         // Responsive queries
useMobile()            // Is mobile detection
useCountdown()         // Countdown timer
useMaskedInput()       // Input masking for forms
```

#### Utilities (`src/lib/`)
```typescript
device.ts              // Device detection
clipboard.ts           // Clipboard operations
scroll.ts              // Scroll utilities
utils.ts               // General utilities
gsap/sequences.ts      // Animation sequences

// lib/hooks/
useAutoScroll()        // Auto-scroll functionality
useChatMessagesController()  // Chat control logic
useMessageEdit()       // Message editing
useMessageSearch()     // Message search
useScrollDetection()   // Scroll position detection
useSpeech()           // Speech recognition/synthesis
```

---

## 6. Components Shared with Web vs. Mobile

### Fully Shared Components (Same Implementation)
- Design tokens and theme
- Type definitions (chat, upload)
- Utility functions
- Hook base implementations

### Dual-Platform Components (Separate Implementations)
Mobile-specific export path with conditional fallback:
- Button
- TextField / TextArea
- Text / Heading
- Card
- Badge
- Separator
- Layout primitives (Stack, Inline, Page)
- Chat components (index.mobile.ts vs index.ts)

### Web-Only Components (No Mobile Exports)
- Dialog, AlertDialog
- Dropdown menu
- Select field
- Input group
- Hover card
- Popover
- Tabs
- Toast/Toaster
- Composer components
- AI elements
- Filters
- Surfaces

### Mobile-Only Components (No Web Exports)
- ListRow
- ListShell
- EmptyState
- Surface (in mobile context)

---

## 7. Key Architecture Decisions

### 1. **Conditional Exports Pattern**
```json
"./button": {
  "react-native": "./src/components/ui/button.native.tsx",
  "default": "./src/components/ui/button.tsx"
}
```
**Benefit**: Single import path works for both platforms
**Tool Support**: Works with Metro (React Native) and bundlers (web)

### 2. **Shared Design Tokens**
All platforms use same token values (colors, spacing, etc.)
Ensures visual consistency across web and mobile

### 3. **Platform-Specific Component Libraries**
- **Web**: Radix UI + Tailwind for rich interactions and styling
- **Mobile**: React Native + Expo for native performance

### 4. **Chat Component Separation**
- `index.ts` exports web chat components
- `index.mobile.ts` exports mobile chat components with different rendering

### 5. **Storybook Documentation**
Extensive stories for all components in `.stories.tsx` files
Used for visual testing and documentation

---

## 8. Summary Table: Mobile Component Coverage

| Component | Mobile | Web | Platform | Native Variant |
|-----------|--------|-----|----------|----------------|
| Button | ✓ | ✓ | Both | `.native.tsx` |
| TextField | ✓ | ✓ | Both | `.native.tsx` |
| TextArea | ✓ | ✓ | Both | `.native.tsx` |
| Text | ✓ | ✓ | Both | `.native.tsx` |
| Heading | ✓ | ✓ | Both | `.native.tsx` |
| Stack | ✓ | ✓ | Both | `.native.tsx` |
| Inline | ✓ | ✓ | Both | `.native.tsx` |
| Page | ✓ | ✓ | Both | `.native.tsx` |
| Card | ✓ | ✓ | Both | `.native.tsx` |
| Badge | ✓ | ✓ | Both | `.native.tsx` |
| Separator | ✓ | ✓ | Both | `.native.tsx` |
| ListRow | ✓ | ✗ | Mobile | `.native.tsx` |
| ListShell | ✓ | ✗ | Mobile | `.native.tsx` |
| EmptyState | ✓ | ✗ | Mobile | `.native.tsx` |
| Surface | ✓ | ✗ | Mobile | `.native.tsx` |
| Chat* | ✓ | ✓ | Both | `index.mobile.ts` |
| Dialog | ✗ | ✓ | Web | N/A |
| Composer | ✗ | ✓ | Web | N/A |
| AI Elements | ✗ | ✓ | Web | N/A |
| Filters | ✗ | ✓ | Web | N/A |

---

## 9. Integration Points

### Mobile App Integration
- 18 import paths from @hominem/ui
- Located at: `/apps/mobile`
- Custom re-exports in `/apps/mobile/components/ui/`
- Uses all tokens and design system
- Relies on native chat components for messaging UI

### Web App Integration
- Focused subset of exports
- Located at: `/apps/web`
- Uses Radix UI components extensively
- Uses composer and AI elements for rich editing

---

## 10. Development Workflow

### Testing
```bash
pnpm --filter @hominem/ui run typecheck
pnpm --filter @hominem/ui run test:storybook
pnpm --filter @hominem/ui run build:storybook
```

### Documentation
- Storybook at `packages/platform/ui/.storybook`
- Story files (`.stories.tsx`) for all major components
- Viewable at: `http://localhost:6006` after running storybook

### Building
- TypeScript compilation
- Storybook static generation
- Type checking with tsc

