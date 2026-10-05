import { useRouter } from 'expo-router';
import type { Stack } from 'expo-router';
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

// The profile button that opens Settings, shown in every tab's header.
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
      <AppIcon name="person.crop.circle" size={22} />
    </IconButton>
  );
}
