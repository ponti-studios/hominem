import { maskEmail } from '@hominem/auth/shared/mask-email';
import type { RelativePathString } from 'expo-router';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { CHAT_AUTH_CONFIG } from '~/config/auth';
import { OTP_EXPIRES_SECONDS } from '~/config/auth-protocol';
import t from '~/translations';

import { FeatureErrorBoundary } from '../../components/error-boundary/FeatureErrorBoundary';
import { Button } from '../../components/ui/button';
import AppIcon from '../../components/ui/icon';
import { useAuth } from '../../services/auth/auth-provider';
import { useEmailAuth } from '../../services/auth/hooks/use-email-auth';
import { normalizeOtp } from '../../services/auth/validation';
import { posthog } from '../../services/posthog';

const authPalette = {
  light: {
    background: '#FFFFFF',
    orbPrimary: '#F5F5F5',
    orbSecondary: '#F0F0F0',
    icon: '#000000',
    iconChip: '#F5F5F5',
    textPrimary: '#000000',
    textSecondary: '#5F5F5F',
    border: '#D7D7D7',
    inputBackground: '#FFFFFF',
    inputPlaceholder: '#8A8A8A',
    error: '#C62828',
    warning: '#B45309',
    success: '#16A34A',
  },
  dark: {
    background: '#000000',
    orbPrimary: '#1A1A1A',
    orbSecondary: '#0F0F0F',
    icon: '#FFFFFF',
    iconChip: '#2A2A2A',
    textPrimary: '#FFFFFF',
    textSecondary: '#B3B3B3',
    border: '#2F2F2F',
    inputBackground: '#111111',
    inputPlaceholder: '#7A7A7A',
    error: '#FF8A80',
    warning: '#FCD34D',
    success: '#4ADE80',
  },
} as const;

type Palette = (typeof authPalette)['light'] | (typeof authPalette)['dark'];

function countdownColor(secondsLeft: number, palette: Palette) {
  if (secondsLeft === 0 || secondsLeft < 20) return palette.error;
  if (secondsLeft < 60) return palette.warning;
  return palette.textSecondary;
}

