## ADDED Requirements

### Requirement: macOS windows disable screen sharing capture
The macOS Apple app SHALL set each application window to disallow screen sharing and screen recording capture of its content.

#### Scenario: Primary app window is created
- **WHEN** the macOS app opens its main window
- **THEN** that window is configured with screen-sharing disabled before the user interacts with signed-in content

#### Scenario: Additional app windows are created
- **WHEN** the macOS app creates another window for the same process
- **THEN** the new window is also configured with screen-sharing disabled

### Requirement: Privacy protection survives signed-in navigation
macOS window privacy protection SHALL remain active while the user navigates between feed, notes, chat, settings, and note detail content.

#### Scenario: User navigates through signed-in content
- **WHEN** the user opens different signed-in screens after the window has been configured
- **THEN** the window continues to report screen-sharing disabled for the duration of that window's lifetime
