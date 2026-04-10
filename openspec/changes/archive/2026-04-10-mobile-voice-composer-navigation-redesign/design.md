## Context

The mobile app's core interaction patterns—voice input, content creation, and navigation—feel dated compared to modern apps like WhatsApp, iOS Voice Memos, Linear, and Apple Notes. Voice recording uses a basic 12-bar level meter with a full modal interruption. The composer is fixed-height with no draft persistence. Navigation uses custom text-only pill buttons instead of native iOS bottom tabs.

Current constraints:
- React Native 0.83 with Expo SDK 55
- `react-native-reanimated` v4 with `react-native-worklets`
- `expo-router` for file-based routing
- `@shopify/restyle` for theming
- `@gorhom/bottom-sheet` needs to be added

## Goals / Non-Goals

**Goals:**
- Voice recording: waveform visualization, pause/resume, slide-to-cancel, playback preview, bottom sheet presentation
- Composer: expandable input, attachment thumbnails, draft persistence
- Navigation: native iOS bottom tabs with icons, spring animations, bottom sheet modals
- Loading: skeleton placeholders for lists

**Non-Goals:**
- Complete rearchitecture of voice transcription (API is external)
- Real-time streaming transcription (depends on API capability)
- Shared element transitions between list and detail (future enhancement)
- Custom waveform rendering with Skia (use Reanimated-only approach)
- Light mode support

## Decisions

### 1. Bottom Sheet Library: @gorhom/bottom-sheet

**Decision:** Use `@gorhom/bottom-sheet` for all modal presentations (voice, camera).

**Rationale:**
- Built on `react-native-reanimated` and `react-native-gesture-handler` (already dependencies)
- Gesture-driven with snap points (0%, 50%, 90%)
- Smooth spring animations out of the box
- Backdrop blur support on iOS
- TypeScript support, well-maintained

**Alternatives considered:**
- `react-native-modal` — Not gesture-driven, different animation model
- Build own with Reanimated — Reinventing the wheel, more maintenance burden
- Expo's built-in modal — Too basic, no snap points

### 2. Waveform Visualization: Reanimated-Only (No Skia)

**Decision:** Use Reanimated's `useAnimatedStyle` and `interpolate` to create a pulse/level animation, NOT a true waveform from audio data.

**Rationale:**
- Skia has known compatibility issues with React Native 0.83
- Real audio waveform requires PCM data access which is complex
- Users primarily need visual feedback that recording is happening
- Can upgrade to Skia later if issues are resolved

**Implementation:**
```typescript
// Pulsing waveform bars driven by audio metering
const barHeights = meterings.slice(-12).map((level, i) => {
  const normalized = (level + 50) / 50; // -50dB to 0dB
  return interpolate(normalized, [0, 1], [5, maxHeight]);
});
```

**Alternatives considered:**
- Skia canvas rendering — Compatibility issues with RN 0.83
- react-native-waveform — Not maintained, limited customization

### 3. Native Tabs: expo-router Tabs Component

**Decision:** Replace custom tab implementation with expo-router's native `Tabs` component.

**Rationale:**
- Native iOS tab bar with proper blur effects
- Built into expo-router (no extra dependency)
- Works with standard React Navigation patterns
- Supports tab bar icons via `tabBarIcon`
- Native haptic feedback on selection

**Implementation:**
```typescript
import { Tabs } from 'expo-router';

<Tabs screenOptions={{
  tabBarActiveTintColor: theme.colors.foreground,
  tabBarInactiveTintColor: theme.colors['text-secondary'],
  tabBarStyle: { backgroundColor: theme.colors.background },
}}>
  <Tabs.Screen name="index" options={{
    title: 'Feed',
    tabBarIcon: ({ color }) => <Icon name="home" color={color} />,
  }} />
</Tabs>
```

### 4. Spring Animation Config

**Decision:** Use spring config for all navigation transitions.

**Rationale:**
- Spring physics feel more natural and iOS-native
- Apple HIG recommends spring animations for interactive UI
- Consistent with motion design system

**Config:**
```typescript
const springConfig = {
  damping: 18,
  stiffness: 200,
  mass: 0.8,
};
```

### 5. Draft Persistence: AsyncStorage + Debounce

**Decision:** Auto-save composer drafts to AsyncStorage every 5 seconds, restore on mount.

**Rationale:**
- AsyncStorage is already available via expo-secure-store
- Simple key-value storage is sufficient for draft text
- Debouncing reduces storage writes
- MMKV is already in project but AsyncStorage is simpler for this use case

**Implementation:**
```typescript
// Save draft
const saveDraft = debounce(async (draft: ComposerDraft) => {
  await AsyncStorage.setItem(`draft_${targetKey}`, JSON.stringify(draft));
}, 5000);

// Restore on mount
useEffect(() => {
  const restored = await AsyncStorage.getItem(`draft_${targetKey}`);
  if (restored) setDraft(JSON.parse(restored));
}, [targetKey]);
```

## Risks / Trade-offs

[Risk] Bottom sheet gesture conflicts with scroll gestures
→ Mitigation: Configure `bottomSheetGestureInteraction="panFromEdge"` and use `GestureHandlerRootView`

[Risk] Tab bar icons need consistent sizing
→ Mitigation: Use ICON_SIZE_MAP with standardized sizes (20, 24, 32, 48)

[Risk] Waveform visualization is an approximation, not true audio waveform
→ Mitigation: Document this as a limitation; upgrade path to Skia exists

[Risk] Draft persistence adds complexity to composer state
→ Mitigation: Create dedicated `useDraftPersistence` hook to encapsulate logic

## Open Questions

1. Should voice recording be inline in composer footer or stay in bottom sheet?
   - Propose: Keep in bottom sheet for now; inline voice can be a future enhancement

2. What should the tab bar badge behavior be for notifications?
   - Propose: No badges initially; can add based on notification system

3. Should we keep the current "Feed" tab or rename to "Home"?
   - Propose: Keep "Feed" as it matches the content type

4. Camera modal - keep as full-screen or switch to bottom sheet?
   - Propose: Switch to bottom sheet with snap points (50%, 90%)
