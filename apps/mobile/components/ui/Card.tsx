import { spacing } from '@hominem/ui/tokens';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

import { Text, theme } from '~/components/theme';
import { Surface } from '~/components/ui/Surface';


interface CardProps extends Pick<React.ComponentProps<typeof Surface>, 'elevation' | 'radius' | 'shadow'> {
  style?: ViewStyle;
  children: React.ReactNode;
}

export function Card({ elevation = 'surface', radius = 'lg', shadow = false, style, children }: CardProps) {
  return (
    <Surface elevation={elevation} radius={radius} border shadow={shadow} style={style}>
      {children}
    </Surface>
  );
}


interface CardHeaderProps {
  style?: ViewStyle;
  children: React.ReactNode;
}

export function CardHeader({ style, children }: CardHeaderProps) {
  return <View style={[styles.header, style]}>{children}</View>;
}


interface CardTitleProps {
  children: string;
  style?: StyleProp<TextStyle>;
}

export function CardTitle({ children, style }: CardTitleProps) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}


interface CardDescriptionProps {
  children: string;
  style?: StyleProp<TextStyle>;
}

export function CardDescription({ children, style }: CardDescriptionProps) {
  return <Text style={[styles.description, style]}>{children}</Text>;
}


interface CardContentProps {
  style?: ViewStyle;
  children: React.ReactNode;
}

export function CardContent({ style, children }: CardContentProps) {
  return <View style={[styles.content, style]}>{children}</View>;
}


interface CardFooterProps {
  style?: ViewStyle;
  children: React.ReactNode;
}

export function CardFooter({ style, children }: CardFooterProps) {
  return <View style={[styles.footer, style]}>{children}</View>;
}


interface CardActionProps {
  style?: ViewStyle;
  children: React.ReactNode;
}

export function CardAction({ style, children }: CardActionProps) {
  return <View style={[styles.action, style]}>{children}</View>;
}


const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
    gap: spacing[1],
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: theme.colors.foreground,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors['text-secondary'],
  },
  content: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[4],
    paddingTop: spacing[2],
    gap: spacing[2],
  },
  action: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[4],
    gap: spacing[2],
  },
});