function formatCountdown(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function VerifyScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { isSignedIn, requestEmailOtp, verifyEmailOtp } = useAuth();
  const {
    email: emailParam,
    token: tokenParam,
    sentAt: sentAtParam,
  } = useLocalSearchParams<{
    email: string;
    token?: string;
    sentAt?: string;
  }>();
  const resolvedEmail = emailParam ?? '';
  const autoSubmitKeyRef = React.useRef<string | null>(null);

  // Countdown
  const [tokenSentAt, setTokenSentAt] = React.useState(() =>
    sentAtParam ? Number(sentAtParam) : Date.now(),
  );
  const [secondsLeft, setSecondsLeft] = React.useState(() =>
    Math.max(
      0,
      OTP_EXPIRES_SECONDS -
        Math.floor((Date.now() - (sentAtParam ? Number(sentAtParam) : Date.now())) / 1000),
    ),
  );

  React.useEffect(() => {
    setSecondsLeft(
      Math.max(0, OTP_EXPIRES_SECONDS - Math.floor((Date.now() - tokenSentAt) / 1000)),
    );
    const id = setInterval(() => {
      const left = Math.max(0, OTP_EXPIRES_SECONDS - Math.floor((Date.now() - tokenSentAt) / 1000));
      setSecondsLeft(left);
      if (left === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [tokenSentAt]);

  // Success state — brief pause before redirect
  const [verifySucceeded, setVerifySucceeded] = React.useState(false);
  React.useEffect(() => {
    if (!verifySucceeded) return;
    const id = setTimeout(() => {
      router.replace(CHAT_AUTH_CONFIG.defaultPostAuthDestination as RelativePathString);
    }, 900);
    return () => clearTimeout(id);
  }, [verifySucceeded, router]);

  // Animations
  const shakeX = useSharedValue(0);
  const verifyButtonOpacity = useSharedValue(0);

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));
  const verifyButtonStyle = useAnimatedStyle(() => ({ opacity: verifyButtonOpacity.value }));

  const {
    otp,
    setOtp,
    error: authError,
    isSubmitting,
    isResending,
    handleVerifyOtp,
    handleResendOtp,
  } = useEmailAuth({
    sendOtp: async () => {},
    verifyOtp: async (email, code) => {
      await verifyEmailOtp({ email, otp: normalizeOtp(code) });
      setVerifySucceeded(true);
    },
    resendOtp: async (email) => {
      await requestEmailOtp(email);
    },
  });

  // Shake input row when a new error appears
  const prevErrorRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (authError && authError !== prevErrorRef.current) {
      shakeX.value = withSequence(
        withTiming(10, { duration: 50, easing: Easing.linear }),
        withTiming(-10, { duration: 50, easing: Easing.linear }),
        withTiming(7, { duration: 50, easing: Easing.linear }),
        withTiming(-7, { duration: 50, easing: Easing.linear }),
        withTiming(0, { duration: 50, easing: Easing.linear }),
      );
    }
    prevErrorRef.current = authError;
  }, [authError, shakeX]);

  const normalizedOtp = normalizeOtp(otp).slice(0, 6);

  // Animate Verify button in when 6 digits are present
  React.useEffect(() => {
    const ready = normalizedOtp.length === 6;
    verifyButtonOpacity.value = withTiming(ready ? 1 : 0, { duration: 36 });
  }, [normalizedOtp.length, verifyButtonOpacity]);

  React.useEffect(() => {
    posthog.capture('auth_verify_screen_viewed');
  }, []);

  React.useEffect(() => {
    const normalizedToken = normalizeOtp(tokenParam ?? '');
    const submitKey = `${resolvedEmail}:${normalizedToken}`;
    if (autoSubmitKeyRef.current === submitKey || !resolvedEmail || normalizedToken.length !== 6) {
      return;
    }
    autoSubmitKeyRef.current = submitKey;
    setOtp(normalizedToken);
    posthog.capture('auth_verify_link_opened');
    void handleVerifyOtp(resolvedEmail, normalizedToken);
  }, [handleVerifyOtp, resolvedEmail, setOtp, tokenParam]);

  if (isSignedIn && !verifySucceeded) {
    return <Redirect href={CHAT_AUTH_CONFIG.defaultPostAuthDestination as RelativePathString} />;
  }

  if (!resolvedEmail) {
    return null;
  }

  const isBusy = isSubmitting || isResending;
  const palette = colorScheme === 'light' ? authPalette.light : authPalette.dark;

  if (verifySucceeded) {
    return (
      <View
        style={[styles.container, styles.successContainer, { backgroundColor: palette.background }]}
      >
        <Animated.View entering={FadeIn.duration(300)} style={styles.successContent}>
          <View style={[styles.successChip, { backgroundColor: palette.iconChip }]}>
            <AppIcon name="checkmark.circle.fill" size={32} tintColor={palette.success} />
          </View>
          <Text style={[styles.successText, { color: palette.textPrimary }]}>
            {t.auth.verify.signedIn}
          </Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: palette.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View
        pointerEvents="none"
        style={[styles.orbPrimary, { backgroundColor: palette.orbPrimary }]}
      />
      <View
        pointerEvents="none"
        style={[styles.orbSecondary, { backgroundColor: palette.orbSecondary }]}
      />

      <ScrollView
        testID="auth-verify-screen"
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentShell}>
          <View style={styles.card}>
            <View style={[styles.iconChip, { backgroundColor: palette.iconChip }]}>
              <AppIcon name="lock.shield" />
            </View>

            <View style={styles.copyBlock}>
              <Text style={[styles.title, { color: palette.textPrimary }]}>
                {t.auth.verify.title}
              </Text>
              <View style={styles.emailChipRow}>
                <Text style={[styles.helperText, { color: palette.textSecondary }]}>
                  {t.auth.verify.codeSentTo}
                </Text>
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    posthog.capture('auth_change_email_pressed');
                    router.replace('/(auth)' as RelativePathString);
                  }}
                  style={({ pressed }) => [
                    styles.emailChip,
                    { backgroundColor: palette.iconChip, opacity: pressed ? 0.65 : 1 },
                  ]}
                >
                  <Text style={[styles.emailChipText, { color: palette.textPrimary }]}>
                    {maskEmail(resolvedEmail)}
                  </Text>
                  <AppIcon name="pencil" size={11} tintColor={palette.textSecondary} />
                </Pressable>
              </View>
            </View>

            <View style={styles.formSection}>
              <Animated.View style={shakeStyle}>
                <View
                  style={[
                    styles.inputRow,
                    {
                      backgroundColor: palette.inputBackground,
                      borderColor: authError ? palette.error : palette.border,
                      opacity: isBusy ? 0.6 : 1,
                    },
                  ]}
                >
                  <TextInput
                    testID="auth-otp-input"
                    value={normalizedOtp}
                    placeholder={t.auth.verify.codePlaceholder}
                    placeholderTextColor={palette.inputPlaceholder}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                    returnKeyType="done"
                    editable={!isBusy}
                    cursorColor={palette.textPrimary}
                    selectionColor={palette.textPrimary}
                    style={[styles.input, { color: palette.textPrimary }]}
                    onChangeText={(value) => {
                      setOtp(normalizeOtp(value).slice(0, 6));
                    }}
                    onSubmitEditing={() => {
                      if (normalizedOtp.length === 6) {
                        posthog.capture('auth_verify_pressed');
                        void handleVerifyOtp(resolvedEmail, normalizedOtp);
                      }
                    }}
                    accessibilityLabel={t.auth.verify.oneTimeVerificationCodeA11y}
                  />
                  {secondsLeft === 0 ? (
                    <Text style={[styles.countdown, { color: palette.error }]}>
                      {t.auth.verify.expired}
                    </Text>
                  ) : (
                    <Text
                      style={[styles.countdown, { color: countdownColor(secondsLeft, palette) }]}
                      accessibilityLabel={t.auth.verify.timeRemainingA11y(secondsLeft)}
                    >
                      {formatCountdown(secondsLeft)}
                    </Text>
                  )}
                </View>
              </Animated.View>

              {authError ? (
                <Text
                  testID="auth-otp-message"
                  accessibilityLiveRegion="polite"
                  style={[styles.errorText, { color: palette.error }]}
                >
                  {authError}
                </Text>
              ) : null}

              {/* Verify / resend primary button — animates in once 6 digits are entered */}
              <Animated.View
                style={[styles.verifyButtonWrap, verifyButtonStyle]}
                pointerEvents={normalizedOtp.length === 6 ? 'auto' : 'none'}
              >
                {secondsLeft === 0 ? (
                  <Button
                    testID="auth-resend-otp-primary"
                    label={t.auth.verify.resendButton}
                    onPress={async () => {
                      posthog.capture('auth_resend_pressed');
                      await handleResendOtp(resolvedEmail);
                      setTokenSentAt(Date.now());
                    }}
                    disabled={isBusy}
                    variant="primary"
                  />
                ) : (
                  <Button
                    testID="auth-verify-otp"
                    label={t.auth.verify.verifyButton}
                    onPress={() => {
                      posthog.capture('auth_verify_pressed');
                      void handleVerifyOtp(resolvedEmail, normalizedOtp);
                    }}
                    disabled={isSubmitting || normalizedOtp.length !== 6}
                    variant="primary"
                  />
                )}
              </Animated.View>

              <View style={styles.tertiaryRow}>
                <Button
                  testID="auth-resend-otp"
                  label={t.auth.verify.resendButton}
                  onPress={async () => {
                    posthog.capture('auth_resend_pressed');
                    await handleResendOtp(resolvedEmail);
                    setTokenSentAt(Date.now());
                  }}
                  disabled={isBusy}
                  variant="tertiary"
                  size="sm"
                />
                <Button
                  label={t.auth.verify.changeEmailLink}
                  onPress={() => {
                    posthog.capture('auth_change_email_pressed');
                    router.replace('/(auth)' as RelativePathString);
                  }}
                  disabled={isBusy}
                  variant="tertiary"
                  size="sm"
                />
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  successContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  successContent: {
    alignItems: 'center',
    gap: 16,
  },
  successChip: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successText: {
    fontSize: 22,
    fontWeight: '700',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 80,
  },
  contentShell: {
    width: '100%',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    gap: 20,
  },
  iconChip: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyBlock: {
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  emailChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  helperText: {
    fontSize: 15,
    lineHeight: 20,
  },
  emailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  emailChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  formSection: {
    gap: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  countdown: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    marginLeft: 8,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
  },
  verifyButtonWrap: {
    overflow: 'hidden',
  },
  tertiaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  orbPrimary: {
    position: 'absolute',
    top: -120,
    right: -60,
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.62,
  },
  orbSecondary: {
    position: 'absolute',
    bottom: -150,
    left: -120,
    width: 340,
    height: 340,
    borderRadius: 170,
    opacity: 0.34,
  },
});

const VerifyWithErrorBoundary = () => (
  <FeatureErrorBoundary featureName="AuthVerify">
    <VerifyScreen />
  </FeatureErrorBoundary>
);

export default VerifyWithErrorBoundary;
