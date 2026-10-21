import { BottomSheetModalProvider } from '@expo/ui/community/bottom-sheet';
import { logger } from '@hominem/telemetry';
import { ThemeProvider as RestyleThemeProvider } from '@shopify/restyle';
import { useIsRestoring } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import {
  DefaultTheme,
  SplashScreen,
  Stack,
  ThemeProvider,
  usePathname,
  useRouter,
  useSegments,
} from 'expo-router';
import { PostHogProvider } from 'posthog-react-native';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import {
  initialWindowMetrics,
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';

import { logError } from '~/components/error-boundary/log-error';
import { RootErrorBoundary } from '~/components/error-boundary/RootErrorBoundary';
import { LaunchOverlay } from '~/components/launch/LaunchOverlay';
import { darkTheme, lightTheme, useAppTheme } from '~/components/theme';
import { E2E_TESTING } from '~/constants';
import { useScreenCapture } from '~/hooks/use-screen-capture';
import { AuthProvider, useAuth } from '~/services/auth/auth-provider';
import { useSignInHold } from '~/services/auth/sign-in-hold';
import { resolveAuthRedirect } from '~/services/navigation/auth-route-guard';
import { consumeRestoreAttempt, consumeResumeTarget } from '~/services/navigation/launch-state';
import { getContentRoute } from '~/services/navigation/routes';
import { initObservability } from '~/services/observability';
import { posthog, posthogClient } from '~/services/posthog';
import queryClient from '~/services/query-client';
import { mobilePersistOptions } from '~/services/query-persistence';
import { recordActiveDay } from '~/services/review-prompt/review-prompt';

SplashScreen.preventAutoHideAsync();

function InnerRootLayout() {
  const theme = useAppTheme();
  const containerStyle = useMemo(
    () => ({ flex: 1 as const, backgroundColor: theme.colors.background }),
    [theme],
  );
  const router = useRouter();
  const pathname = usePathname();
  const segments: string[] = useSegments();
  const segmentKey = segments.join('/');
  const { isPending, isSignedIn, isSigningOut, currentUser, resetAuthForE2E, signOut } = useAuth();
  const isRestoring = useIsRestoring();
  const lastRedirectSignatureRef = React.useRef<string | null>(null);
  const isHoldingSignIn = useSignInHold();
  const hasHiddenSplashRef = useRef(false);
  const hideSplash = useCallback(() => {
    if (hasHiddenSplashRef.current) {
      return;
    }
    hasHiddenSplashRef.current = true;
    SplashScreen.hideAsync().catch((error) =>
      logger.warn('[RootLayout] hideAsync failed', { error }),
    );
  }, []);
  const isSettled = !isPending && !isRestoring;

  // The launch overlay hides the native splash once its mascot is on screen (it shows the same frame).
  // This timeout is only a safety net in case that never happens; E2E runs have no overlay, so they
  // hide the splash as soon as boot settles.
  useEffect(() => {
    const timeout = setTimeout(hideSplash, 3000);
    return () => clearTimeout(timeout);
  }, [hideSplash]);

  useEffect(() => {
    if (E2E_TESTING && isSettled) {
      hideSplash();
    }
  }, [hideSplash, isSettled]);

  useEffect(() => {
    if (isSignedIn && currentUser?.id) {
      posthog.identify(currentUser.id, { email: currentUser.email ?? null });
    } else if (!isPending && !isSignedIn) {
      posthog.reset();
    }
  }, [currentUser, isPending, isSignedIn]);

  useEffect(() => {
    const target = resolveAuthRedirect({
      isPending: isPending || isRestoring,
      isSignedIn,
      isSigningOut,
      isHoldingSignIn,
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
    router.replace(target);
  }, [
    isHoldingSignIn,
    isPending,
    isRestoring,
    isSignedIn,
    isSigningOut,
    router,
    segmentKey,
    segments,
  ]);

  useEffect(() => {
    if (isPending || isRestoring || !isSignedIn || !currentUser?.id) {
      return;
    }

    if (!consumeRestoreAttempt()) {
      return;
    }

    const resumeTarget = consumeResumeTarget();
    if (!resumeTarget) {
      return;
    }

    const target = getContentRoute(resumeTarget.kind, resumeTarget.id);
    if (pathname !== target) {
      router.push(target);
    }
  }, [currentUser?.id, isPending, isRestoring, isSignedIn, pathname, router]);

  return (
    <RootErrorBoundary
      onError={(error, errorInfo) => logError(error, errorInfo, { route: segments.join('/') })}
    >
      <SafeAreaView style={containerStyle} edges={['left', 'right']}>
        <Stack screenOptions={{ contentStyle: { backgroundColor: 'transparent' } }}>
          <Stack.Screen name="(protected)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack>
      </SafeAreaView>
      {E2E_TESTING ? null : (
        <LaunchOverlay
          destination={isSignedIn ? 'app' : 'login'}
          onShown={hideSplash}
          settled={isSettled}
        />
      )}
      {E2E_TESTING ? (
        <>
          {isPending ? <View testID="auth-state-booting" style={styles.e2eIndicator} /> : null}
          {!isPending && !isSignedIn && !isSigningOut ? (
            <View testID="auth-state-signed-out" style={styles.e2eIndicator} />
          ) : null}
          {isSignedIn || isSigningOut ? (
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
  useScreenCapture();

  const colorScheme = useColorScheme();
  const restyleTheme = colorScheme === 'dark' ? darkTheme : lightTheme;
  const { background, border, card, primary, foreground: text } = restyleTheme.colors;

  const navigationTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background,
      border,
      card,
      notification: primary,
      primary,
      text,
    },
  };

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
    <RestyleThemeProvider theme={restyleTheme}>
      <ThemeProvider value={navigationTheme}>
        <PersistQueryClientProvider client={queryClient} persistOptions={mobilePersistOptions}>
          <SafeAreaProvider initialMetrics={initialWindowMetrics}>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <AuthProvider>
                  <BottomSheetModalProvider>
                    <InnerRootLayout />
                  </BottomSheetModalProvider>
                </AuthProvider>
              </KeyboardProvider>
            </GestureHandlerRootView>
          </SafeAreaProvider>
        </PersistQueryClientProvider>
      </ThemeProvider>
    </RestyleThemeProvider>
  );

  return posthogClient ? (
    <PostHogProvider client={posthogClient}>{content}</PostHogProvider>
  ) : (
    content
  );
}

export default RootLayout;

const styles = StyleSheet.create({
  e2eIndicator: { position: 'absolute', top: 8, left: 8, width: 2, height: 2, opacity: 0.02 },
  e2eAction: { position: 'absolute', top: 8, right: 8, width: 16, height: 16, opacity: 0.02 },
  e2eActionAlt: { position: 'absolute', top: 24, right: 8, width: 16, height: 16, opacity: 0.02 },
});
