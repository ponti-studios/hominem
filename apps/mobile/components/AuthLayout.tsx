import { Image } from 'expo-image';
import React, { useEffect, useMemo } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getRuntimeBrandLogoSource } from '~/constants/brand-assets';
import { Box, Text, makeStyles } from '~/components/theme';
import { APP_VARIANT } from '~/constants';

interface AuthLayoutProps {
  testID: string;
  title: string;
  helper: string;
  children: React.ReactNode;
}

export function AuthLayout({ testID, title, helper, children }: AuthLayoutProps) {
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
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="always"
          bounces={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Box flex={1} testID={testID} style={styles.screen}>
            <View style={styles.hero}>
              <View style={styles.brandRow}>
                <Image
                  source={getRuntimeBrandLogoSource(APP_VARIANT)}
                  contentFit="contain"
                  style={styles.logo}
                />
                <Accent style={[styles.accent, accentStyle]} />
              </View>

              <Text variant="title1" color="foreground" style={styles.title}>
                {title}
              </Text>
              <Text variant="body" color="text-tertiary" style={styles.helper}>
                {helper}
              </Text>
            </View>

            <View style={styles.form}>{children}</View>
          </Box>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    flex: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
    },
    screen: {
      backgroundColor: t.colors.background,
      flex: 1,
      paddingHorizontal: t.spacing.m_16,
      paddingTop: t.spacing.ml_24,
      paddingBottom: t.spacing.ml_24,
      justifyContent: 'center',
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
      maxWidth: 72,
      maxHeight: 72,
    },
    accent: {
      width: 10,
      height: 10,
      borderRadius: 999,
      backgroundColor: t.colors.accent,
    },
    title: {
      textAlign: 'center',
    },
    helper: {
      textAlign: 'center',
      maxWidth: 280,
    },
    form: {
      width: '100%',
    },
  }),
);
