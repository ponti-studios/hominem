import { ShimmerProgressBar as KitShimmerProgressBar } from '@hominem/rn-kit';
import type { StyleProp, ViewStyle } from 'react-native';

import { useAppTheme } from '~/components/theme';

interface ShimmerProgressBarProps {
  progress: number;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  trackColor?: string;
  fillColor?: string;
}

// The one linear progress bar for the app. Theme adapter over the shared kit
// component, so every determinate indicator (stage progress, uploads, usage
// meters) moves and reads the same way.
export function ShimmerProgressBar({ trackColor, fillColor, ...rest }: ShimmerProgressBarProps) {
  const { background, border, primary } = useAppTheme().colors;

  return (
    <KitShimmerProgressBar
      fadeColor={background}
      fillColor={fillColor ?? primary}
      trackColor={trackColor ?? border}
      {...rest}
    />
  );
}
