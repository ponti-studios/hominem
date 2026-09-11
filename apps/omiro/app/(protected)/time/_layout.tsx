import { Stack } from 'expo-router';

export default function TimeStackLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="[source]/[id]"
        options={{
          presentation: 'formSheet',
          sheetGrabberVisible: true,
          // With no allowed detents declared, iOS falls back to a single
          // `[1.0]` (full-height) detent, so any downward drag on the
          // grabber is treated as an *interactive dismiss* rather than a
          // detent resize -- an intermediate, not-fully-tested path in
          // react-native-screens' formSheet that has repeatedly shown
          // content-vanishes-while-dragging regressions on iOS
          // (see https://github.com/software-mansion/react-native-screens/issues/2522).
          // Declaring real detents, as chat-to-note-sheet does, routes the
          // same grabber drag through the well-exercised resize-between-
          // detents path instead.
          sheetAllowedDetents: [0.6, 0.95],
          sheetInitialDetentIndex: 1,
          title: 'Time block',
        }}
      />
    </Stack>
  );
}
