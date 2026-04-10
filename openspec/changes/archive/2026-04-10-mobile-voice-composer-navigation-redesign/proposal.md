## Why

The mobile app's voice input, composer, and navigation systems lack modern polish. Voice recording shows only a basic 12-bar level meter with no waveform, requires a full modal interruption, and has no playback preview. The composer is fixed-height with no draft persistence and text-only attachment pills. Navigation uses custom text-only tabs instead of native iOS bottom tabs. This redesign implements modern patterns from WhatsApp, iOS Voice Memos, Linear, and Apple Notes.

## What Changes

- **Voice Input**: Full waveform visualization, duration timer, pause/resume, slide-to-cancel gesture, playback preview with scrubbing, bottom sheet modal instead of full modal
- **Composer**: Expandable auto-grow input (56px→300px), attachment thumbnails, draft persistence to AsyncStorage, inline voice button in footer
- **Navigation**: Native iOS bottom tabs with Lucide icons, tab selection haptics, spring-based animations (damping: 18, stiffness: 200), bottom sheet for voice/camera modals
- **Loading States**: Skeleton placeholders with shimmer animation for lists

## Capabilities

### New Capabilities

- `mobile-voice-waveform`: Real-time waveform visualization during recording and playback with scrubbing support
- `mobile-voice-pause-resume`: Pause and resume recording without losing audio
- `mobile-voice-playback`: Playback recorded audio with waveform position indicator before sending
- `mobile-voice-sheet-modal`: Bottom sheet presentation for voice recording with snap points
- `mobile-composer-expandable`: Auto-growing text input from 56px to 300px based on content
- `mobile-composer-thumbnails`: Image attachment thumbnails with upload progress
- `mobile-composer-draft-persistence`: Auto-save drafts to AsyncStorage every 5 seconds with restore on mount
- `mobile-nav-native-tabs`: Native iOS bottom tabs with icons, haptic feedback, and native indicator animation
- `mobile-nav-spring-animations`: Spring-based screen transitions replacing linear timing
- `mobile-nav-bottom-sheet`: Gesture-driven bottom sheet modal for voice/camera

### Modified Capabilities

- `mobile-dark-only-theme`: No changes (already dark-only from previous work)
- `mobile-motion-system`: Extend motion presets to include spring animations for navigation
- `mobile-expo-config`: Add `@gorhom/bottom-sheet` dependency

## Impact

- `apps/mobile/components/media/voice/` — Complete voice component redesign
- `apps/mobile/components/media/voice-session-modal.tsx` — Replace Modal with bottom sheet
- `apps/mobile/components/input/mobile-composer.tsx` — Expandable composer with thumbnails
- `apps/mobile/app/(protected)/(tabs)/_layout.tsx` — Replace custom tabs with native Tabs
- `apps/mobile/hooks/` — New voice recording hooks, draft persistence hook
- `packages/platform/ui/src/tokens/` — May need new animation tokens for spring configs
- New dependency: `@gorhom/bottom-sheet`
