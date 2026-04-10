## ADDED Requirements

### Requirement: Motion system provides enter/exit animation presets

The motion system SHALL export animation presets that components can use for enter and exit animations.

#### Scenario: Fade enter animation
- **WHEN** a component uses `fadeEnter` preset
- **THEN** it animates from `opacity: 0` to `opacity: 1` over 200ms with ease-out curve

#### Scenario: Slide up enter animation
- **WHEN** a component uses `slideUpEnter` preset
- **THEN** it animates `translateY: 20 → 0` and `opacity: 0 → 1` with spring damping of 15

#### Scenario: Scale in enter animation
- **WHEN** a component uses `scaleInEnter` preset
- **THEN** it animates `scale: 0.95 → 1` and `opacity: 0 → 1` with spring damping of 12

### Requirement: Motion system provides micro-interaction presets

The motion system SHALL export presets for press states and gesture feedback.

#### Scenario: Press scale animation
- **WHEN** a button uses `pressScale` preset
- **THEN** on press-in it animates `scale: 1 → 0.97` over 100ms
- **AND** on press-out it animates `scale: 0.97 → 1` with spring

### Requirement: Motion components are worklet-compatible

All animation functions and presets SHALL be worklets that run on the UI thread.

#### Scenario: Animations run without JS bridge
- **WHEN** an animated component mounts with an enter animation
- **THEN** the animation runs on the UI thread
- **AND** no "function is not a worklet" errors appear in development

### Requirement: Skeleton shimmer animation runs smoothly

Loading skeleton states SHALL use reanimated-based shimmer that runs at 60fps.

#### Scenario: Skeleton shimmer cycles continuously
- **WHEN** a skeleton component renders
- **THEN** it displays a linear gradient sweep animation
- **AND** the animation runs at 60fps without blocking JS thread
