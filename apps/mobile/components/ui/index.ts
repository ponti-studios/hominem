// ─── Layer 1: UI Primitives ───────────────────────────────────────────────────
//
// These are the building blocks for all screens and patterns in the mobile app.
// Screens must compose these primitives — never reference raw tokens directly.
//
// Elevation contract:
//   background / bg-base  — page canvas
//   bg-surface            — grouped list shells, raised cards  → Surface elevation="surface"
//   bg-elevated           — floating elements, pressed states  → Surface elevation="elevated"
//
// Layer hierarchy:
//   Layer 0: Token     @hominem/ui/tokens
//   Layer 1: Primitive ~/components/ui/   ← YOU ARE HERE
//   Layer 2: Pattern   ~/components/
//   Layer 3: Screen    ~/app/

export { Surface } from './Surface';
export type { SurfaceProps } from './Surface';

export { Separator } from './Separator';

export { ListShell } from './ListShell';

export { ListRow } from './ListRow';
export type { ListRowProps } from './ListRow';

export { EmptyState } from './EmptyState';

export { Badge } from './Badge';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction } from './Card';

export { default as CustomIcon } from './CustomIcon';
export { default as icon } from './icon';
