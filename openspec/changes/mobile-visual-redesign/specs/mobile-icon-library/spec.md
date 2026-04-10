## ADDED Requirements

### Requirement: Lucide icons are the single icon source

The mobile app SHALL use `lucide-react-native` for all icons in the UI.

#### Scenario: Icon component wraps Lucide
- **WHEN** `<Icon name="home" />` is rendered
- **THEN** it renders the Lucide `Home` icon with 24px size and 2px stroke

### Requirement: Icon component provides consistent sizing

The Icon component SHALL support standardized sizes: 20px (inline), 24px (default), 32px (headers), 48px (empty states).

#### Scenario: Icon renders at default size
- **WHEN** `<Icon name="settings" />` is rendered
- **THEN** the icon renders at 24x24px with 2px stroke

#### Scenario: Icon renders at custom size
- **WHEN** `<Icon name="settings" size={32} />` is rendered
- **THEN** the icon renders at 32x32px maintaining stroke proportion

### Requirement: Icon component supports dark theme colors

The Icon component SHALL default to `icon-primary` color from the dark theme palette.

#### Scenario: Icon color matches theme
- **WHEN** `<Icon name="user" />` is rendered
- **THEN** the icon color is `theme.colors.iconPrimary`
- **AND** the value resolves to `rgba(245, 246, 248, 1)` (dark mode)

### Requirement: Custom icons can be added alongside Lucide

The app SHALL support adding custom SVG icons for brand-specific needs.

#### Scenario: Custom icon component renders SVG
- **WHEN** `<CustomIcon name="brand-logo" />` is rendered
- **THEN** it renders the custom SVG asset from the icons directory
