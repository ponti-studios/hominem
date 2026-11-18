import { router } from 'expo-router';
import type { NativeStackHeaderItem, Stack } from 'expo-router';
import type { ComponentProps } from 'react';
import { useMemo } from 'react';

import { fontFamilies, useAppTheme } from '~/components/theme';
import { SETTINGS_ROUTE } from '~/services/navigation/routes';

type StackScreenOptions = NonNullable<ComponentProps<typeof Stack.Screen>['options']>;

// The one place native headers are themed, so every stack (tabs and pushed
// detail screens) reads from the design tokens. The bar itself is the
// system's: transparent, with content scrolling under it and the system's
// soft scroll edge keeping the title legible. We only choose colors and type,
// and never paint a background behind it.
export function useNativeHeaderOptions(): StackScreenOptions {
  const { background, foreground } = useAppTheme().colors;
  return useMemo(
    () => ({
      contentStyle: { backgroundColor: background },
      headerLargeTitleShadowVisible: false,
      headerLargeTitleStyle: {
        color: foreground,
        fontFamily: fontFamilies.sans,
        fontWeight: '700',
      },
      headerShadowVisible: false,
      headerTintColor: foreground,
      headerTitleStyle: { color: foreground, fontFamily: fontFamilies.sans, fontWeight: '600' },
      headerTransparent: true,
      scrollEdgeEffects: { top: 'soft' as const },
    }),
    [background, foreground],
  );
}

// Tab roots keep their title in the top bar, not as a large title below it.
export const inlineTitleOptions = { headerLargeTitle: false } satisfies StackScreenOptions;
// The profile button that opens Settings, shown in every tab's header. A
// system bar button, so it sits in the system's own glass capsule and morphs
// with the bar.
export const settingsHeaderRightItems = (): NativeStackHeaderItem[] => [
  {
    type: 'button',
    accessibilityLabel: 'Settings',
    icon: { type: 'sfSymbol', name: 'person.crop.circle' },
    identifier: 'settings-button',
    label: 'Settings',
    onPress: () => router.push(SETTINGS_ROUTE),
  },
];
