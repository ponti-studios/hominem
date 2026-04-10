import type { ColorToken } from '@hominem/ui/tokens';
import * as React from 'react';
import { Text as NativeText, type TextProps as NativeTextProps, type TextStyle } from 'react-native';

import theme from './theme';

type LegacyVariant =
  | 'extra_large'
  | 'header'
  | 'large'
  | 'cardHeader'
  | 'bodyLarge'
  | 'body'
  | 'text-md'
  | 'title'
  | 'caption'
  | 'label'
  | 'small'
  | 'mono'
  | 'defaults';

type PrimitiveVariant = 'body-1' | 'body-2' | 'body-3' | 'body-4';

interface TextProps extends Omit<NativeTextProps, 'style'> {
  color?: ColorToken | undefined;
  variant?: LegacyVariant | PrimitiveVariant | undefined;
  style?: NativeTextProps['style'];
}

const variantMap: Record<LegacyVariant, PrimitiveVariant> = {
  extra_large: 'body-1',
  header: 'body-1',
  large: 'body-1',
  cardHeader: 'body-1',
  bodyLarge: 'body-1',
  body: 'body-2',
  'text-md': 'body-2',
  title: 'body-2',
  caption: 'body-4',
  label: 'body-3',
  small: 'body-4',
  mono: 'body-4',
  defaults: 'body-3',
};

function isLegacyVariant(variant: LegacyVariant | PrimitiveVariant): variant is LegacyVariant {
  return variant in variantMap;
}

function Text({ variant = 'body-2', ...props }: TextProps) {
  const resolvedVariant = isLegacyVariant(variant) ? variantMap[variant] : variant;
  const variantStyle = theme.textVariants[
    resolvedVariant === 'body-1'
      ? 'bodyLarge'
      : resolvedVariant === 'body-2'
        ? 'body'
        : resolvedVariant === 'body-3'
          ? 'label'
          : 'small'
  ] as TextStyle;
  const colorStyle = props.color ? { color: theme.colors[props.color] } : undefined;

  return <NativeText {...props} style={[variantStyle, colorStyle, props.style]} />;
}

export default Text;
