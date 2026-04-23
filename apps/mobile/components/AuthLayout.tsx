import { Image } from 'expo-image';
import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text, makeStyles } from '~/components/theme';
import { useThemeColors } from '~/components/theme/theme';

interface AuthLayoutProps {
  testID: string;
  title: string;
  helper: string;
  isProbing?: boolean;
  children: React.ReactNode;
}

export function AuthLayout({ testID, title, helper, isProbing, children }: AuthLayoutProps) {
  const styles = useStyles();
  const themeColors = useThemeColors();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.flex}
    >
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        <View style={styles.container} testID={testID}>
          <View style={styles.header}>
            <Animated.View entering={FadeInDown.delay(0).springify().damping(18)}>
              <View style={styles.brandMark}>
                <Image
                  source="sf:sparkles"
                  style={styles.brandIcon}
                  tintColor={themeColors.foreground}
                  contentFit="contain"
                />
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(80).springify().damping(18)}>
              <Text variant="title1" color="foreground" style={styles.title}>
                {title}
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(160).springify().damping(18)}>
              <Text variant="body" color="text-tertiary" style={styles.helper}>
                {isProbing ? 'Resuming session…' : helper}
              </Text>
            </Animated.View>
          </View>

          {!isProbing && (
            <Animated.View
              entering={FadeInDown.delay(240).springify().damping(18)}
              style={styles.form}
            >
              {children}
            </Animated.View>
          )}
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: {
      flex: 1,
    },
    container: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: t.spacing.m_16,
      paddingBottom: t.spacing.ml_24,
      rowGap: t.spacing.ml_24,
    },
    header: {
      alignItems: 'center',
      rowGap: t.spacing.sm_12,
    },
    brandMark: {
      alignItems: 'center',
      backgroundColor: t.colors['bg-elevated'],
      borderColor: t.colors['border-faint'],
      borderCurve: 'continuous',
      borderRadius: t.borderRadii.md,
      borderWidth: 1,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    brandIcon: {
      height: 22,
      width: 22,
    },
    title: {
      textAlign: 'center',
    },
    helper: {
      textAlign: 'center',
      paddingHorizontal: t.spacing.sm_12,
    },
    form: {
      width: '100%',
    },
  }),
);
