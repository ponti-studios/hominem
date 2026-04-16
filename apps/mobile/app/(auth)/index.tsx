import { AUTH_COPY, CHAT_AUTH_CONFIG } from '@hominem/auth/shared/ux-contract';
import type { RelativePathString } from 'expo-router';
import { Redirect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { getAuthScreenBaseStyles } from '~/components/auth/auth-screen-styles';
import { AuthLayout } from '~/components/AuthLayout';
import { FeatureErrorBoundary } from '~/components/error-boundary/FeatureErrorBoundary';
import { Box, makeStyles, Text } from '~/components/theme';
import { Button } from '~/components/ui/Button';
import { TextField } from '~/components/ui/TextField';
import { E2E_TESTING, MOBILE_PASSKEY_ENABLED } from '~/constants';
import { useAuth } from '~/services/auth/auth-provider';
import { useMobilePasskeyAuth } from '~/services/auth/hooks/use-mobile-passkey-auth';
import { isValidEmail, normalizeEmail } from '~/services/auth/validation';
import { posthog } from '~/services/posthog';

export function AuthScreen() {
  const styles = useStyles();
  const { authStatus, isSignedIn, completePasskeySignIn, requestEmailOtp } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const {
    signIn: signInWithPasskey,
    isLoading: isPasskeyLoading,
    error: passkeyError,
    isSupported: isPasskeySupported,
  } = useMobilePasskeyAuth();

  useEffect(() => {
    posthog.capture('auth_screen_viewed');
  }, []);

  const handleSendCode = useCallback(async () => {
    posthog.capture('auth_send_code_pressed');
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      setAuthError(AUTH_COPY.emailEntry.emailRequiredError);
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      posthog.capture('auth_email_invalid');
      setAuthError(AUTH_COPY.emailEntry.emailInvalidError);
      return;
    }

    try {
      setIsSubmitting(true);
      await requestEmailOtp(normalizedEmail);
      router.replace(
        `/(auth)/verify?email=${encodeURIComponent(normalizedEmail)}` as RelativePathString,
      );
    } catch (error: unknown) {
      setAuthError(error instanceof Error ? error.message : AUTH_COPY.emailEntry.sendFailedError);
    } finally {
      setIsSubmitting(false);
    }
  }, [email, requestEmailOtp, router]);

  const handlePasskeySignIn = useCallback(async () => {
    posthog.capture('auth_passkey_pressed');
    try {
      setIsSubmitting(true);
      setAuthError(null);
      const result = await signInWithPasskey();
      if (result) {
        await completePasskeySignIn(result);
      }
    } catch (error: unknown) {
      setAuthError(error instanceof Error ? error.message : AUTH_COPY.passkey.genericError);
    } finally {
      setIsSubmitting(false);
    }
  }, [completePasskeySignIn, signInWithPasskey]);

  if (isSignedIn) {
    return <Redirect href={CHAT_AUTH_CONFIG.defaultPostAuthDestination as RelativePathString} />;
  }

  const displayError = authError || passkeyError;
  const canUsePasskeys = MOBILE_PASSKEY_ENABLED && isPasskeySupported;

  return (
    <AuthLayout
      testID="auth-screen"
      title={AUTH_COPY.emailEntry.title}
      helper={AUTH_COPY.emailEntry.helper}
      isProbing={authStatus === 'booting'}
    >
      <Box style={styles.form}>
        <View style={styles.fieldStack}>
          <TextField
            testID="auth-email-input"
            id="auth-email"
            label={AUTH_COPY.emailEntry.emailLabel}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            editable={!isSubmitting}
            placeholder={AUTH_COPY.emailEntry.emailPlaceholder}
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
          />
          {displayError ? (
            <Text testID="auth-email-message" style={styles.errorText}>
              {displayError}
            </Text>
          ) : null}
        </View>

        <Button
          onPress={handleSendCode}
          disabled={isSubmitting}
          isLoading={isSubmitting}
          testID="auth-send-otp"
          title={AUTH_COPY.emailEntry.submitButton}
          style={styles.primaryButton}
        />

        {canUsePasskeys ? (
          <Button
            onPress={handlePasskeySignIn}
            disabled={isSubmitting}
            isLoading={isPasskeyLoading}
            variant="link"
            size="xs"
            style={styles.passkeyButton}
            textStyle={styles.passkeyButtonText}
            testID="auth-passkey-button"
            title={
              isPasskeyLoading
                ? AUTH_COPY.emailEntry.passkeyLoadingButton
                : AUTH_COPY.emailEntry.passkeyButton
            }
          />
        ) : null}

        {E2E_TESTING && MOBILE_PASSKEY_ENABLED ? (
          <Pressable
            onPress={async () => {
              try {
                setIsSubmitting(true);
                setAuthError(null);
                const result = await signInWithPasskey('e2e-success');
                if (result) {
                  await completePasskeySignIn(result);
                }
              } catch (error: unknown) {
                setAuthError(
                  error instanceof Error ? error.message : AUTH_COPY.passkey.genericError,
                );
              } finally {
                setIsSubmitting(false);
              }
            }}
            style={styles.e2ePasskeyAction}
            testID="auth-e2e-passkey-success"
          />
        ) : null}

        {E2E_TESTING && MOBILE_PASSKEY_ENABLED ? (
          <Pressable
            onPress={async () => {
              try {
                setIsSubmitting(true);
                setAuthError(null);
                await signInWithPasskey('e2e-cancel');
              } finally {
                setIsSubmitting(false);
              }
            }}
            style={styles.e2ePasskeyActionAlt}
            testID="auth-e2e-passkey-cancel"
          />
        ) : null}
      </Box>
    </AuthLayout>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    ...getAuthScreenBaseStyles(t),
    passkeyButton: {
      alignSelf: 'center',
    },
    passkeyButtonText: {
      color: t.colors['text-tertiary'],
      fontSize: 12,
      fontWeight: '600',
      textDecorationLine: 'underline',
    },
    e2ePasskeyAction: {
      position: 'absolute',
      top: t.spacing.xs_4,
      right: t.spacing.xs_4,
      width: 16,
      height: 16,
      opacity: 0.02,
    },
    e2ePasskeyActionAlt: {
      position: 'absolute',
      top: t.spacing.ml_24,
      right: t.spacing.xs_4,
      width: 16,
      height: 16,
      opacity: 0.02,
    },
  }),
);

const AuthWithErrorBoundary = () => (
  <FeatureErrorBoundary featureName="Auth">
    <AuthScreen />
  </FeatureErrorBoundary>
);

export default AuthWithErrorBoundary;
