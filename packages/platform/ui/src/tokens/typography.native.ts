import { Platform } from 'react-native';

export { fontSizes, fontWeights, letterSpacing, lineHeights } from './typography.shared';

/** React Native font family names (platform system fonts). */
export const fontFamiliesNative = {
  primary:
    Platform.select({
      ios: 'System',
      android: 'sans-serif',
      default: 'sans-serif',
    }) ?? 'sans-serif',
  mono:
    Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }) ?? 'monospace',
} as const;
