import { GlassContainer, GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useSyncExternalStore, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import { hairline, useAppTheme, useColorMode } from '~/components/theme';
import type { Theme } from '~/components/theme';

let reduceTransparency = false;
let subscribed = false;
const listeners = new Set<() => void>();

function setReduceTransparency(value: boolean) {
  reduceTransparency = value;
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!subscribed) {
    subscribed = true;
    void AccessibilityInfo.isReduceTransparencyEnabled().then(setReduceTransparency);
    AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency);
  }
  return () => {
    listeners.delete(listener);
  };
}

// True when the surface should be real system glass: off under Reduce
// Transparency, where an opaque fill reads better than a frosted one.
export function useGlassEnabled() {
  const reduced = useSyncExternalStore(
    subscribe,
    () => reduceTransparency,
    () => false,
  );
  return !reduced && isLiquidGlassAvailable();
}

interface GlassProps extends ViewProps {
  children?: ReactNode;
  // Reacts to touch (buttons, the composer). Leave off for passive surfaces.
  interactive?: boolean;
  radius?: keyof Theme['borderRadii'];
  style?: StyleProp<ViewStyle>;
  // 'clear' lets more of the content through; use it over media.
  tone?: 'regular' | 'clear';
  // Colours the glass (a violet send button, a coral warning).
  tint?: string;
}

// The one way to draw a glass surface. Never animate its opacity (or a
// parent's): system glass stops rendering below full opacity.
export function Glass({
  children,
  interactive = false,
  radius = 'pill',
  style,
  tone = 'regular',
  tint,
  ...props
}: GlassProps) {
  const theme = useAppTheme();
  const colorMode = useColorMode();
  const enabled = useGlassEnabled();
  const shape: ViewStyle = { borderCurve: 'continuous', borderRadius: theme.borderRadii[radius] };

  if (!enabled) {
    return (
      <View
        {...props}
        style={[
          shape,
          {
            backgroundColor: tint ?? theme.colors.glassFallback,
            borderColor: theme.colors.glassStroke,
            borderWidth: hairline,
            boxShadow: theme.shadows.float,
          },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <GlassView
      {...props}
      colorScheme={colorMode}
      glassEffectStyle={tone}
      isInteractive={interactive}
      style={[shape, style]}
      tintColor={tint ?? theme.colors.glassTint}
    >
      {children}
    </GlassView>
  );
}

interface GlassGroupProps extends ViewProps {
  children: ReactNode;
  // How close two glass shapes get before they start to merge.
  spacing?: number;
}

// Neighbouring glass shapes blend and morph into each other inside a group.
export function GlassGroup({ children, spacing = 8, ...props }: GlassGroupProps) {
  const enabled = useGlassEnabled();
  if (!enabled) {
    return <View {...props}>{children}</View>;
  }
  return (
    <GlassContainer {...props} spacing={spacing}>
      {children}
    </GlassContainer>
  );
}
