import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  DefaultTheme,
  SplashScreen,
  Stack,
  ThemeProvider,
  type RelativePathString,
  usePathname,
  useRouter,
  useSegments,
} from 'expo-router';
import { PostHogProvider, type PostHog } from 'posthog-react-native';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { logError } from '~/components/error-boundary/log-error';
import { RootErrorBoundary } from '~/components/error-boundary/RootErrorBoundary';
import { theme, makeStyles } from '~/components/theme';
import { E2E_TESTING } from '~/constants';
import { useScreenCapture } from '~/hooks/use-screen-capture';
import { resolveAuthRedirect } from '~/navigation/auth-route-guard';
import { AuthProvider, useAuth } from '~/services/auth/auth-provider';
import { initObservability } from '~/services/observability';
import { POSTHOG_ENABLED, posthog } from '~/services/posthog';
import queryClient from '~/services/query-client';
import { recordActiveDay } from '~/services/review-prompt/review-prompt';
import {
  consumeWorkspaceRestoreAttempt,
  consumeWorkspaceResumeArtifact,
} from '~/services/workspace/launch-state';
import { getWorkspaceArtifactRoute } from '~/services/workspace/routes';

SplashScreen.preventAutoHideAsync();

const useInnerStyles = makeStyles((t) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
    },
    e2eIndicator: {
      position: 'absolute',
      top: t.spacing.sm,
      left: t.spacing.sm,
      width: 2,
      height: 2,
      opacity: 0.02,
    },
    e2eAction: {
      position: 'absolute',
      top: t.spacing.sm,
      right: t.spacing.sm,
      width: 16,
      height: 16,
      opacity: 0.02,
    },
    e2eActionAlt: {
      position: 'absolute',
      top: t.spacing.xl,
      right: t.spacing.sm,
      width: 16,
      height: 16,
      opacity: 0.02,
    },
  }),
);

const useRootStyles = makeStyles(() =>
  StyleSheet.create({
    gestureRoot: {
      flex: 1,
    },
  }),
);

function InnerRootLayout() {
  const styles = useInnerStyles();
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments() as string[];
  const segmentKey = segments.join('/');
  const { authStatus, isSignedIn, currentUser, resetAuthForE2E, signOut } = useAuth();
  const hasMarkedShellReady = React.useRef(false);
  const lastRedirectSignatureRef = React.useRef<string | null>(null);
  useEffect(() => {
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
    if (isSignedIn && currentUser?.id) {
      posthog.identify(currentUser.id, { email: currentUser.email ?? null });
    } else if (authStatus === 'signed_out') {
      posthog.reset();
    }
  }, [authStatus, currentUser, isSignedIn]);

  useEffect(() => {
    if (!hasMarkedShellReady.current && authStatus !== 'booting') {
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

  useEffect(() => {
    if (authStatus === 'booting' || !isSignedIn || !currentUser?.id) {
      return;
    }

    if (!consumeWorkspaceRestoreAttempt()) {
      return;
    }

    const resumeArtifact = consumeWorkspaceResumeArtifact();
    if (!resumeArtifact) {
      return;
    }

    const target = getWorkspaceArtifactRoute(resumeArtifact.kind, resumeArtifact.id);
    if (pathname !== target) {
      router.replace(target);
    }
  }, [authStatus, currentUser?.id, isSignedIn, pathname, router]);

  return (
    <RootErrorBoundary
      onError={(error, errorInfo) => logError(error, errorInfo, { route: segments.join('/') })}
    >
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
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
          {isSignedIn || authStatus === 'signing_out' ? (
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

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: theme.colors.background,
    border: theme.colors['border-default'],
    card: theme.colors.background,
    notification: theme.colors.accent,
    primary: theme.colors.accent,
    text: theme.colors.foreground,
  },
};

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
    <ThemeProvider value={navigationTheme}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <GestureHandlerRootView style={rootStyles.gestureRoot}>
            <KeyboardProvider>
              <AuthProvider>
                <BottomSheetModalProvider>
                  <InnerRootLayout />
                </BottomSheetModalProvider>
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );

  return POSTHOG_ENABLED ? (
    <PostHogProvider client={posthog as PostHog}>{content}</PostHogProvider>
  ) : (
    content
  );
}

export default RootLayout;
