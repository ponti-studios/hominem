import { Stack } from 'expo-router';
import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';

import { FeatureErrorBoundary } from '~/components/error-boundary';
import { useAppLock } from '~/hooks/use-app-lock';
import { Text, theme } from '~/components/theme';
import { ApiProvider } from '~/services/api/api-provider';
import { useAuth } from '~/services/auth/auth-provider';
import { APP_NAME } from '~/constants';
import queryClient from '~/services/query-client';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.m_16,
  },
});

function ProtectedShell() {
  const { authStatus, isSignedIn } = useAuth();
  const { isUnlocked, authenticate } = useAppLock();

  if (authStatus === 'booting' || !isSignedIn) {
    return <View testID="protected-bootstrap" style={styles.root} />;
  }

  if (!isUnlocked) {
    return (
      <View style={styles.centered}>
        <Text variant="header" color="foreground">
          {APP_NAME}
        </Text>
        <Text variant="body" color="text-secondary">
          Unlock to continue
        </Text>
        <Pressable onPress={() => void authenticate()}>
          <Text variant="body" color="foreground">
            Unlock
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FeatureErrorBoundary featureName="Protected">
      <ApiProvider queryClient={queryClient}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.root}
        >
          <Stack initialRouteName="(tabs)">
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </KeyboardAvoidingView>
      </ApiProvider>
    </FeatureErrorBoundary>
  );
}

export default ProtectedShell;
