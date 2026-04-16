import React, { useEffect, useMemo } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { Screen } from '~/components/layout/Page';
import { Box, Text, makeStyles } from '~/components/theme';

interface AuthLayoutProps {
  testID: string;
  title: string;
  helper: string;
  isProbing?: boolean;
  children: React.ReactNode;
}

export function AuthLayout({ testID, title, helper, isProbing, children }: AuthLayoutProps) {
  const styles = useStyles();
  const pulse = useMemo(
    () => (typeof Animated?.Value === 'function' ? new Animated.Value(0) : null),
    [],
  );
  const Accent = typeof Animated?.View === 'function' ? Animated.View : View;

  useEffect(() => {
    if (!pulse || typeof Animated?.loop !== 'function' || typeof Animated?.timing !== 'function') {
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1200,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => {
      loop.stop();
    };
  }, [pulse]);

  const accentStyle = {
    opacity: pulse
      ? pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [0.55, 1],
        })
      : 1,
    transform: pulse
      ? [
          {
            scale: pulse.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 1.16],
            }),
          },
        ]
      : undefined,
  } as const;

  return (
    <Screen
      testID={testID}
      maxWidth="sm"
      padded={true}
      edges={['top', 'right', 'bottom', 'left']}
      style={styles.screenContainer}
      contentContainerStyle={styles.scrollContent}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <Box flex={1} style={styles.content}>
          <View style={styles.hero}>
            <View style={styles.brandRow}>
              <Accent style={[styles.accent, accentStyle]} />
            </View>

            <Text variant="title1" color="foreground" style={styles.title}>
              {title}
            </Text>
            <Text variant="body" color="text-tertiary" style={styles.helper}>
              {isProbing ? 'Resuming session...' : helper}
            </Text>
          </View>

          {!isProbing && <View style={styles.form}>{children}</View>}
        </Box>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    screenContainer: {
      backgroundColor: t.colors['bg-base'],
    },
    flex: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    content: {
      paddingVertical: t.spacing.ml_24,
      rowGap: t.spacing.ml_24,
    },
    hero: {
      alignItems: 'center',
      rowGap: t.spacing.sm_8,
    },
    brandRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: t.spacing.sm_8,
      justifyContent: 'center',
    },
    logo: {
      width: 72,
      height: 72,
    },
    accent: {
      ...StyleSheet.absoluteFill,
      backgroundColor: t.colors.accent,
      borderRadius: t.borderRadii.lg,
      opacity: 0.1,
      zIndex: -1,
    },
    title: {
      marginTop: t.spacing.sm_12,
      textAlign: 'center',
    },
    helper: {
      textAlign: 'center',
      paddingHorizontal: t.spacing.ml_24,
    },
    form: {
      width: '100%',
    },
  }),
);
