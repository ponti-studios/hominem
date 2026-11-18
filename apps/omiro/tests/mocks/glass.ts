import { createElement, type ReactNode } from 'react';

interface SurfaceProps {
  children?: ReactNode;
  testID?: string;
}

interface PressableProps extends SurfaceProps {
  accessibilityLabel?: string;
  disabled?: boolean;
  onPress?: () => void;
}

// Stand-ins for the glass and press-feedback primitives: both wrap native
// views (system glass, Reanimated) that cannot load under vitest, and neither
// carries behaviour a component test cares about beyond "renders children"
// and "calls onPress".
export const glassModuleMock = {
  Glass: ({ children, testID }: SurfaceProps) =>
    createElement('div', { 'data-testid': testID }, children),
  GlassGroup: ({ children, testID }: SurfaceProps) =>
    createElement('div', { 'data-testid': testID }, children),
  useGlassEnabled: () => false,
};

export const pressableScaleModuleMock = {
  PressableScale: ({ accessibilityLabel, children, disabled, onPress, testID }: PressableProps) =>
    createElement(
      'button',
      { 'aria-label': accessibilityLabel, 'data-testid': testID, disabled, onClick: onPress },
      children,
    ),
};
