import type { PropsWithChildren } from 'react';
import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { useAppTheme, withAlpha } from '~/components/theme';

interface BlurCardProps extends ViewProps {
  contentStyle?: StyleProp<ViewStyle>;
}

// Shared composer surface -- the omiro equivalent of web's
// `rounded-xl border-border/50 bg-card shadow-sm`. Flat color, no blur: the
// mobile design system disallows expo-blur (oxlint.config.mjs), same as it
// disallows LinearGradient -- use flat color backgrounds instead.
// `style` overrides the outer surface (radius/border/shadow); `contentStyle`
// overrides the inner padding/gap.
export function BlurCard({
  children,
  style,
  contentStyle,
  ...props
}: PropsWithChildren<BlurCardProps>) {
  const theme = useAppTheme();

  const containerStyle: ViewStyle = {
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.border, 0.5),
    backgroundColor: theme.colors.card,
    boxShadow: theme.shadows.sm,
    overflow: 'hidden',
  };

  const defaultContentStyle: ViewStyle = { padding: 16, gap: 16 };

  return (
    <View {...props} collapsable={false} style={[containerStyle, style]}>
      <View style={[defaultContentStyle, contentStyle]}>{children}</View>
    </View>
  );
}
