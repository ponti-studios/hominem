## ADDED Requirements

### Requirement: Composer input auto-expands based on content

The composer text input SHALL automatically expand from a compact height to accommodate content.

#### Scenario: Empty composer is compact
- **WHEN** composer has no text
- **THEN** the input height is 56px (single line)

#### Scenario: Composer expands as text is entered
- **WHEN** user types text that exceeds one line
- **THEN** the input height grows up to 200px
- **AND** the growth is animated with a smooth transition

### Requirement: Composer has maximum expanded height

The composer SHALL have a maximum expanded height after which it scrolls internally.

#### Scenario: Text exceeds maximum height
- **WHEN** text content height exceeds 300px
- **THEN** the input scrolls internally
- **AND** a scroll indicator appears

### Requirement: Expand animation uses spring physics

The composer expand/collapse animation SHALL use spring physics for a natural feel.

#### Scenario: Expand animation is springy
- **WHEN** composer expands
- **THEN** it uses a spring animation with damping of 15 and stiffness of 150
- **AND** the animation duration is approximately 300ms
