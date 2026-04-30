import { Stack } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { FeatureErrorBoundary } from '~/components/error-boundary/FeatureErrorBoundary';
import { Text, theme } from '~/components/theme';
import { Button } from '~/components/ui/button';
import { APP_NAME } from '~/constants';
import { useAppLock } from '~/hooks/use-app-lock';
import { useReducedMotion } from '~/hooks/use-reduced-motion';
import { ApiProvider } from '~/services/api/api-provider';
import { useAuth } from '~/services/auth/auth-provider';
import queryClient from '~/services/query-client';
import t from '~/translations';

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.lg,
  },
  unlockButtonWrap: {
    minWidth: 160,
  },
});

function ProtectedShell() {
  const { authStatus, isSignedIn } = useAuth();
  const { isUnlocked, authenticate } = useAppLock();
  const prefersReducedMotion = useReducedMotion();

  const springAnimationConfig = {
    damping: 18,
    mass: 0.8,
    stiffness: 200,
    overshootClamping: false,
  };

  const screenOptions = prefersReducedMotion
    ? {
        animation: 'fade' as const,
        gestureEnabled: true,
        gestureDirection: 'horizontal' as const,
      }
    : {
        animation: 'default' as const,
        animationEnabled: true,
        transitionSpec: {
          open: { animation: 'spring', config: springAnimationConfig },
          close: { animation: 'spring', config: springAnimationConfig },
        },
        gestureEnabled: true,
        gestureDirection: 'horizontal' as const,
      };

  if (authStatus === 'booting' || !isSignedIn) {
    return <View testID="protected-bootstrap" style={styles.root} />;
  }

  if (!isUnlocked) {
    return (
      <View style={styles.centered}>
        <Text variant="title1" color="foreground">
          {APP_NAME}
        </Text>
        <Text variant="body" color="text-secondary">
          {t.auth.unlockMessage}
        </Text>
        <View style={styles.unlockButtonWrap}>
          <Button
            label={t.auth.unlockButton}
            onPress={() => void authenticate()}
            variant="primary"
          />
        </View>
      </View>
    );
  }

  return (
    <FeatureErrorBoundary featureName="Protected">
      <ApiProvider queryClient={queryClient}>
        <View style={styles.root}>
          <Stack initialRouteName="(tabs)" screenOptions={screenOptions}>
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </View>
      </ApiProvider>
    </FeatureErrorBoundary>
  );
}

export default ProtectedShell;
