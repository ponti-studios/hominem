import { useRouter } from 'expo-router';
import type { NativeStackHeaderItem, Stack } from 'expo-router';
import type { ComponentProps } from 'react';
import { useMemo } from 'react';

import { fontFamilies, useAppTheme } from '~/components/theme';
import { IconButton } from '~/components/ui';
import AppIcon from '~/components/ui/icon';
import { SETTINGS_ROUTE } from '~/services/navigation/routes';

type StackScreenOptions = NonNullable<ComponentProps<typeof Stack.Screen>['options']>;

// The one place native headers are themed, so every stack (tabs and pushed
// detail screens) reads from the design tokens. The system owns the header's
// position and safe-area handling; we only choose colors and type.
export function useNativeHeaderOptions(): StackScreenOptions {
  const { background, foreground } = useAppTheme().colors;
  return useMemo(
    () => ({
      contentStyle: { backgroundColor: background },
      headerLargeStyle: { backgroundColor: background },
      headerLargeTitleShadowVisible: false,
      headerLargeTitleStyle: { color: foreground, fontFamily: fontFamilies.sans },
      headerShadowVisible: false,
      headerStyle: { backgroundColor: background },
      headerTintColor: foreground,
      headerTitleStyle: { color: foreground, fontFamily: fontFamilies.sans },
    }),
    [background, foreground],
  );
}

// The profile button that opens Settings, shown in every tab's header. It is
// our own round button, not a system bar button, so it is placed through
// settingsHeaderRightItems below to keep the system from wrapping it in its
// glass capsule.
export function SettingsHeaderButton() {
  const router = useRouter();
  return (
    <IconButton
      accessibilityLabel="Settings"
      onPress={() => router.push(SETTINGS_ROUTE)}
      size="md"
      testID="settings-button"
      variant="tonal"
    >
      <AppIcon name="person" size={22} weight="medium" />
    </IconButton>
  );
}

// hidesSharedBackground is what drops the system capsule behind the custom
// button (iOS 26); headerRight alone cannot turn it off.
export const settingsHeaderRightItems = (): NativeStackHeaderItem[] => [
  { type: 'custom', element: <SettingsHeaderButton />, hidesSharedBackground: true },
];
