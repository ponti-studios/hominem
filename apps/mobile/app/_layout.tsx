import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import type { RelativePathString } from 'expo-router';
import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router';
import { PostHogProvider, type PostHog } from 'posthog-react-native';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { logError } from '~/components/error-boundary/log-error';
import { RootErrorBoundary } from '~/components/error-boundary/RootErrorBoundary';
import { makeStyles } from '~/components/theme';
import { E2E_TESTING } from '~/constants';
import { useScreenCapture } from '~/hooks/use-screen-capture';
import { resolveAuthRedirect } from '~/navigation/auth-route-guard';
import { AuthProvider, useAuth } from '~/services/auth/auth-provider';
import { initObservability } from '~/services/observability';
import { markStartupPhase } from '~/services/performance/startup-metrics';
import { POSTHOG_ENABLED, posthog } from '~/services/posthog';
import { recordActiveDay } from '~/services/review-prompt/review-prompt';

SplashScreen.preventAutoHideAsync();
markStartupPhase('app_start');

const useInnerStyles = makeStyles((t) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
    },
    e2eIndicator: {
      position: 'absolute',
      top: t.spacing.xs_4,
      left: t.spacing.xs_4,
      width: 2,
      height: 2,
      opacity: 0.02,
    },
    e2eAction: {
      position: 'absolute',
      top: t.spacing.sm_8,
      right: t.spacing.sm_8,
      width: 16,
      height: 16,
      opacity: 0.02,
    },
    e2eActionAlt: {
      position: 'absolute',
      top: t.spacing.ml_24,
      right: t.spacing.sm_8,
      width: 16,
      height: 16,
      opacity: 0.02,
    },
  }),
);

const useRootStyles = makeStyles((t) =>
  StyleSheet.create({
    gestureRoot: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
  }),
);

function InnerRootLayout() {
  const styles = useInnerStyles();
  const router = useRouter();
  const segments = useSegments() as string[];
  const segmentKey = segments.join('/');
  const { authStatus, isSignedIn, currentUser, resetAuthForE2E, signOut } = useAuth();
  const hasMarkedShellReady = React.useRef(false);
  const lastRedirectSignatureRef = React.useRef<string | null>(null);
  useEffect(() => {
    markStartupPhase('root_layout_mounted');

    let hasHidden = false;
    const hide = () => {
      if (hasHidden) {
        return;
      }
      hasHidden = true;
      SplashScreen.hideAsync().catch(() => undefined);
    };

    hide();
    const timeout = setTimeout(hide, 1500);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (authStatus === 'signed_in' && currentUser?.id) {
      posthog.identify(currentUser.id, { email: currentUser.email ?? null });
    } else if (authStatus === 'signed_out') {
      posthog.reset();
    }
  }, [authStatus, currentUser]);

  useEffect(() => {
    if (!hasMarkedShellReady.current && authStatus !== 'booting') {
      markStartupPhase('shell_ready');
      hasMarkedShellReady.current = true;
    }

    const target = resolveAuthRedirect({
      authStatus,
      isSignedIn,
      segments,
    });
    if (!target) {
      lastRedirectSignatureRef.current = null;
      return;
    }

    const redirectSignature = `${segmentKey}->${target}`;
    if (lastRedirectSignatureRef.current === redirectSignature) {
      return;
    }

    lastRedirectSignatureRef.current = redirectSignature;
    if (target) {
      router.replace(target as RelativePathString);
    }
  }, [authStatus, isSignedIn, router, segmentKey, segments]);

  return (
    <RootErrorBoundary
      onError={(error, errorInfo) => logError(error, errorInfo, { route: segments.join('/') })}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <Stack screenOptions={{ contentStyle: { backgroundColor: 'transparent' } }}>
          <Stack.Screen name="(protected)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack>
      </SafeAreaView>
      {E2E_TESTING ? (
        <>
          {authStatus === 'booting' ? (
            <View testID="auth-state-booting" style={styles.e2eIndicator} />
          ) : null}
          {authStatus === 'signed_out' ||
          authStatus === 'otp_requested' ||
          authStatus === 'verifying_otp' ||
          authStatus === 'degraded' ? (
            <View testID="auth-state-signed-out" style={styles.e2eIndicator} />
          ) : null}
          {authStatus === 'signed_in' || authStatus === 'signing_out' ? (
            <View testID="auth-state-signed-in" style={styles.e2eIndicator} />
          ) : null}
          <Pressable
            testID="auth-e2e-reset"
            style={styles.e2eAction}
            onPress={() => {
              void resetAuthForE2E();
            }}
          />
          <Pressable
            testID="auth-e2e-sign-out"
            style={styles.e2eActionAlt}
            onPress={() => {
              void signOut();
            }}
          />
        </>
      ) : null}
    </RootErrorBoundary>
  );
}

function RootLayout() {
  const rootStyles = useRootStyles();
  useScreenCapture();

  useEffect(() => {
    if (E2E_TESTING) {
      return;
    }

    const cleanup = initObservability();
    posthog.capture('app_health_check', { source: 'root_layout' });
    void recordActiveDay();
    return cleanup;
  }, []);

  const content = (
    <SafeAreaProvider>
      <GestureHandlerRootView style={rootStyles.gestureRoot}>
        <KeyboardProvider>
          <RootErrorBoundary>
            <AuthProvider>
              <BottomSheetModalProvider>
                <InnerRootLayout />
              </BottomSheetModalProvider>
            </AuthProvider>
          </RootErrorBoundary>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );

  return POSTHOG_ENABLED ? (
    <PostHogProvider client={posthog as PostHog}>{content}</PostHogProvider>
  ) : (
    content
  );
}

export default RootLayout;
