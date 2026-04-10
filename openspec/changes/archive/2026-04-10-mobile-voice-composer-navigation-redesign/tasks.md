## 1. Setup & Dependencies

- [x] 1.1 Install `@gorhom/bottom-sheet` package
- [x] 1.2 Verify `@gorhom/bottom-sheet` has compatible peer dependencies with RN 0.83
- [x] 1.3 Update `apps/mobile/babel.config.js` if needed for bottom-sheet

## 2. Voice Input - State Machine

- [x] 2.1 Update `use-recorder.ts` to add PAUSED state to RecorderState enum
- [x] 2.2 Add `pauseRecording()` callback to useRecorder hook
- [x] 2.3 Add `resumeRecording()` callback to useRecorder hook
- [x] 2.4 Update VoiceInput.tsx to display pause/resume button
- [x] 2.5 Add duration timer display to VoiceInput.tsx
- [x] 2.6 Add haptic feedback for pause/resume actions

## 3. Voice Input - Waveform Visualization

- [x] 3.1 Create `WaveformVisualizer` component in `components/media/voice/`
- [x] 3.2 Implement animated bars using react-native-reanimated `useAnimatedStyle`
- [x] 3.3 Connect WaveformVisualizer to audio metering from useRecorder
- [x] 3.4 Style bars with destructive color during recording
- [x] 3.5 Add playhead indicator for playback mode

## 4. Voice Input - Playback

- [x] 4.1 Add `usePlayback` hook in `components/media/voice/`
- [x] 4.2 Implement audio playback with expo-av
- [x] 4.3 Add seek/scrub functionality to usePlayback
- [x] 4.4 Update VoiceInput.tsx to show playback controls after recording stops
- [x] 4.5 Display elapsed time and total duration

## 5. Voice Input - Bottom Sheet Modal

- [x] 5.1 Install `@gorhom/bottom-sheet` and configure in VoiceSessionModal
- [x] 5.2 Set up snap points: 50% (default) and 90% (expanded)
- [x] 5.3 Add drag handle to the sheet
- [x] 5.4 Implement gesture-driven dismiss
- [x] 5.5 Add backdrop overlay with tap-to-close
- [x] 5.6 Add spring animation config for sheet transitions

## 6. Composer - Expandable Input

- [x] 6.1 Update MobileComposer text input to use animated height
- [x] 6.2 Set minimum height: 56px (compact)
- [x] 6.3 Set maximum height: 300px (expanded, then scrolls)
- [x] 6.4 Add spring animation for height transitions
- [x] 6.5 Handle `onContentSizeChange` to trigger auto-expand

## 7. Composer - Attachment Thumbnails

- [x] 7.1 Update attachment pills to show image thumbnails instead of text
- [x] 7.2 Use expo-image for thumbnail rendering with size 48x48
- [x] 7.3 Add upload progress overlay on thumbnails
- [x] 7.4 Add retry functionality for failed uploads
- [x] 7.5 Style thumbnails with rounded corners (borderRadius: 4)

## 8. Composer - Draft Persistence

- [x] 8.1 Create `useDraftPersistence` hook in `hooks/`
- [x] 8.2 Implement auto-save every 5 seconds using debounce
- [x] 8.3 Use AsyncStorage for draft storage
- [x] 8.4 Restore draft on component mount
- [x] 8.5 Clear draft on successful submit
- [x] 8.6 Add subtle "Saving..." indicator

## 9. Navigation - Native Bottom Tabs

- [x] 9.1 Replace custom tab implementation in `(tabs)/_layout.tsx` with expo-router Tabs
- [x] 9.2 Add Lucide icons for each tab (Home, FileText, Settings)
- [x] 9.3 Configure tabBarIcon for each screen
- [x] 9.4 Style tab bar with dark theme colors
- [x] 9.5 Add haptic feedback on tab selection
- [x] 9.6 Remove custom NavButton components

## 10. Navigation - Spring Animations

- [x] 10.1 Define spring config: damping: 18, stiffness: 200, mass: 0.8
- [x] 10.2 Update stack screenOptions with spring animation
- [x] 10.3 Configure gestureEnabled: true for swipe back
- [x] 10.4 Add reducedMotion fallback to fade transitions
- [x] 10.5 Test spring animations on iOS simulator

## 11. Navigation - Bottom Sheet for Camera

- [x] 11.1 Convert CameraModal from React Native Modal to bottom sheet
- [x] 11.2 Set snap points: 50% and 90% (for full camera view)
- [x] 11.3 Keep camera preview filling the sheet area
- [x] 11.4 Add close button in top-right corner
- [x] 11.5 Add drag handle for consistency with voice sheet

## 12. Integration & Testing

- [x] 12.1 Run `pnpm exec expo prebuild --platform ios --clean`
- [x] 12.2 Verify voice recording, pause/resume, playback all work
- [x] 12.3 Verify bottom sheet gesture interactions
- [x] 12.4 Verify native tabs work with icons and haptics
- [x] 12.5 Verify composer expandable and draft persistence
- [x] 12.6 Run typecheck: `pnpm --filter @hominem/mobile run typecheck`
- [x] 12.7 Run tests: `pnpm --filter @hominem/mobile run test`
