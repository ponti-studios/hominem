import type { RelativePathString } from 'expo-router';
import { Redirect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { FeatureErrorBoundary } from '~/components/error-boundary/FeatureErrorBoundary';
import { useThemeColors } from '~/components/theme';
import { Button } from '~/components/ui/button';
import AppIcon from '~/components/ui/icon';
import { CHAT_AUTH_CONFIG } from '~/config/auth';
import { E2E_TESTING, MOBILE_PASSKEY_ENABLED } from '~/constants';
import { useAuth } from '~/services/auth/auth-provider';
import { resolveAuthScreenState } from '~/services/auth/auth-screen-state';
import { useMobilePasskeyAuth } from '~/services/auth/hooks/use-mobile-passkey-auth';
import { isValidEmail, normalizeEmail } from '~/services/auth/validation';
import { posthog } from '~/services/posthog';
import t from '~/translations';

function AuthScreen() {
  const { authStatus, isSignedIn, completePasskeySignIn, requestEmailOtp } = useAuth();
  const router = useRouter();
  const themeColors = useThemeColors();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const {
    signIn: signInWithPasskey,
    isLoading: isPasskeyLoading,
    error: passkeyError,
    isSupported: isPasskeySupported,
  } = useMobilePasskeyAuth({ loadPasskeys: false });
  const normalizedEmail = normalizeEmail(email);
  const emailIsValid = isValidEmail(normalizedEmail);

  // Animations
  const shakeStyle = useAnimatedStyle(
    () => ({
      transform: [
        {
          translateX: authError
            ? withSequence(
                withTiming(10, { duration: 50, easing: Easing.linear }),
                withTiming(-10, { duration: 50, easing: Easing.linear }),
                withTiming(7, { duration: 50, easing: Easing.linear }),
                withTiming(-7, { duration: 50, easing: Easing.linear }),
                withTiming(0, { duration: 50, easing: Easing.linear }),
              )
            : 0,
        },
      ],
    }),
    [authError],
  );
  const continueButtonStyle = useAnimatedStyle(
    () => ({
      opacity: withTiming(emailIsValid ? 1 : 0, { duration: 36 }),
    }),
    [emailIsValid],
  );

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

  return (
    <>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: themeColors.background }]}
        behavior="padding"
      >
        <View
          pointerEvents="none"
          style={[styles.orbPrimary, { backgroundColor: themeColors['bg-surface'] }]}
        />
        <View
          pointerEvents="none"
          style={[styles.orbSecondary, { backgroundColor: themeColors['bg-elevated'] }]}
        />

        <ScrollView
          testID="auth-screen"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentShell}>
            <View style={styles.card}>
              <View style={[styles.iconChip, { backgroundColor: themeColors['bg-surface'] }]}>
                <AppIcon name="envelope" />
              </View>

              <View style={styles.copyBlock}>
                <Text style={[styles.title, { color: themeColors.foreground }]}>
                  {t.auth.emailEntry.title}
                </Text>
                <Text style={[styles.helperText, { color: themeColors['text-secondary'] }]}>
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
                      placeholderTextColor={themeColors['text-tertiary']}
                      keyboardType="email-address"
                      textContentType="emailAddress"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoFocus
                      editable={!isSubmitting}
                      cursorColor={themeColors.foreground}
                      selectionColor={themeColors.foreground}
                      style={[
                        styles.input,
                        {
                          backgroundColor: themeColors['bg-surface'],
                          borderColor: displayError
                            ? themeColors.destructive
                            : themeColors['border-default'],
                          color: themeColors.foreground,
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
                      style={[styles.errorText, { color: themeColors.destructive }]}
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
