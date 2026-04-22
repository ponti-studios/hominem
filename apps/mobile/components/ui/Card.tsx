import { Text, View, type TextProps, type ViewProps } from 'react-native';

import { makeStyles } from '~/components/theme';
import {
  fontFamiliesNative,
  fontSizes,
  fontWeights,
  radii,
  spacing,
} from '~/components/theme/tokens';

function Card({ children, style, ...props }: ViewProps) {
  const styles = useCardStyles();
  return (
    <View style={[styles.card, style]} {...props}>
      {children}
    </View>
  );
}

function CardHeader({ children, style, ...props }: ViewProps) {
  return (
    <View style={[staticStyles.header, style]} {...props}>
      {children}
    </View>
  );
}

function CardContent({ children, style, ...props }: ViewProps) {
  return (
    <View style={[staticStyles.content, style]} {...props}>
      {children}
    </View>
  );
}

function CardFooter({ children, style, ...props }: ViewProps) {
  return (
    <View style={[staticStyles.footer, style]} {...props}>
      {children}
    </View>
  );
}

function CardTitle({ children, style, ...props }: TextProps) {
  const styles = useCardStyles();
  return (
    <Text style={[styles.title, style]} {...props}>
      {children}
    </Text>
  );
}

function CardDescription({ children, style, ...props }: TextProps) {
  const styles = useCardStyles();
  return (
    <Text style={[styles.description, style]} {...props}>
      {children}
    </Text>
  );
}

function CardAction({ children, style, ...props }: ViewProps) {
  return (
    <View style={[staticStyles.action, style]} {...props}>
      {children}
    </View>
  );
}

const useCardStyles = makeStyles((theme) => ({
  card: {
    backgroundColor: theme.colors['bg-surface'],
    borderColor: theme.colors['border-default'],
    borderCurve: 'continuous',
    borderRadius: radii.sm,
    borderWidth: 1,
    gap: spacing[5],
    paddingVertical: spacing[5],
  },
  title: {
    color: theme.colors['text-primary'],
    fontFamily: fontFamiliesNative.primary,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    lineHeight: Math.round(fontSizes.lg * 1.2),
  },
  description: {
    color: theme.colors['text-tertiary'],
    fontFamily: fontFamiliesNative.primary,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.regular,
    lineHeight: Math.round(fontSizes.sm * 1.4),
  },
}));

const staticStyles = {
  action: {
    alignSelf: 'flex-end' as const,
  },
  content: {
    paddingHorizontal: spacing[5],
  },
  footer: {
    alignItems: 'center' as const,
    paddingHorizontal: spacing[5],
  },
  header: {
    gap: spacing[2],
    paddingHorizontal: spacing[5],
  },
};

export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
