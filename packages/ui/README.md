# @hominem/ui

Shared UI component library mirrored from Ponti Studios Labs UI. Contains a collection of React components built with:

- **Radix UI** - Unstyled accessible primitives
- **Tailwind CSS** - Utility-first CSS framework
- **CVA** - Class variance authority for component variants
- **Shadcn/ui** - High-quality component patterns

## Installation

This package is part of the monorepo and available via workspace references.

```bash
pnpm add @hominem/ui
```

## Usage

Import components directly from the package:

```tsx
import { Button } from '@hominem/ui';

export function App() {
  return <Button>Click me</Button>;
}
```

### Component Organization

- **UI Components** (`src/components/`): Primitives and base components (Button, Card, Dialog, etc.)
- **Compound Components** (`src/components/compound/`): Higher-level features (Form, Table, etc.)
- **Utilities** (`src/lib/`): Helper functions like `cn()` for classname merging

## Development

#### Build Library

```bash
pnpm build
```

Generates ESM output in `dist/` directory.

#### Type Checking

```bash
pnpm typecheck
```

## Style Guide

Follow these conventions when adding or modifying components:

### Naming

- Use PascalCase for component names: `Button`, `CardHeader`
- Use kebab-case for CSS classes: `btn-primary`, `card-content`

### Variants

Use CVA for all component variants:

```tsx
import { cva } from 'class-variance-authority';

const buttonVariants = cva('inline-flex items-center justify-center', {
  variants: {
    intent: {
      primary: 'bg-primary text-primary-foreground',
      secondary: 'bg-secondary text-secondary-foreground',
    },
    size: {
      small: 'h-8 px-3 text-sm',
      large: 'h-10 px-4 text-lg',
    },
  },
  defaultVariants: {
    intent: 'primary',
    size: 'large',
  },
});
```

### Accessibility

- All interactive components must be keyboard accessible
- Use proper ARIA attributes
- Follow Radix UI accessibility patterns

### Testing

Run type checking and linting before committing:

```bash
pnpm typecheck
pnpm lint
```

## Adding New Components

1. Create the component file in `src/components/` or `src/components/compound/`
2. Add exports to `src/components/index.ts` or `src/components/compound/index.ts`
3. Test the component

## Updating Apps

When adding new components, update imports in apps from local paths to:

```tsx
// Before
import { Button } from '@hominem/ui';

// After
import { Button } from '@hominem/ui';
```

## License

Private - mirrored for Hominem
