# mobile-nav-native-tabs Specification

## Purpose
TBD - created by archiving change mobile-voice-composer-navigation-redesign. Update Purpose after archive.
## Requirements
### Requirement: Navigation uses native iOS bottom tabs

The app SHALL use native iOS bottom tabs instead of custom tab buttons.

#### Scenario: Bottom tabs render correctly
- **WHEN** user is on a tabbed screen
- **THEN** a native iOS tab bar appears at the bottom
- **AND** it uses the system tab bar appearance

### Requirement: Tab bar shows icons

Each tab SHALL display an icon from the Lucide icon library.

#### Scenario: Feed tab has icon
- **WHEN** Feed tab is displayed
- **THEN** it shows a Home icon from Lucide
- **AND** the icon uses the active/inactive color based on selection state

#### Scenario: Notes tab has icon
- **WHEN** Notes tab is displayed
- **THEN** it shows a FileText icon from Lucide
- **AND** the icon uses the active/inactive color based on selection state

#### Scenario: Settings tab has icon
- **WHEN** Settings tab is displayed
- **THEN** it shows a Settings icon from Lucide
- **AND** the icon uses the active/inactive color based on selection state

### Requirement: Tab selection triggers haptic feedback

Selecting a tab SHALL trigger a light haptic feedback.

#### Scenario: Tab selection haptic
- **WHEN** user taps a tab
- **THEN** a light impact haptic is triggered
- **AND** the tab icon animates to the selected state

### Requirement: Tab bar respects theme colors

The tab bar SHALL use the app's dark theme colors.

#### Scenario: Active tab color matches theme
- **WHEN** a tab is active
- **THEN** its icon and label use theme.colors.foreground
- **AND** the indicator uses theme.colors.foreground

#### Scenario: Inactive tab color matches theme
- **WHEN** a tab is inactive
- **THEN** its icon and label use theme.colors['text-secondary']

