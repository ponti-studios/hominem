import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { Screen } from '~/components/layout/Page';
import { Text, makeStyles } from '~/components/theme';

interface AuthLayoutProps {
  testID: string;
  title: string;
  helper: string;
  isProbing?: boolean;
  children: React.ReactNode;
}

export function AuthLayout({ testID, title, helper, isProbing, children }: AuthLayoutProps) {
  const styles = useStyles();

  return (
    <Screen
      testID={testID}
      maxWidth="sm"
      padded={true}
      edges={['top', 'right', 'bottom', 'left']}
      style={styles.screenContainer}
      scroll={false}
      contentContainerStyle={styles.screenContent}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.centerStage}>
          <View style={styles.card}>
            <View style={styles.hero}>
              <View style={styles.brandRow}>
                <View style={styles.accent} />
              </View>

              <Text variant="title1" color="foreground" style={styles.title}>
                {title}
              </Text>
              <Text variant="body" color="text-tertiary" style={styles.helper}>
                {isProbing ? 'Resuming session...' : helper}
              </Text>
            </View>

            {!isProbing && <View style={styles.form}>{children}</View>}
          </View>
        </View>
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
    screenContent: {
      flex: 1,
    },
    centerStage: {
      flex: 1,
      justifyContent: 'center',
    },
    card: {
      flexGrow: 1,
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
