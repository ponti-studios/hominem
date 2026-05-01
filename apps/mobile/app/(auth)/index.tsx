import { CHAT_AUTH_CONFIG } from '@hominem/auth/shared/ux-contract';
import type { RelativePathString } from 'expo-router';
import { Redirect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
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
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { FeatureErrorBoundary } from '~/components/error-boundary/FeatureErrorBoundary';
import { Button } from '~/components/ui/button';
import AppIcon from '~/components/ui/icon';
import { E2E_TESTING, MOBILE_PASSKEY_ENABLED } from '~/constants';
import { useAuth } from '~/services/auth/auth-provider';
import { resolveAuthScreenState } from '~/services/auth/auth-screen-state';
import { useMobilePasskeyAuth } from '~/services/auth/hooks/use-mobile-passkey-auth';
import { isValidEmail, normalizeEmail } from '~/services/auth/validation';
import { posthog } from '~/services/posthog';
import t from '~/translations';

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
    inputText: '#000000',
    inputPlaceholder: '#8A8A8A',
    error: '#C62828',
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
    inputText: '#FFFFFF',
    inputPlaceholder: '#7A7A7A',
    error: '#FF8A80',
  },
} as const;

function AuthScreen() {
  const { authStatus, isSignedIn, completePasskeySignIn, requestEmailOtp } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const {
    signIn: signInWithPasskey,
    isLoading: isPasskeyLoading,
    error: passkeyError,
    isSupported: isPasskeySupported,
  } = useMobilePasskeyAuth({ loadPasskeys: false });

  // Animations
  const shakeX = useSharedValue(0);
  const continueButtonOpacity = useSharedValue(0);

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));
  const continueButtonStyle = useAnimatedStyle(() => ({ opacity: continueButtonOpacity.value }));

  // Animate Continue button in when a valid email is typed
  const normalizedEmail = normalizeEmail(email);
  const emailIsValid = isValidEmail(normalizedEmail);
  useEffect(() => {
    continueButtonOpacity.value = withTiming(emailIsValid ? 1 : 0, { duration: 36 });
  }, [emailIsValid, continueButtonOpacity]);

  // Shake input when a new error appears
  const prevErrorRef = React.useRef<string | null>(null);
  useEffect(() => {
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

  useEffect(() => {
    posthog.capture('auth_screen_viewed');
  }, []);

  const handleSendCode = useCallback(async () => {
    posthog.capture('auth_send_code_pressed');
    if (!normalizedEmail) {
      setAuthError(t.auth.emailEntry.emailRequiredError);
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      posthog.capture('auth_email_invalid');
      setAuthError(t.auth.emailEntry.emailInvalidError);
      return;
    }

    try {
      setIsSubmitting(true);
      await requestEmailOtp(normalizedEmail);
      router.replace(
        `/(auth)/verify?email=${encodeURIComponent(normalizedEmail)}&sentAt=${Date.now()}` as RelativePathString,
      );
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : t.auth.emailEntry.sendFailedError);
    } finally {
      setIsSubmitting(false);
    }
  }, [normalizedEmail, requestEmailOtp, router]);

  const handlePasskeySignIn = useCallback(async () => {
    posthog.capture('auth_passkey_pressed');
    try {
      setIsSubmitting(true);
      setAuthError(null);
      const result = await signInWithPasskey();
      if (result) {
        await completePasskeySignIn(result);
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : t.auth.passkey.genericError);
    } finally {
      setIsSubmitting(false);
    }
  }, [completePasskeySignIn, signInWithPasskey]);

  const handleE2EPasskey = useCallback(
    async (mode: 'e2e-success' | 'e2e-cancel') => {
      try {
        setIsSubmitting(true);
        setAuthError(null);
        const result = await signInWithPasskey(mode);
        if (result) {
          await completePasskeySignIn(result);
        }
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : t.auth.passkey.genericError);
      } finally {
        setIsSubmitting(false);
      }
    },
    [completePasskeySignIn, signInWithPasskey],
  );

  if (isSignedIn) {
    return <Redirect href={CHAT_AUTH_CONFIG.defaultPostAuthDestination as RelativePathString} />;
  }

  const { isProbing, displayError } = resolveAuthScreenState({
    authStatus,
    authError,
    passkeyError,
  });
  const canUsePasskeys = MOBILE_PASSKEY_ENABLED && isPasskeySupported;
  const palette = colorScheme === 'light' ? authPalette.light : authPalette.dark;

  return (
    <>
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
          testID="auth-screen"
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentShell}>
            <View style={styles.card}>
              <View style={[styles.iconChip, { backgroundColor: palette.iconChip }]}>
                <AppIcon name="envelope" />
              </View>

              <View style={styles.copyBlock}>
                <Text style={[styles.title, { color: palette.textPrimary }]}>
                  {t.auth.emailEntry.title}
                </Text>
                <Text style={[styles.helperText, { color: palette.textSecondary }]}>
                  {isProbing ? t.auth.resumingSession : t.auth.emailEntry.helper}
                </Text>
              </View>

              {!isProbing ? (
                <View style={styles.formSection}>
                  <Animated.View style={shakeStyle}>
                    <TextInput
                      testID="auth-email-input"
                      value={email}
                      placeholder={t.auth.emailEntry.emailPlaceholder}
                      placeholderTextColor={palette.inputPlaceholder}
                      keyboardType="email-address"
                      textContentType="emailAddress"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoFocus
                      editable={!isSubmitting}
                      cursorColor={palette.textPrimary}
                      selectionColor={palette.textPrimary}
                      style={[
                        styles.input,
                        {
                          backgroundColor: palette.inputBackground,
                          borderColor: displayError ? palette.error : palette.border,
                          color: palette.inputText,
                          opacity: isSubmitting ? 0.6 : 1,
                        },
                      ]}
                      onChangeText={(text) => {
                        setEmail(text);
                        setAuthError(null);
                      }}
                      onBlur={() => {
                        if (email.trim()) {
                          posthog.capture('auth_email_entered', {
                            valid: isValidEmail(normalizeEmail(email)),
                          });
                        }
                      }}
                      accessibilityLabel={t.auth.emailEntry.emailLabel}
                    />
                  </Animated.View>

                  {displayError ? (
                    <Text
                      testID="auth-email-message"
                      accessibilityLiveRegion="polite"
                      style={[styles.errorText, { color: palette.error }]}
                    >
                      {displayError}
                    </Text>
                  ) : null}

                  {/* Continue button — animates in when email is valid */}
                  <Animated.View
                    style={continueButtonStyle}
                    pointerEvents={emailIsValid ? 'auto' : 'none'}
                  >
                    <Button
                      testID="auth-send-otp"
                      label={t.auth.emailEntry.submitButton}
                      onPress={() => void handleSendCode()}
                      disabled={isSubmitting}
                      variant="primary"
                    />
                  </Animated.View>

                  {canUsePasskeys ? (
                    <Button
                      testID="auth-passkey-button"
                      label={
                        isPasskeyLoading
                          ? t.auth.emailEntry.passkeyLoadingButton
                          : t.auth.emailEntry.passkeyButton
                      }
                      onPress={() => void handlePasskeySignIn()}
                      disabled={isSubmitting || isPasskeyLoading}
                      variant="secondary"
                    />
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {E2E_TESTING && MOBILE_PASSKEY_ENABLED ? (
        <Pressable
          onPress={() => void handleE2EPasskey('e2e-success')}
          style={styles.e2ePasskeyAction}
          testID="auth-e2e-passkey-success"
        />
      ) : null}

      {E2E_TESTING && MOBILE_PASSKEY_ENABLED ? (
        <Pressable
          onPress={() => void handleE2EPasskey('e2e-cancel')}
          style={styles.e2ePasskeyActionAlt}
          testID="auth-e2e-passkey-cancel"
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
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
  helperText: {
    fontSize: 15,
    lineHeight: 20,
  },
  formSection: {
    gap: 12,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
  },
  orbPrimary: {
    position: 'absolute',
    top: -120,
    right: -60,
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.42,
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
  e2ePasskeyAction: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    opacity: 0.02,
  },
  e2ePasskeyActionAlt: {
    position: 'absolute',
    top: 24,
    right: 4,
    width: 16,
    height: 16,
    opacity: 0.02,
  },
});

const AuthWithErrorBoundary = () => (
  <FeatureErrorBoundary featureName="Auth">
    <AuthScreen />
  </FeatureErrorBoundary>
);

export default AuthWithErrorBoundary;
