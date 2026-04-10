## ADDED Requirements

### Requirement: Haptic feedback triggers on button press

Buttons SHALL trigger haptic feedback on press using expo-haptics.

#### Scenario: Button press triggers impact haptic
- **WHEN** user presses a primary button
- **THEN** `haptics.impactAsync('medium')` is called
- **AND** the device vibrates with medium intensity

### Requirement: Haptic feedback triggers on swipe gestures

Swipe-to-dismiss and horizontal swipe gestures SHALL trigger haptic feedback at gesture boundaries.

#### Scenario: Swipe past threshold triggers selection haptic
- **WHEN** user swipes to delete an item
- **THEN** when swipe exceeds dismiss threshold, `haptics.selectionAsync()` is called

### Requirement: Haptic feedback is disabled when system accessibility setting is on

Haptic feedback SHALL NOT trigger when the system `reduceMotion` accessibility setting is enabled.

#### Scenario: No haptics when reduce motion is on
- **WHEN** `AccessibilityInfo.get(`reduceMotion`) returns `true`
- **THEN** no haptic feedback is triggered on any interaction
