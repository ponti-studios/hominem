# mobile-nav-spring-animations Specification

## Purpose
TBD - created by archiving change mobile-voice-composer-navigation-redesign. Update Purpose after archive.
## Requirements
### Requirement: Screen transitions use spring animations

Navigation screen transitions SHALL use spring-based animations instead of linear timing.

#### Scenario: Stack push uses spring
- **WHEN** user navigates to a new screen
- **THEN** the push animation uses spring physics
- **AND** the spring has damping of 18, stiffness of 200

#### Scenario: Stack pop uses spring
- **WHEN** user goes back to a previous screen
- **THEN** the pop animation uses spring physics
- **AND** the spring has damping of 18, stiffness of 200

### Requirement: Animation duration is approximately 350ms

Spring animations SHALL feel natural and complete within approximately 350ms.

#### Scenario: Transition feels responsive
- **WHEN** spring animation is configured correctly
- **THEN** most transitions complete between 300-400ms
- **AND** the animation feels snappy but not abrupt

### Requirement: Gesture-based navigation is enabled

Screen navigation SHALL support iOS gesture-based navigation (swipe back).

#### Scenario: Swipe back is enabled
- **WHEN** user is on a screen with a previous screen in the stack
- **THEN** swiping from the left edge navigates back
- **AND** the gesture uses the same spring animation as programmatic navigation

### Requirement: Reduced motion disables spring animations

When reduced motion is enabled, the app SHALL fall back to basic fade transitions.

#### Scenario: Reduced motion disables springs
- **WHEN** AccessibilityInfo.isReduceMotionEnabled() returns true
- **THEN** screen transitions use fade instead of spring
- **AND** the fade duration is 200ms

